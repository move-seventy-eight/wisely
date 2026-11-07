"use client";
import dynamic from 'next/dynamic';

const ThreatModelCanvas = dynamic(
    () => import('@/components/threat-modeler/ThreatModelCanvas'),
    { ssr: false }
);

import { use } from 'react';

// Metadata should be exported from a separate layout or server component if needed.

export default function ThreatModelerPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
    const params = use(searchParams);
    const templateParam = params.template;

    return (
        <div className="h-screen w-full flex flex-col items-stretch overflow-hidden">
            {/* Minimal header integrating with Wisely */}
            <div className="h-10 flex items-center justify-between px-4 border-b bg-background/95 backdrop-blur-sm shrink-0 w-full z-10 relative">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <div className="rounded-sm bg-primary p-0.5">
                            <div className="h-4 w-4 text-primary-foreground font-bold flex items-center justify-center text-[10px]">
                                AI
                            </div>
                        </div>
                        <span className="font-bold text-sm">Threat Modeler</span>
                    </div>
                    <span className="text-xs text-muted-foreground">|</span>
                    <span className="text-xs text-muted-foreground">
                        MAESTRO 7-Layer Analysis for Agentic AI
                    </span>
                </div>
            </div>

            {/* Full-height structural canvas */}
            <div className="flex-[1_1_100%] relative w-full overflow-hidden isolate">
                <ThreatModelCanvas initialTemplate={templateParam} />
            </div>
        </div>
    );
}
