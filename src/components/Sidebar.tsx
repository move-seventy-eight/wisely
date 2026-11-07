'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, ShieldCheck, Activity, Globe, Database, Eye, Clover, Radio, Settings, Terminal, FileCode2, Layers, CalendarClock, ShieldAlert, Key, Users, UserCircle, LogOut, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canAccessPath, Permission, ROLE_LABELS, UserRole } from '@/lib/authorization';
import { logoutAction } from '@/app/login/actions';

type SidebarUser = {
    name: string;
    email: string;
    role: UserRole;
};

function N8nStatusWidget() {
    const [status, setStatus] = useState<{
        connected: boolean;
        status: 'operational' | 'offline' | 'auth_error' | 'not_configured' | 'checking';
        title: string;
        description: string;
    }>({
        connected: false,
        status: 'checking',
        title: 'Checking n8n...',
        description: 'Testing connection'
    });

    useEffect(() => {
        let mounted = true;
        const check = async () => {
            try {
                const res = await fetch('/api/n8n/health');
                if (res.ok && mounted) {
                    const data = await res.json();
                    setStatus(data);
                } else if (mounted) {
                    setStatus({
                        connected: false,
                        status: 'offline',
                        title: 'n8n Disconnected',
                        description: 'Instance unreachable'
                    });
                }
            } catch {
                if (mounted) {
                    setStatus({
                        connected: false,
                        status: 'offline',
                        title: 'n8n Disconnected',
                        description: 'Instance unreachable'
                    });
                }
            }
        };

        check();
        const timer = setInterval(check, 30000);
        return () => {
            mounted = false;
            clearInterval(timer);
        };
    }, []);

    const isConnected = status.connected && status.status === 'operational';
    const isOffline = status.status === 'offline';
    const isAuthError = status.status === 'auth_error';

    return (
        <Link href="/settings" title="Click to view n8n settings" className="block group">
            <div className={cn(
                "rounded-xl border p-4 shadow-sm transition-all duration-200 group-hover:bg-muted/40",
                isConnected ? "bg-card border-border" : isOffline ? "bg-red-500/5 border-red-500/30" : isAuthError ? "bg-amber-500/5 border-amber-500/30" : "bg-card border-border"
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                        isConnected ? "bg-green-500/10" : isOffline ? "bg-red-500/10" : isAuthError ? "bg-amber-500/10" : "bg-slate-500/10"
                    )}>
                        <div className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            isConnected ? "bg-green-500 animate-pulse" : isOffline ? "bg-red-500" : isAuthError ? "bg-amber-500" : "bg-slate-400 animate-pulse"
                        )} />
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                        <p className={cn(
                            "text-sm font-medium truncate",
                            isConnected ? "text-foreground" : isOffline ? "text-red-600 dark:text-red-400" : isAuthError ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                        )}>
                            {status.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                            {status.description}
                        </p>
                    </div>
                </div>
            </div>
        </Link>
    );
}

export function Sidebar({ user, permissions }: { user: SidebarUser; permissions: Permission[] }) {
    const pathname = usePathname();

    const groups = [
        {
            label: 'General',
            items: [
                { href: '/', label: 'Overview', icon: LayoutDashboard },
                { href: '/account', label: 'My Account', icon: UserCircle },
            ]
        },
        {
            label: 'Automation',
            items: [
                { href: '/workflows', label: 'Workflows', icon: Activity },
                { href: '/workflow-inventory', label: 'Workflow Inventory', icon: Layers },
                { href: '/credentials', label: 'Credentials', icon: Key },
                { href: '/executions', label: 'Executions', icon: Radio },
                { href: '/webhooks', label: 'Endpoints', icon: Radio },
                { href: '/security', label: 'Security Audit', icon: ShieldCheck },
                { href: '/n8n-security', label: 'n8n Advisories', icon: ShieldAlert },
            ]
        },
        {
            label: 'Discovery',
            items: [
                { href: '/scanner', label: 'Network Probing', icon: Globe },
                { href: '/mcp-scanner', label: 'MCP Scanner', icon: Terminal },
                { href: '/skill-scanner', label: 'Skill Scanner', icon: FileCode2 },
                { href: '/ai-spotter', label: 'AI Spotter', icon: Activity },
                { href: '/aibom-scanner', label: 'AI BOM Scanner', icon: Layers },
                { href: '/inventory', label: 'Asset Inventory', icon: Database },
                { href: '/scheduled-scans', label: 'Scheduled Scans', icon: CalendarClock },
            ]
        },
        {
            label: 'Intelligence',
            items: [
                { href: '/shadow-ai', label: 'Shadow AI', icon: Eye },
            ]
        },
        {
            label: 'Threat Modelling',
            items: [
                { href: '/threat-modeler', label: 'Threat Modeler', icon: ShieldCheck },
            ]
        },
        {
            label: 'Offensive Security',
            items: [
                { href: '/red-team', label: 'Red Teaming', icon: ShieldCheck },
            ]
        },
        {
            label: 'Administration',
            items: [
                { href: '/users', label: 'Users', icon: Users },
                { href: '/roles', label: 'Roles & Permissions', icon: SlidersHorizontal },
            ]
        }
    ];

    const isSettingsActive = pathname === '/settings';

    return (
        <aside className="flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
            <div className="flex h-16 items-center border-b px-6">
                <div className="flex items-center gap-2 font-bold text-xl">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sm">
                        <Clover className="h-5 w-5" />
                    </div>
                    <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">Wisely</span>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-4">
                {groups.map((group, groupIndex) => {
                    const visibleItems = group.items.filter((item) => canAccessPath(user.role, item.href, permissions));
                    if (visibleItems.length === 0) return null;

                    return (
                    <div key={group.label} className={cn("mb-6", groupIndex === 0 && "mb-2")}>
                        {group.label !== 'General' && (
                            <h4 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                                {group.label}
                            </h4>
                        )}
                        <div className="space-y-1">
                            {visibleItems.map((link) => {
                                const Icon = link.icon;
                                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(`${link.href}/`));
                                return (
                                    <Link key={link.href} href={link.href}>
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                'w-full justify-start gap-3 rounded-xl px-4 py-3 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                                isActive && 'bg-primary/10 text-primary font-medium shadow-sm ring-1 ring-primary/20'
                                            )}
                                        >
                                            <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                                            {link.label}
                                        </Button>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                    );
                })}
            </nav>

            {canAccessPath(user.role, '/settings', permissions) && <div className="px-4 pb-2">
                <Link href="/settings">
                    <Button
                        variant="ghost"
                        className={cn(
                            'w-full justify-start gap-3 rounded-xl px-4 py-3 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                            isSettingsActive && 'bg-primary/10 text-primary font-medium shadow-sm ring-1 ring-primary/20'
                        )}
                    >
                        <Settings className={cn("h-4 w-4", isSettingsActive ? "text-primary" : "text-muted-foreground")} />
                        Settings
                    </Button>
                </Link>
            </div>}

            <div className="p-4 pt-0">
                <N8nStatusWidget />
            </div>

            <div className="border-t px-4 py-3">
                <div className="mb-3 flex items-center gap-3 rounded-xl bg-muted/60 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
                    </div>
                    <form action={logoutAction}>
                        <Button type="submit" variant="ghost" size="icon" title="Sign out">
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </div>

            <div className="px-6 py-3 border-t text-xs text-center text-muted-foreground">
                <p>Made with 💙</p>
                <p className="mt-1 opacity-50">v0.1.0</p>
            </div>
        </aside>
    );
}
