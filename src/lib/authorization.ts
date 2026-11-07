export const ROLES = ['ADMIN', 'ANALYST', 'VIEWER'] as const;

export type UserRole = (typeof ROLES)[number];

export const PERMISSIONS = [
    'DASHBOARD_VIEW',
    'WORKFLOWS_VIEW',
    'WORKFLOWS_MANAGE',
    'CREDENTIALS_VIEW',
    'EXECUTIONS_VIEW',
    'SECURITY_VIEW',
    'SECURITY_MANAGE',
    'DISCOVERY_VIEW',
    'DISCOVERY_RUN',
    'SHADOW_AI_VIEW',
    'SHADOW_AI_MANAGE',
    'THREAT_MODEL_VIEW',
    'RED_TEAM_VIEW',
    'SCHEDULED_SCANS_VIEW',
    'SCHEDULED_SCANS_MANAGE',
    'SETTINGS_MANAGE',
    'USERS_MANAGE',
    'ROLES_MANAGE',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_GROUPS: Array<{
    label: string;
    permissions: Array<{ key: Permission; label: string; description: string }>;
}> = [
    {
        label: 'Overview',
        permissions: [
            { key: 'DASHBOARD_VIEW', label: 'View dashboard', description: 'Access the overview dashboard and high-level metrics.' },
        ],
    },
    {
        label: 'Automation',
        permissions: [
            { key: 'WORKFLOWS_VIEW', label: 'View workflows', description: 'View workflows, inventory, endpoints, and workflow details.' },
            { key: 'WORKFLOWS_MANAGE', label: 'Manage workflows', description: 'Sync, import, rescan, and update workflow findings.' },
            { key: 'CREDENTIALS_VIEW', label: 'View credentials', description: 'View credential inventory and connected environments.' },
            { key: 'EXECUTIONS_VIEW', label: 'View executions', description: 'View execution history and execution details.' },
        ],
    },
    {
        label: 'Security & Discovery',
        permissions: [
            { key: 'SECURITY_VIEW', label: 'View security reports', description: 'View audit results and n8n security advisories.' },
            { key: 'SECURITY_MANAGE', label: 'Manage security findings', description: 'Change finding status and refresh security data.' },
            { key: 'DISCOVERY_VIEW', label: 'View discovery modules', description: 'Access scanner history, AI BOM, MCP, skills, and asset inventory.' },
            { key: 'DISCOVERY_RUN', label: 'Run discovery scans', description: 'Launch network, MCP, skill, repository, and AI BOM scans.' },
        ],
    },
    {
        label: 'AI Security',
        permissions: [
            { key: 'SHADOW_AI_VIEW', label: 'View Shadow AI', description: 'View Shadow AI activity, alerts, and data sources.' },
            { key: 'SHADOW_AI_MANAGE', label: 'Manage Shadow AI', description: 'Manage rules, data sources, keys, and simulations.' },
            { key: 'THREAT_MODEL_VIEW', label: 'Use Threat Modeler', description: 'Access the MAESTRO threat modeling workspace.' },
            { key: 'RED_TEAM_VIEW', label: 'View Red Teaming', description: 'Access the embedded Promptfoo red-team dashboard.' },
            { key: 'SCHEDULED_SCANS_VIEW', label: 'View scheduled scans', description: 'View scan schedules and previous run status.' },
            { key: 'SCHEDULED_SCANS_MANAGE', label: 'Manage scheduled scans', description: 'Create, run, toggle, and delete scan schedules.' },
        ],
    },
    {
        label: 'Administration',
        permissions: [
            { key: 'SETTINGS_MANAGE', label: 'Manage settings', description: 'Manage integrations, API keys, and system settings.' },
            { key: 'USERS_MANAGE', label: 'Manage users', description: 'Create users, assign roles, revoke sessions, and deactivate accounts.' },
            { key: 'ROLES_MANAGE', label: 'Manage role permissions', description: 'Configure which capabilities each role can access.' },
        ],
    },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    ADMIN: [...PERMISSIONS],
    ANALYST: PERMISSIONS.filter((permission) => ![
        'CREDENTIALS_VIEW',
        'SETTINGS_MANAGE',
        'USERS_MANAGE',
        'ROLES_MANAGE',
    ].includes(permission)),
    VIEWER: [
        'DASHBOARD_VIEW',
        'WORKFLOWS_VIEW',
        'EXECUTIONS_VIEW',
        'SECURITY_VIEW',
        'DISCOVERY_VIEW',
        'SHADOW_AI_VIEW',
    ],
};

export const ROLE_LABELS: Record<UserRole, string> = {
    ADMIN: 'Administrator',
    ANALYST: 'Analyst',
    VIEWER: 'Viewer',
};

export function isUserRole(value: string): value is UserRole {
    return ROLES.includes(value as UserRole);
}

function isPath(pathname: string, prefix: string) {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function canAccessPath(role: UserRole, pathname: string, grantedPermissions = DEFAULT_ROLE_PERMISSIONS[role]) {
    if (isPath(pathname, '/login') || isPath(pathname, '/unauthorized') || isPath(pathname, '/account')) {
        return true;
    }

    const permissions = new Set(grantedPermissions);
    if (pathname === '/') return permissions.has('DASHBOARD_VIEW');
    if (isPath(pathname, '/users')) return permissions.has('USERS_MANAGE');
    if (isPath(pathname, '/roles')) return permissions.has('ROLES_MANAGE');
    if (isPath(pathname, '/settings')) return permissions.has('SETTINGS_MANAGE');
    if (isPath(pathname, '/credentials')) return permissions.has('CREDENTIALS_VIEW');
    if (isPath(pathname, '/executions')) return permissions.has('EXECUTIONS_VIEW');
    if (isPath(pathname, '/workflows') || isPath(pathname, '/workflow-inventory') || isPath(pathname, '/webhooks')) {
        return permissions.has('WORKFLOWS_VIEW');
    }
    if (isPath(pathname, '/security') || isPath(pathname, '/n8n-security')) return permissions.has('SECURITY_VIEW');
    if (isPath(pathname, '/scheduled-scans')) return permissions.has('SCHEDULED_SCANS_VIEW');
    if (isPath(pathname, '/shadow-ai')) return permissions.has('SHADOW_AI_VIEW');
    if (isPath(pathname, '/threat-modeler')) return permissions.has('THREAT_MODEL_VIEW');
    if (isPath(pathname, '/red-team')) return permissions.has('RED_TEAM_VIEW');
    if (
        isPath(pathname, '/scanner')
        || isPath(pathname, '/mcp-scanner')
        || isPath(pathname, '/skill-scanner')
        || isPath(pathname, '/ai-spotter')
        || isPath(pathname, '/aibom-scanner')
        || isPath(pathname, '/inventory')
    ) {
        return permissions.has('DISCOVERY_VIEW');
    }

    return false;
}
