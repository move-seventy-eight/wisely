import { N8nWorkflow } from './types';

// Severity scoring for risk calculation
const SEVERITY_WEIGHTS: Record<string, number> = {
    critical: 25,
    high: 15,
    medium: 8,
    low: 3
};

// Helper to analyze workflow for security issues
export function analyzeWorkflow(workflow: N8nWorkflow): any[] {
    const issues: any[] = [];

    if (!workflow.nodes) return issues;

    workflow.nodes.forEach((node, index) => {
        const parameters = node.parameters || {};
        const paramsStr = JSON.stringify(parameters).toLowerCase();
        const nodeTypeLower = node.type.toLowerCase();

        // ─── 1. SQL Injection ───
        if (nodeTypeLower.includes('postgres') || nodeTypeLower.includes('mysql') || nodeTypeLower.includes('sql') || nodeTypeLower.includes('oracle') || nodeTypeLower.includes('database') || nodeTypeLower.includes('mssql') || nodeTypeLower.includes('sqlite') || nodeTypeLower.includes('mariadb')) {
            const query = parameters.query || parameters.operation || '';
            if (typeof query === 'string') {
                const hasVariable = query.includes('{{') || query.includes('$json') || query.includes('$node');
                const isParameterized = query.includes('$1') || query.includes('?') || query.includes(':');
                if (hasVariable && !isParameterized) {
                    issues.push({
                        type: 'sql_injection_risk',
                        severity: 'critical',
                        nodeName: node.name,
                        nodeId: node.id,
                        index,
                        message: `Potential SQL Injection: Node uses raw variable substitution in SQL query without parameterization.`,
                        solution: `Use parameterized queries (e.g., $1, $2 or :name) instead of direct string concatenation or variable substitution.`
                    });
                }
            }
        }

        // ─── 2. Remote Code Execution (RCE) ───
        if (node.type === 'n8n-nodes-base.executeCommand') {
            const cmd = parameters.command || '';
            const hasUserInput = typeof cmd === 'string' && (cmd.includes('{{') || cmd.includes('$json') || cmd.includes('$node'));
            issues.push({
                type: 'rce_risk',
                severity: hasUserInput ? 'critical' : 'high',
                nodeName: node.name,
                nodeId: node.id,
                index,
                message: hasUserInput
                    ? `Critical RCE: 'Execute Command' node injects user-controlled data into shell command.`
                    : `Use of 'Execute Command' node detected — potential remote code execution risk.`,
                solution: `Avoid using 'Execute Command' if possible. If necessary, strictly validate and sanitize all inputs. Never interpolate user data directly into shell commands.`
            });
        }

        // ─── 3. Unauthenticated Webhook / Trigger ───
        if (nodeTypeLower.includes('webhook') || (nodeTypeLower.includes('trigger') && !nodeTypeLower.includes('cron') && !nodeTypeLower.includes('interval'))) {
            const auth = parameters.authentication || 'none';
            if (auth === 'none') {
                issues.push({
                    type: 'unauthenticated_webhook',
                    severity: 'high',
                    nodeName: node.name,
                    nodeId: node.id,
                    index,
                    message: `Webhook/trigger is publicly accessible without authentication.`,
                    solution: `Enable authentication (Basic Auth, Header Auth, or JWT) in the webhook node settings to restrict access.`
                });
            }
        }

        // ─── 4. Hardcoded Credentials ───
        if (paramsStr.includes('password') || paramsStr.includes('api_key') || paramsStr.includes('apikey') || paramsStr.includes('bearer') || paramsStr.includes('secret') || paramsStr.includes('token')) {
            if (!paramsStr.includes('={{') && (paramsStr.includes('123') || paramsStr.includes('admin') || paramsStr.includes('password') || paramsStr.length > 20)) {
                // Check for actual string values that look like secrets
                const suspiciousPatterns = /["'](sk-|ghp_|glpat-|xox[baprs]-|eyJ|AKIA)[a-zA-Z0-9\-_]{8,}/;
                const hasSuspiciousValue = suspiciousPatterns.test(JSON.stringify(parameters));

                issues.push({
                    type: 'hardcoded_credentials',
                    severity: hasSuspiciousValue ? 'critical' : 'high',
                    nodeName: node.name,
                    nodeId: node.id,
                    index,
                    message: hasSuspiciousValue
                        ? `Hardcoded API key or token detected in node parameters.`
                        : `Potential hardcoded credentials detected in node parameters.`,
                    solution: `Move sensitive credentials to n8n Credentials store or use environment variables. Do not hardcode secrets in node parameters.`
                });
            }
        }

        // ─── 5. External LLM Policy Violation ───
        const externalLLMs = ['openAi', 'anthropic', 'chatGpt', 'googlePaLM', 'vertexAi', 'cohere', 'azure', 'gemini', 'mistral', 'huggingFace', 'replicate', 'groq', 'perplexity', 'deepseek'];
        const isExternalLLM = externalLLMs.some(llm => nodeTypeLower.includes(llm.toLowerCase()));
        if (isExternalLLM) {
            issues.push({
                type: 'external_llm_policy_violation',
                severity: 'high',
                nodeName: node.name,
                nodeId: node.id,
                index,
                message: `External LLM Service Detected. Usage of public AI services (${node.type}) may violate data privacy policies.`,
                solution: `Replace with a self-hosted Local AI model (e.g., Ollama, LocalAI) to ensure data privacy and compliance.`
            });
        }

        // ─── 6. SSRF Risk (HTTP Request with dynamic URL) ───
        if (node.type === 'n8n-nodes-base.httpRequest' || nodeTypeLower.includes('httprequest')) {
            const url = parameters.url || '';
            if (typeof url === 'string' && (url.includes('{{') || url.includes('$json') || url.includes('$node'))) {
                issues.push({
                    type: 'ssrf_risk',
                    severity: 'high',
                    nodeName: node.name,
                    nodeId: node.id,
                    index,
                    message: `Server-Side Request Forgery (SSRF) risk: HTTP Request URL is built from user-controlled data.`,
                    solution: `Validate and whitelist allowed domains/IPs before making HTTP requests. Never allow arbitrary URLs from user input without strict validation.`
                });
            }
            // Check for disabled SSL verification
            if (parameters.options?.allowUnauthorizedCerts === true || parameters.options?.rejectUnauthorizedCerts === false) {
                issues.push({
                    type: 'ssl_verification_disabled',
                    severity: 'medium',
                    nodeName: node.name,
                    nodeId: node.id,
                    index,
                    message: `SSL certificate verification is disabled on HTTP request — vulnerable to man-in-the-middle attacks.`,
                    solution: `Enable SSL certificate verification unless connecting to trusted internal services with self-signed certificates.`
                });
            }
        }

        // ─── 7. Code Execution Node ───
        if (node.type === 'n8n-nodes-base.code' || node.type === 'n8n-nodes-base.function' || node.type === 'n8n-nodes-base.functionItem') {
            const code = parameters.jsCode || parameters.functionCode || parameters.code || '';
            if (typeof code === 'string') {
                // Check for dangerous patterns in code
                const dangerousPatterns = [
                    { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, name: 'child_process import' },
                    { pattern: /require\s*\(\s*['"]fs['"]\s*\)/, name: 'filesystem access' },
                    { pattern: /eval\s*\(/, name: 'eval() usage' },
                    { pattern: /process\.env/, name: 'environment variable access' },
                    { pattern: /fetch\s*\(|axios|https?\:\/\//, name: 'external network request' },
                    { pattern: /exec\s*\(|spawn\s*\(/, name: 'shell command execution' },
                ];
                dangerousPatterns.forEach(dp => {
                    if (dp.pattern.test(code)) {
                        issues.push({
                            type: 'dangerous_code_pattern',
                            severity: dp.name.includes('child_process') || dp.name.includes('eval') || dp.name.includes('shell') ? 'critical' : 'high',
                            nodeName: node.name,
                            nodeId: node.id,
                            index,
                            message: `Dangerous code pattern detected: ${dp.name} in Code/Function node.`,
                            solution: `Review and minimize the use of dangerous APIs. Use n8n built-in nodes instead of custom code when possible. Restrict code node capabilities in production.`
                        });
                    }
                });
            }
        }

        // ─── 8. File System Access ───
        if (node.type === 'n8n-nodes-base.readBinaryFiles' || node.type === 'n8n-nodes-base.writeBinaryFile' || node.type === 'n8n-nodes-base.readWriteFile') {
            const filePath = parameters.filePath || parameters.fileName || '';
            if (typeof filePath === 'string' && (filePath.includes('{{') || filePath.includes('$json'))) {
                issues.push({
                    type: 'path_traversal_risk',
                    severity: 'high',
                    nodeName: node.name,
                    nodeId: node.id,
                    index,
                    message: `Path traversal risk: File path is constructed from user-controlled input.`,
                    solution: `Validate and sanitize file paths. Use allowlists for permitted directories and prevent '../' traversal sequences.`
                });
            }
        }

        // ─── 9. Email / Notification Nodes with Dynamic Recipients ───
        if (nodeTypeLower.includes('email') || nodeTypeLower.includes('sendgrid') || nodeTypeLower.includes('mailgun') || node.type === 'n8n-nodes-base.send') {
            const to = parameters.to || parameters.toEmail || '';
            if (typeof to === 'string' && (to.includes('{{') || to.includes('$json'))) {
                issues.push({
                    type: 'email_injection_risk',
                    severity: 'medium',
                    nodeName: node.name,
                    nodeId: node.id,
                    index,
                    message: `Email injection risk: recipient address uses dynamic user input — could be used for spam or phishing.`,
                    solution: `Validate email recipients against an allowlist. Don't allow arbitrary email addresses from user input.`
                });
            }
        }

        // ─── 10. SSH / FTP Nodes ───
        if (nodeTypeLower.includes('ssh') || nodeTypeLower.includes('ftp') || nodeTypeLower.includes('sftp')) {
            issues.push({
                type: 'remote_access_node',
                severity: 'medium',
                nodeName: node.name,
                nodeId: node.id,
                index,
                message: `Remote access protocol (SSH/FTP) node detected — ensure credentials are properly managed.`,
                solution: `Use n8n credential store for SSH/FTP credentials. Restrict target hosts. Enable key-based authentication instead of passwords where possible.`
            });
        }

        // ─── 11. NoOp / Set Node Data Exposure ───
        if (node.type === 'n8n-nodes-base.set') {
            const values = parameters.values || {};
            const valStr = JSON.stringify(values);
            if (valStr.includes('password') || valStr.includes('secret') || valStr.includes('token') || valStr.includes('api_key')) {
                issues.push({
                    type: 'sensitive_data_in_set_node',
                    severity: 'medium',
                    nodeName: node.name,
                    nodeId: node.id,
                    index,
                    message: `Sensitive data field names (password/secret/token) found in Set node — data may be exposed in workflow logs.`,
                    solution: `Use n8n Credentials store for sensitive values. Avoid passing secrets through Set node data fields as they appear in execution logs.`
                });
            }
        }

        // ─── 12. Unencrypted HTTP (non-HTTPS) connections ───
        if (node.type === 'n8n-nodes-base.httpRequest' || nodeTypeLower.includes('httprequest')) {
            const url = parameters.url || '';
            if (typeof url === 'string' && url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1') && !url.includes('10.') && !url.includes('192.168.')) {
                issues.push({
                    type: 'unencrypted_connection',
                    severity: 'medium',
                    nodeName: node.name,
                    nodeId: node.id,
                    index,
                    message: `Unencrypted HTTP connection to external host — data transmitted in plain text.`,
                    solution: `Use HTTPS instead of HTTP for external connections to prevent eavesdropping and man-in-the-middle attacks.`
                });
            }
        }

        // ─── 13. GraphQL Injection ───
        if (nodeTypeLower.includes('graphql')) {
            const query = parameters.query || '';
            if (typeof query === 'string' && (query.includes('{{') || query.includes('$json'))) {
                issues.push({
                    type: 'graphql_injection_risk',
                    severity: 'high',
                    nodeName: node.name,
                    nodeId: node.id,
                    index,
                    message: `GraphQL injection risk: query contains user-controlled variables without proper parameterization.`,
                    solution: `Use GraphQL variables instead of string interpolation. Pass user input through properly typed GraphQL variables.`
                });
            }
        }

        // ─── 14. XML Processing (XXE Risk) ───
        if (nodeTypeLower.includes('xml') || (node.type === 'n8n-nodes-base.httpRequest' && paramsStr.includes('xml'))) {
            issues.push({
                type: 'xxe_risk',
                severity: 'medium',
                nodeName: node.name,
                nodeId: node.id,
                index,
                message: `XML processing detected — potential XML External Entity (XXE) injection risk.`,
                solution: `Ensure XML parser has external entity processing disabled. Validate and sanitize XML input before processing.`
            });
        }

        // ─── 15. Cron/Schedule with High Frequency ───
        if (nodeTypeLower.includes('cron') || nodeTypeLower.includes('interval') || nodeTypeLower.includes('schedule')) {
            const cronExpr = parameters.cronExpression || parameters.rule?.cronExpression || '';
            const interval = parameters.interval || parameters.value || 0;
            if ((typeof interval === 'number' && interval < 60) || (typeof cronExpr === 'string' && cronExpr.includes('* * *'))) {
                issues.push({
                    type: 'high_frequency_trigger',
                    severity: 'low',
                    nodeName: node.name,
                    nodeId: node.id,
                    index,
                    message: `High-frequency scheduled trigger detected — may cause excessive resource consumption or rate limiting.`,
                    solution: `Review the trigger interval. Consider if such frequent execution is necessary. Increase interval to reduce load.`
                });
            }
        }
    });

    // ─── Global: Secret Leak Detection ───
    const fullJsonStr = JSON.stringify(workflow);
    const secretPatterns = [
        { regex: /sk-ant-api[a-zA-Z0-9\-_]{40,}/g, name: 'Anthropic API Key' },
        { regex: /sk-proj-[a-zA-Z0-9\-_]{40,}/g, name: 'OpenAI Project Key' },
        { regex: /sk-[a-zA-Z0-9]{40,}/g, name: 'Generic OpenAI/API Key' },
        { regex: /xox[baprs]-[a-zA-Z0-9]{10,}/g, name: 'Slack Token' },
        { regex: /ghp_[a-zA-Z0-9]{36,}/g, name: 'GitHub PAT' },
        { regex: /glpat-[a-zA-Z0-9\-_]{20,}/g, name: 'GitLab PAT' },
        { regex: /AKIA[A-Z0-9]{16}/g, name: 'AWS Access Key' },
        { regex: /eyJ[a-zA-Z0-9\-_=]+\.eyJ[a-zA-Z0-9\-_=]+\.[a-zA-Z0-9\-_=]+/g, name: 'JWT Token' },
        { regex: /(?:bearer|api_key|password)["'\s:]+([a-zA-Z0-9\-_\.=]{16,})/gi, name: 'Generic Token or Password' }
    ];

    secretPatterns.forEach(pattern => {
        const matches = fullJsonStr.match(pattern.regex);
        if (matches) {
            const isBearerOrGeneric = pattern.name === 'Generic Token or Password';
            let validMatches: string[] = Array.from(matches);
            if (isBearerOrGeneric) {
                validMatches = validMatches.filter(m => !m.includes('{{') && !m.includes('$json'));
            }
            if (validMatches && validMatches.length > 0) {
                issues.push({
                    type: 'global_secret_leak',
                    severity: 'critical',
                    nodeName: 'Global/Unknown',
                    nodeId: 'workflow-level',
                    index: -1,
                    message: `Hardcoded ${pattern.name} detected in workflow JSON payload.`,
                    solution: `Extract the secret to n8n Credentials or Environment variables immediately and rotate the compromised key.`
                });
            }
        }
    });

    return issues;
}

/**
 * Calculate risk score from issues (0-100).
 */
export function calculateRiskScore(issues: any[]): number {
    if (issues.length === 0) return 0;
    let score = 0;
    issues.forEach(issue => {
        score += SEVERITY_WEIGHTS[issue.severity] ?? 5;
    });
    return Math.min(100, score);
}
