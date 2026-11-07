import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { Toaster } from "@/components/ui/sonner"
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { canAccessPath } from '@/lib/authorization';
import { getRolePermissions } from '@/lib/permissions';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Wisely - n8n Security & Inventory',
    description: 'Secure your n8n workflows and discover LLM services.',
    icons: {
        icon: [
            { url: '/icon.svg', type: 'image/svg+xml' },
            { url: '/favicon.ico', sizes: 'any' },
        ],
        apple: '/apple-icon.png',
    },
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const pathname = (await headers()).get('x-wisely-pathname') || '/';
    const isLoginPage = pathname === '/login';
    const user = await getCurrentUser();
    const permissions = user ? await getRolePermissions(user.role) : [];

    if (!isLoginPage && !user) {
        redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }

    if (user && !canAccessPath(user.role, pathname, permissions)) {
        redirect('/unauthorized');
    }

    return (
        <html lang="en">
            <body className={`${inter.className} min-h-screen bg-background`}>
                {isLoginPage ? (
                    <main className="min-h-screen bg-muted/20">
                        {children}
                    </main>
                ) : (
                    <div className="flex min-h-screen">
                        <Sidebar user={user!} permissions={permissions} />
                        <main className="flex-1 overflow-y-auto bg-muted/10 p-8">
                            {children}
                        </main>
                    </div>
                )}
                <Toaster />
            </body>
        </html>
    );
}
