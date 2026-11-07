import { randomBytes, randomInt, scrypt as scryptCallback } from 'crypto';
import { promisify } from 'util';
import { PrismaClient } from '../src/generated/client';

const scrypt = promisify(scryptCallback);
const prisma = new PrismaClient();

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

function generateStrongPassword(length = 20) {
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const symbols = '!@#$%^&*_-+=?';
    const all = `${lower}${upper}${digits}${symbols}`;
    const characters = [
        lower[randomInt(lower.length)],
        upper[randomInt(upper.length)],
        digits[randomInt(digits.length)],
        symbols[randomInt(symbols.length)],
    ];
    for (let i = characters.length; i < length; i++) {
        characters.push(all[randomInt(all.length)]);
    }
    for (let i = characters.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [characters[i], characters[j]] = [characters[j], characters[i]];
    }
    return characters.join('');
}

async function main() {
    const email = process.argv[2];
    const newPassword = process.argv[3];

    if (!email) {
        console.log('Usage: npx tsx scripts/reset-admin-password.ts <email> [new-password]');
        console.log('If [new-password] is omitted, a secure strong password will be generated automatically.');
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, active: true }
        });
        console.log('\nCurrent users in database:', users.length ? users : 'None (Initial Setup Mode active)');
        return;
    }

    const passwordToSet = newPassword || generateStrongPassword(20);
    const passwordHash = await hashPassword(passwordToSet);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        console.log(`User with email "${email}" not found.`);
        console.log('Creating new administrator account...');
        await prisma.user.create({
            data: {
                name: 'Administrator',
                email,
                passwordHash,
                role: 'ADMIN',
                active: true,
            }
        });
        console.log(`Administrator account created successfully!`);
        console.log(`Email: ${email}`);
        console.log(`Password: ${passwordToSet}`);
        return;
    }

    await prisma.user.update({
        where: { email },
        data: { passwordHash, active: true },
    });

    // Revoke existing sessions to enforce re-login with the new password
    await prisma.session.deleteMany({ where: { userId: user.id } });

    console.log(`Password successfully updated for user: ${email}`);
    console.log(`New Password: ${passwordToSet}`);
}

main()
    .catch((e) => {
        console.error('Error resetting password:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
