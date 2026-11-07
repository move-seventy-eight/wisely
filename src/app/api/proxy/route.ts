import { NextRequest, NextResponse } from 'next/server';
import { ingestLLMRequest } from '@/lib/data-source-actions';
import prisma from '@/lib/db';
import dns from 'dns';
import { promisify } from 'util';
import net from 'net';

const lookup = promisify(dns.lookup);

type ProxyRequestBody = {
    messages?: unknown;
    prompt?: string;
    model?: string;
};

type ProxyResponseBody = {
    choices?: Array<{
        message?: { content?: string };
        text?: string;
    }>;
};

const MAX_TRANSFER_BYTES = 5 * 1024 * 1024; // 5 MiB hard cap on caller body and upstream response
const UPSTREAM_TIMEOUT_MS = 30_000;          // 30s timeout

// Stream-and-cap instead of buffering an unbounded body into process memory.
async function readBodyCapped(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<string> {
    if (!body) return '';
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    let text = '';
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maxBytes) {
            await reader.cancel().catch(() => {});
            throw new Error(`Payload exceeds ${maxBytes} byte limit`);
        }
        text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
}

// SSRF Guard: Validate the target address against private, loopback, and reserved ranges
function isInternalIp(raw: string): boolean {
    let v = raw.replace(/^\[(.*)\]$/, '$1').toLowerCase();
    // Unwrap IPv4-mapped IPv6 (::ffff:1.2.3.4 and ::ffff:102:304 forms)
    const dotted = v.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    const hexed = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (dotted) {
        v = dotted[1];
    } else if (hexed) {
        const hi = parseInt(hexed[1], 16);
        const lo = parseInt(hexed[2], 16);
        v = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
    }

    if (net.isIPv4(v)) {
        const o = v.split('.').map(Number);
        return (
            o[0] === 0 ||                                    // 0.0.0.0/8
            o[0] === 10 ||                                   // 10.0.0.0/8 (RFC 1918)
            o[0] === 127 ||                                  // 127.0.0.0/8 (Loopback)
            (o[0] === 100 && o[1] >= 64 && o[1] <= 127) ||   // 100.64.0.0/10 (CGNAT)
            (o[0] === 169 && o[1] === 254) ||               // 169.254.0.0/16 (Link-local)
            (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||   // 172.16.0.0/12 (RFC 1918)
            (o[0] === 192 && o[1] === 168) ||               // 192.168.0.0/16 (RFC 1918)
            (o[0] === 198 && (o[1] === 18 || o[1] === 19)) ||// 198.18.0.0/15 (Benchmarking)
            o[0] >= 224                                      // Multicast & Reserved
        );
    }

    if (net.isIPv6(v)) {
        return (
            v === '::' ||
            v === '::1' ||
            v.startsWith('fe80:') ||
            v.startsWith('fc') ||
            v.startsWith('fd')
        );
    }

    return true; // Not a parseable IP: refuse by default
}

export async function POST(req: NextRequest) {
    // 1. Validate Target URL
    const targetUrl = req.nextUrl.searchParams.get('target');
    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing target URL parameter' }, { status: 400 });
    }

    // 2. Validate API Key (x-wisely-api-key)
    const apiKey = req.headers.get('x-wisely-api-key');
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing x-wisely-api-key header' }, { status: 401 });
    }

    const source = await prisma.dataSource.findFirst({ where: { endpoint: apiKey, enabled: true } });
    if (!source) {
        return NextResponse.json({ error: 'Invalid or disabled API key' }, { status: 401 });
    }

    let parsedTarget: URL;
    try {
        parsedTarget = new URL(targetUrl);
    } catch {
        return NextResponse.json({ error: 'Invalid target URL' }, { status: 400 });
    }
    if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
        return NextResponse.json({ error: 'Unsupported target protocol' }, { status: 400 });
    }

    // SSRF Guard Step A: String checks on known metadata/loopback names
    const rawHostname = parsedTarget.hostname.toLowerCase();
    const cleanHost = rawHostname.replace(/^\[(.*)\]$/, '$1');

    if (
        rawHostname === '169.254.169.254' ||
        rawHostname.startsWith('169.254.') ||
        rawHostname === 'metadata.google.internal' ||
        rawHostname === 'instance-data' ||
        rawHostname === 'localhost' ||
        rawHostname === 'localhost.' ||
        rawHostname === '127.0.0.1' ||
        rawHostname === '::1' ||
        rawHostname === '[::1]' ||
        rawHostname === '0.0.0.0'
    ) {
        return NextResponse.json({ error: 'Requests to internal metadata or loopback destinations are forbidden' }, { status: 403 });
    }

    // SSRF Guard Step B: Resolve target hostname and refuse internal destinations at the address level
    // This catches wildcard-DNS (nip.io, sslip.io), custom DNS, internal docker names, and IP literals
    let resolved: Array<{ address: string }>;
    try {
        resolved = await lookup(cleanHost, { all: true });
    } catch {
        return NextResponse.json({ error: 'Cannot resolve target host' }, { status: 400 });
    }

    if (resolved.length === 0 || resolved.some((r) => isInternalIp(r.address))) {
        return NextResponse.json({ error: 'Requests to internal metadata or loopback destinations are forbidden' }, { status: 403 });
    }

    try {
        // 3. Read Request Body (Capped at 5 MiB to prevent memory exhaustion DoS)
        const bodyText = await readBodyCapped(req.body, MAX_TRANSFER_BYTES);
        let bodyJson: ProxyRequestBody = {};
        try {
            bodyJson = JSON.parse(bodyText) as ProxyRequestBody;
        } catch {
            // Body might not be JSON, ignore
        }

        // 4. Forward Request to Target
        // SSRF: redirect 'error' ensures 3xx redirects cannot bounce into internal targets
        // Timeout: AbortSignal.timeout ensures slow-drip requests do not hang worker slots
        const upstreamResponse = await fetch(targetUrl, {
            method: 'POST',
            redirect: 'error',
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('Authorization') || '',
            },
            body: bodyText
        });

        // 5. Read Upstream Response (Capped at 5 MiB to prevent memory exhaustion DoS)
        const responseText = await readBodyCapped(upstreamResponse.body, MAX_TRANSFER_BYTES);

        let responseJson: ProxyResponseBody = {};
        try {
            responseJson = JSON.parse(responseText) as ProxyResponseBody;
        } catch {
            // Response might not be JSON
        }

        // 6. Build Log Data
        // Extract prompt/response based on common schemas (OpenAI-like)
        const prompt = bodyJson.messages
            ? JSON.stringify(bodyJson.messages)
            : (bodyJson.prompt || bodyText.slice(0, 500));

        const responseContent = responseJson.choices?.[0]?.message?.content
            || responseJson.choices?.[0]?.text
            || responseText.slice(0, 500);

        const model = bodyJson.model || 'unknown';

        // 7. Async Ingest
        await ingestLLMRequest({
            sourceIp: req.headers.get('x-forwarded-for') || 'unknown',
            targetUrl,
            prompt,
            response: responseContent,
            model,
            apiKey,
            timestamp: new Date().toISOString()
        }).catch(err => console.error("Failed to ingest LLM request:", err));

        // 8. Return Response to Client
        return new NextResponse(responseText, {
            status: upstreamResponse.status,
            headers: {
                'Content-Type': upstreamResponse.headers.get('Content-Type') || 'application/json'
            }
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Proxy Error:', error);
        return NextResponse.json({ error: 'Proxy execution failed', details: message }, { status: 500 });
    }
}
