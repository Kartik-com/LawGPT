import React from 'react';
import { cn } from '@/lib/utils';

interface HearingTooltipProps {
    caseNumber: string;
    hearingType: string;
    time: string;
    timezone: string;
    courtName: string;
    onViewCase: () => void;
    hasConflict?: boolean;
    conflicts?: Array<{
        caseNumber: string;
        time: string;
        reason: string;
    }>;
}

export const HearingTooltip: React.FC<HearingTooltipProps> = ({
    caseNumber,
    hearingType,
    time,
    timezone,
    courtName,
    onViewCase,
    hasConflict = false,
    conflicts = []
}) => {
    const formatHearingType = (type: string) => {
        return type
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    return (
        <div
            className="bg-popover text-popover-foreground rounded-lg shadow-lg border p-3 min-w-[250px] max-w-[320px]"
            role="tooltip"
            aria-live="polite"
        >
            {hasConflict && (
                <div className="mb-2 pb-2 border-b border-destructive/20">
                    <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                        <span>Scheduling Conflict</span>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <div>
                    <div className="text-xs text-muted-foreground">Case Number</div>
                    <div className="font-semibold">{caseNumber}</div>
                </div>

                <div>
                    <div className="text-xs text-muted-foreground">Hearing Type</div>
                    <div className="text-sm">{formatHearingType(hearingType)}</div>
                </div>

                <div>
                    <div className="text-xs text-muted-foreground">Time</div>
                    <div className="text-sm font-medium">
                        {time} ({timezone})
                    </div>
                </div>

                <div>
                    <div className="text-xs text-muted-foreground">Court</div>
                    <div className="text-sm">{courtName}</div>
                </div>

                {hasConflict && conflicts.length > 0 && (
                    <div className="pt-2 border-t">
                        <div className="text-xs text-muted-foreground mb-1">Conflicts with:</div>
                        <div className="space-y-1">
                            {conflicts.map((conflict, idx) => (
                                <div key={idx} className="text-xs bg-destructive/10 rounded p-1.5">
                                    <div className="font-medium">{conflict.caseNumber}</div>
                                    <div className="text-muted-foreground">{conflict.time}</div>
                                    <div className="text-destructive text-[10px]">({conflict.reason})</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    onClick={onViewCase}
                    className="w-full mt-2 text-sm text-primary hover:text-primary/80 font-medium flex items-center justify-center gap-1 py-1.5 px-3 rounded-md hover:bg-primary/10 transition-colors"
                >
                    View Case Details
                    <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
};
