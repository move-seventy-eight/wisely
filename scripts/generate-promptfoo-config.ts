import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import prisma from '../src/lib/db';
import { generateWebhookPayloads } from '../src/lib/webhook-payload';

async function generateConfig() {
    try {
        console.log('Fetching N8N webhooks from database...');
        const webhooks = await prisma.webhook.findMany({
            where: { active: true },
            include: { workflow: true }
        });

        console.log(`Found ${webhooks.length} active webhooks.`);

        const configDir = path.join(process.cwd(), '.promptfoo');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        const configPath = path.join(configDir, 'promptfooconfig.yaml');
        let config: any = {};

        // Read existing config if it exists so we don't blow away properties like `prompts` or `tests`
        if (fs.existsSync(configPath)) {
            config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
        }

        // Initialize providers array
        config.providers = [];

        // Add each webhook as an HTTP provider with its real parameters
        for (const webhook of webhooks) {
            const targetUrl = webhook.prodUrl || webhook.testUrl;
            if (!targetUrl) continue;

            const payload = generateWebhookPayloads(webhook as any);
            const promptfooBody: Record<string, string> = {};

            if (payload.params.bodyParams.length > 0) {
                for (const p of payload.params.bodyParams) {
                    promptfooBody[p] = '{{prompt}}';
                }
            } else {
                promptfooBody['prompt'] = '{{prompt}}';
                promptfooBody['text'] = '{{prompt}}';
                promptfooBody['message'] = '{{prompt}}';
                promptfooBody['input'] = '{{prompt}}';
            }

            config.providers.push({
                id: 'http',
                label: `N8N: ${webhook.nodeName} (${webhook.workflow?.name || 'Unknown'})`,
                config: {
                    url: payload.url,
                    method: payload.method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: promptfooBody,
                    responseParser: 'json.output || json.response || json.message || json.result || json.data || JSON.stringify(json)'
                }
            });
        }

        // Write the updated config back to the file
        fs.writeFileSync(configPath, yaml.stringify(config), 'utf8');
        console.log('Successfully generated promptfooconfig.yaml with webhook targets!');
    } catch (error) {
        console.error('Failed to generate promptfooconfig.yaml:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

generateConfig();
