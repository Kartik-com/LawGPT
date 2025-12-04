import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface ConflictDialogProps {
    isOpen: boolean;
    onClose: () => void;
    conflicts: Array<{
        hearingId: string;
        caseNumber: string;
        startAt: string;
        endAt: string;
        conflictReason: string;
    }>;
    onCancel: () => void;
    onEditTime: () => void;
    onOverride: (reason: string) => void;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
    isOpen,
    onClose,
    conflicts,
    onCancel,
    onEditTime,
    onOverride,
}) => {
    const [showOverrideInput, setShowOverrideInput] = React.useState(false);
    const [overrideReason, setOverrideReason] = React.useState('');

    const handleOverrideClick = () => {
        setShowOverrideInput(true);
    };

    const handleConfirmOverride = () => {
        if (overrideReason.trim()) {
            onOverride(overrideReason.trim());
            setOverrideReason('');
            setShowOverrideInput(false);
        }
    };

    const handleClose = () => {
        setShowOverrideInput(false);
        setOverrideReason('');
        onClose();
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        Scheduling Conflict Detected
                    </DialogTitle>
                    <DialogDescription>
                        This hearing conflicts with {conflicts.length} existing hearing{conflicts.length > 1 ? 's' : ''}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {conflicts.map((conflict, idx) => (
                        <div
                            key={conflict.hearingId}
                            className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
                        >
                            <div className="font-semibold text-sm">{conflict.caseNumber}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                                {formatTime(conflict.startAt)} - {formatTime(conflict.endAt)}
                            </div>
                            <div className="text-xs text-destructive mt-1">
                                Reason: {conflict.conflictReason}
                            </div>
                        </div>
                    ))}
                </div>

                {!showOverrideInput ? (
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
                            Cancel
                        </Button>
                        <Button variant="outline" onClick={onEditTime} className="w-full sm:w-auto">
                            Edit Time
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleOverrideClick}
                            className="w-full sm:w-auto"
                        >
                            Override Conflict
                        </Button>
                    </DialogFooter>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="override-reason">
                                Override Reason <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                id="override-reason"
                                placeholder="Enter reason for scheduling despite conflict (e.g., 'Emergency hearing', 'Client urgent request')"
                                value={overrideReason}
                                onChange={(e) => setOverrideReason(e.target.value)}
                                rows={3}
                                className="mt-1"
                            />
                        </div>
                        <DialogFooter className="flex-col sm:flex-row gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowOverrideInput(false);
                                    setOverrideReason('');
                                }}
                                className="w-full sm:w-auto"
                            >
                                Back
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleConfirmOverride}
                                disabled={!overrideReason.trim()}
                                className="w-full sm:w-auto"
                            >
                                Confirm Override
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
