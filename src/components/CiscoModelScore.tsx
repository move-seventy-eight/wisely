import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    CISCO_LEADERBOARD_URL,
    CiscoModelScoreMatch,
    CiscoSecurityGrade,
} from '@/lib/cisco-leaderboard';

const gradeClasses: Record<CiscoSecurityGrade, string> = {
    Excellent: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    Good: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
    Fair: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    Poor: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
};

export function CiscoModelScore({
    match,
    leaderboardAvailable,
    compact = false,
}: {
    match?: CiscoModelScoreMatch | null;
    leaderboardAvailable: boolean;
    compact?: boolean;
}) {
    if (!leaderboardAvailable) {
        return <span className="text-xs text-muted-foreground">Unavailable</span>;
    }

    if (!match) {
        return (
            <Badge variant="outline" className="whitespace-nowrap text-[10px] font-normal text-muted-foreground">
                Not ranked
            </Badge>
        );
    }

    const title = `${match.model} — Combined ${match.combined_score.toFixed(1)}, single-turn ${match.validation_score.toFixed(1)}, multi-turn ${match.multi_turn_resistance.toFixed(1)}, rank #${match.rank}`;

    return (
        <div className="space-y-1" title={title}>
            <a
                href={CISCO_LEADERBOARD_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1"
            >
                <Badge variant="outline" className={`whitespace-nowrap ${gradeClasses[match.grade]}`}>
                    {match.combined_score.toFixed(1)} {match.grade}
                </Badge>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
            {!compact && (
                <p className="whitespace-nowrap text-[10px] text-muted-foreground">
                    ST {match.validation_score.toFixed(1)} · MT {match.multi_turn_resistance.toFixed(1)} · #{match.rank}
                </p>
            )}
        </div>
    );
}
