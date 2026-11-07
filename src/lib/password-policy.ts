const COMMON_PASSWORDS = new Set([
    'password',
    'password1',
    'password123',
    'admin123',
    'qwerty123',
    '12345678',
    '123456789',
    '1234567890',
    'welcome123',
    'letmein123',
    'wisely123',
]);

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

type PasswordContext = {
    email?: string;
    name?: string;
};

export function validateStrongPassword(password: string, context: PasswordContext = {}) {
    if (password.length < PASSWORD_MIN_LENGTH) {
        return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
        return `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters.`;
    }
    if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
    if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
    if (!/\d/.test(password)) return 'Password must include at least one number.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character.';

    const normalizedPassword = password.toLocaleLowerCase('tr-TR');
    if (COMMON_PASSWORDS.has(normalizedPassword)) return 'This password is too common. Choose a more unique password.';

    const emailPrefix = context.email?.split('@')[0]?.toLocaleLowerCase('tr-TR');
    if (emailPrefix && emailPrefix.length >= 4 && normalizedPassword.includes(emailPrefix)) {
        return 'Password cannot contain the username portion of your email address.';
    }

    const nameParts = context.name
        ?.toLocaleLowerCase('tr-TR')
        .split(/\s+/)
        .filter((part) => part.length >= 4) || [];
    if (nameParts.some((part) => normalizedPassword.includes(part))) {
        return 'Password cannot contain a recognizable part of your name.';
    }

    return null;
}
