'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { importWorkflow } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function ImportWorkflowButton() {
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);

        try {
            const text = await file.text();
            const result = await importWorkflow(text);

            if (result.success) {
                toast.success('Import Successful', {
                    description: `Successfully imported ${result.count} workflow(s).`,
                });
                router.refresh(); // Refresh the page to show the new workflow
            } else {
                toast.error('Import Failed', {
                    description: result.error || 'Failed to import workflow.',
                });
            }
        } catch (error: any) {
            toast.error('Import Error', {
                description: error.message || 'An error occurred during import.',
            });
        } finally {
            setIsImporting(false);
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <>
            <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
            />
            <Button
                variant="outline"
                className="gap-2 bg-background border-none shadow-sm"
                onClick={handleImportClick}
                disabled={isImporting}
            >
                <Upload className="h-4 w-4" />
                {isImporting ? 'Importing...' : 'Import JSON'}
            </Button>
        </>
    );
}
