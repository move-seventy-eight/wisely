import { useState, useEffect } from 'react';
import { CustomPattern } from '@/lib/secret-scanner';
import { getGlobalCustomPatterns, saveGlobalCustomPatterns } from '@/lib/settings-actions';

export function useCustomPatterns() {
    const [patterns, setPatternsState] = useState<CustomPattern[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function loadPatterns() {
            setLoading(true);
            try {
                const dbPatterns = await getGlobalCustomPatterns();
                if (mounted) {
                    setPatternsState(dbPatterns);
                }
            } catch (e) {
                console.error("Failed to load global custom patterns", e);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadPatterns();

        return () => { mounted = false; };
    }, []);

    const setPatterns = async (newPatternsFunc: CustomPattern[] | ((prev: CustomPattern[]) => CustomPattern[])) => {
        let nextPatterns: CustomPattern[] = [];

        setPatternsState(prev => {
            nextPatterns = typeof newPatternsFunc === 'function' ? newPatternsFunc(prev) : newPatternsFunc;
            return nextPatterns;
        });

        try {
            // Save to DB in background
            await saveGlobalCustomPatterns(nextPatterns);
        } catch (e) {
            console.error("Failed to save global custom patterns", e);
        }
    };

    return [patterns, setPatterns, loading] as const;
}
