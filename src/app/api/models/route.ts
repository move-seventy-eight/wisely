import { NextResponse } from "next/server";
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
    if (!await getCurrentUser()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({
        models: [
            { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI", type: "llm" },
            { id: "claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic", type: "llm" },
            { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Google", type: "llm" },
            { id: "llama-3-70b", name: "Llama 3 70B", provider: "Meta", type: "llm" },
        ]
    });
}
