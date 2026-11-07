import { NextRequest, NextResponse } from 'next/server';
import { ingestLLMRequest } from '@/lib/data-source-actions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        if (!body.sourceIp || !body.targetUrl) {
            return NextResponse.json(
                { error: 'Missing required fields: sourceIp, targetUrl' },
                { status: 400 }
            );
        }

        // Get API key from header or body
        const apiKey = request.headers.get('x-api-key') || body.apiKey;
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
        }

        // Ingest the request
        const result = await ingestLLMRequest({
            sourceIp: body.sourceIp,
            targetUrl: body.targetUrl,
            prompt: body.prompt,
            response: body.response,
            model: body.model,
            provider: body.provider,
            timestamp: body.timestamp,
            apiKey
        });

        return NextResponse.json({
            success: true,
            id: result.id,
            riskScore: result.riskScore,
            isFlagged: result.isFlagged
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to ingest request';
        console.error('Ingest error:', error);
        return NextResponse.json(
            { error: message },
            { status: message.includes('API key') ? 401 : 500 }
        );
    }
}

// Return API documentation
export async function GET() {
    return NextResponse.json({
        endpoint: '/api/shadow-ai/ingest',
        method: 'POST',
        description: 'Ingest LLM request logs from external sources',
        authentication: 'Include API key in x-api-key header or apiKey body field',
        body: {
            sourceIp: 'string (required) - Source IP of the requester',
            targetUrl: 'string (required) - Full URL of LLM API endpoint',
            prompt: 'string (optional) - Prompt content for analysis',
            response: 'string (optional) - LLM response content',
            model: 'string (optional) - Model name (e.g., gpt-4)',
            provider: 'string (optional) - Provider name (auto-detected from URL)',
            timestamp: 'string (optional) - ISO timestamp (defaults to now)',
            apiKey: 'string (optional) - API key if not in header'
        },
        response: {
            success: 'boolean',
            id: 'string - Request ID',
            riskScore: 'number - 0-100',
            isFlagged: 'boolean'
        }
    });
}
