export type CredentialSecurityRating = 'strong' | 'moderate' | 'weak' | 'critical';

export type CredentialFindingKind = 'strength' | 'risk' | 'info';

export interface CredentialSecurityFinding {
    kind: CredentialFindingKind;
    title: string;
    description: string;
}

export interface CredentialWorkflowContext {
    active: boolean;
    riskScore: number;
}

export interface CredentialSecurityInput {
    type: string;
    environmentBaseUrl: string;
    workflows: CredentialWorkflowContext[];
}

export interface CredentialSecurityAssessment {
    score: number;
    rating: CredentialSecurityRating;
    findings: CredentialSecurityFinding[];
    recommendations: string[];
}

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

function getRating(score: number): CredentialSecurityRating {
    if (score >= 85) return 'strong';
    if (score >= 70) return 'moderate';
    if (score >= 50) return 'weak';
    return 'critical';
}

export function assessCredentialSecurity(input: CredentialSecurityInput): CredentialSecurityAssessment {
    const findings: CredentialSecurityFinding[] = [];
    const recommendations: string[] = [];
    const normalizedType = input.type.toLowerCase();
    const workflowCount = input.workflows.length;
    const activeWorkflowCount = input.workflows.filter((workflow) => workflow.active).length;
    const highestWorkflowRisk = input.workflows.reduce(
        (highest, workflow) => Math.max(highest, workflow.riskScore || 0),
        0,
    );
    let score = 78;

    // Credentials discovered here are references from n8n's encrypted credential store;
    // Wisely never reads or persists the underlying secret material.
    score += 7;
    findings.push({
        kind: 'strength',
        title: 'Secret remains in the n8n credential store',
        description: 'Wisely evaluates metadata only and never fetches or stores the underlying secret value.',
    });

    const isHttps = input.environmentBaseUrl.toLowerCase().startsWith('https://');
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(input.environmentBaseUrl);
    if (isHttps) {
        score += 7;
        findings.push({
            kind: 'strength',
            title: 'Encrypted transport',
            description: 'The connected n8n environment uses HTTPS, reducing credential exposure in transit.',
        });
    } else if (isLocal) {
        findings.push({
            kind: 'info',
            title: 'Local HTTP environment',
            description: 'The environment is local. Use HTTPS if it becomes reachable from another host.',
        });
    } else {
        score -= 20;
        findings.push({
            kind: 'risk',
            title: 'Unencrypted environment connection',
            description: 'The n8n environment does not use HTTPS, which can expose authentication traffic in transit.',
        });
        recommendations.push('Enable HTTPS with a trusted certificate for the n8n environment.');
    }

    const usesOAuth = normalizedType.includes('oauth');
    const usesAsymmetricAuth = /(certificate|privatekey|sshkey|serviceaccount)/.test(normalizedType);
    const usesPassword = /(basic|password|userpass)/.test(normalizedType);
    const usesStaticToken = /(api|token|header|bearer)/.test(normalizedType);

    if (usesOAuth) {
        score += 8;
        findings.push({
            kind: 'strength',
            title: 'OAuth-based authentication',
            description: 'OAuth supports scoped and revocable access instead of sharing a primary account password.',
        });
        recommendations.push('Verify that OAuth scopes follow least privilege and refresh tokens are rotated.');
    } else if (usesAsymmetricAuth) {
        score += 8;
        findings.push({
            kind: 'strength',
            title: 'Key or certificate-based authentication',
            description: 'Asymmetric credentials generally reduce reliance on reusable passwords.',
        });
        recommendations.push('Protect private keys with restricted file permissions and a documented rotation policy.');
    } else if (usesPassword) {
        score -= 12;
        findings.push({
            kind: 'risk',
            title: 'Reusable password authentication',
            description: 'Password-based credentials have a higher replay and sharing risk than scoped tokens or OAuth.',
        });
        recommendations.push('Prefer OAuth, a scoped token, or key-based authentication when the target service supports it.');
    } else if (usesStaticToken) {
        score -= 6;
        findings.push({
            kind: 'info',
            title: 'Potentially long-lived token',
            description: 'API keys and bearer tokens are commonly long-lived and require explicit rotation and revocation controls.',
        });
        recommendations.push('Use a least-privilege token and define an expiration or rotation schedule.');
    } else {
        score -= 4;
        findings.push({
            kind: 'info',
            title: 'Authentication properties are not observable',
            description: 'This credential type does not expose enough metadata to verify scope, expiration, or rotation.',
        });
        recommendations.push('Document the credential owner, granted permissions, expiration, and rotation policy.');
    }

    if (workflowCount === 0) {
        score -= 20;
        findings.push({
            kind: 'risk',
            title: 'Orphaned credential',
            description: 'No synchronized workflow currently references this credential, so it may no longer be required.',
        });
        recommendations.push('Confirm ownership and revoke or remove this credential if it is no longer needed.');
    } else if (workflowCount === 1) {
        score += 5;
        findings.push({
            kind: 'strength',
            title: 'Limited blast radius',
            description: 'Only one workflow references this credential.',
        });
    } else if (workflowCount <= 4) {
        score -= 4;
        findings.push({
            kind: 'info',
            title: 'Shared credential',
            description: `${workflowCount} workflows share this credential, increasing the impact of compromise or revocation.`,
        });
        recommendations.push('Use separate credentials for workflows with different owners, trust levels, or permission needs.');
    } else {
        const isWidelyShared = workflowCount >= 10;
        score -= isWidelyShared ? 22 : 12;
        findings.push({
            kind: 'risk',
            title: isWidelyShared ? 'Very large blast radius' : 'Large blast radius',
            description: `${workflowCount} workflows share this credential. A single compromise could affect every consumer.`,
        });
        recommendations.push('Split this credential by application, owner, and privilege boundary to reduce blast radius.');
    }

    if (workflowCount > 0 && activeWorkflowCount === 0) {
        score -= 6;
        findings.push({
            kind: 'info',
            title: 'Used only by inactive workflows',
            description: 'All known consumers are inactive, which may indicate a stale credential.',
        });
        recommendations.push('Review whether inactive workflow credentials can be disabled until they are needed again.');
    }

    if (highestWorkflowRisk >= 75) {
        score -= 18;
        findings.push({
            kind: 'risk',
            title: 'Exposed to a critical-risk workflow',
            description: `A consuming workflow has a risk score of ${highestWorkflowRisk}, increasing the chance of credential misuse.`,
        });
        recommendations.push('Remediate the highest-risk consuming workflow and rotate this credential after remediation.');
    } else if (highestWorkflowRisk >= 40) {
        score -= 10;
        findings.push({
            kind: 'risk',
            title: 'Exposed to a high-risk workflow',
            description: `A consuming workflow has a risk score of ${highestWorkflowRisk}.`,
        });
        recommendations.push('Review the security findings of every workflow that uses this credential.');
    } else if (highestWorkflowRisk > 0) {
        score -= 5;
        findings.push({
            kind: 'info',
            title: 'Consumer workflow findings detected',
            description: `The highest risk score among consuming workflows is ${highestWorkflowRisk}.`,
        });
        recommendations.push('Resolve related workflow findings and reassess the credential afterward.');
    }

    const finalScore = clampScore(score);

    return {
        score: finalScore,
        rating: getRating(finalScore),
        findings,
        recommendations: Array.from(new Set(recommendations)),
    };
}
