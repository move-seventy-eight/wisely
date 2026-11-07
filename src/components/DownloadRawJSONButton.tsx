'use client';

import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';

interface DownloadRawJSONButtonProps {
    data: any;
    filename: string;
}

export function DownloadRawJSONButton({ data, filename }: DownloadRawJSONButtonProps) {
    const handleDownload = () => {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
        >
            <FileDown className="h-4 w-4 mr-2" />
            Download JSON
        </Button>
    );
}
