import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Clock, AlertTriangle, CheckCircle, Plus, Trash2, Calendar, X } from 'lucide-react';
import { useLegalData, Alert } from '@/contexts/LegalDataContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface DashboardNotifications {
    alerts: Alert[];
    urgentCases: any[];
    overdueInvoices: any[];
    todaysHearings: any[];
    tomorrowsHearings: any[];
    summary: {
        totalUnread: number;
        urgentCount: number;
        overdueCount: number;
        todayHearings: number;
        tomorrowHearings: number;
    };
}

interface NotificationDropdownProps {
    unreadCount: number;
}

export const NotificationDropdown = ({ unreadCount }: NotificationDropdownProps) => {
    const { cases, alerts, addAlert, markAlertAsRead, deleteAlert } = useLegalData();
    const [isOpen, setIsOpen] = useState(false);
    const [showCreateAlert, setShowCreateAlert] = useState(false);
    const [isActionBusy, setIsActionBusy] = useState(false);
    const [notifications, setNotifications] = useState<DashboardNotifications | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Form state for creating alerts
    const [alertForm, setAlertForm] = useState({
        caseId: '',
        type: 'hearing' as Alert['type'],
        message: '',
        alertTime: ''
    });

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/dashboard/notifications', { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setNotifications(data);
                }
            } catch (error) {
                console.error('Failed to fetch notifications:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();
        // Refresh every 5 minutes
        const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Close on ESC key
    useEffect(() => {
        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscKey);
            return () => document.removeEventListener('keydown', handleEscKey);
        }
    }, [isOpen]);

    const handleCreateAlert = () => {
        if (!alertForm.caseId || !alertForm.message || !alertForm.alertTime) {
            toast({
                title: "Missing Information",
                description: "Please fill in all required fields",
                variant: "destructive"
            });
            return;
        }

        addAlert({
            caseId: alertForm.caseId,
            type: alertForm.type,
            message: alertForm.message,
            alertTime: new Date(alertForm.alertTime),
            isRead: false
        });

        toast({
            title: "Alert Created",
            description: "Your custom alert has been scheduled successfully",
        });

        setShowCreateAlert(false);
        setAlertForm({
            caseId: '',
            type: 'hearing',
            message: '',
            alertTime: ''
        });
    };

    const getAlertIcon = (type: Alert['type']) => {
        switch (type) {
            case 'hearing': return <Clock className="h-3 w-3 text-primary" />;
            case 'deadline': return <AlertTriangle className="h-3 w-3 text-destructive" />;
            case 'payment': return <CheckCircle className="h-3 w-3 text-success" />;
            case 'document': return <Bell className="h-3 w-3 text-secondary" />;
            default: return <Bell className="h-3 w-3 text-muted-foreground" />;
        }
    };

    const getAlertBadgeColor = (type: Alert['type']) => {
        switch (type) {
            case 'hearing': return 'default';
            case 'deadline': return 'destructive';
            case 'payment': return 'secondary';
            case 'document': return 'outline';
            default: return 'outline';
        }
    };

    const unreadAlerts = notifications?.alerts.filter(alert => !alert.isRead) || alerts.filter(alert => !alert.isRead);
    const recentAlerts = notifications?.alerts || [...alerts]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);

    const formatDate = (date: string | Date) => {
        if (!date) return 'No date';
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return 'Invalid date';
        return dateObj.toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getUrgencyBadge = (priority: string) => {
        switch (priority) {
            case 'urgent':
                return <Badge variant="destructive" className="text-[10px] h-4 px-1">Urgent</Badge>;
            case 'high':
                return <Badge variant="secondary" className="text-[10px] h-4 px-1">High</Badge>;
            default:
                return null;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon Button */}
            <Button
                variant="ghost"
                size="sm"
                className="relative h-8 w-8 p-0 border border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                    <>
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 flex items-center justify-center text-xs"
                        >
                            {unreadCount}
                        </Badge>
                        <span className="absolute top-0 right-0 h-2 w-2 bg-destructive rounded-full animate-ping" />
                    </>
                )}
            </Button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-card border border-border rounded-lg shadow-lg z-50 animate-in slide-in-from-top-2 fade-in-20">
                    <div className="p-3 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-semibold">Notifications</h3>
                            {unreadAlerts.length > 0 && (
                                <Badge variant="destructive" className="text-[10px] h-4 px-1">
                                    {unreadAlerts.length} new
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <Dialog open={showCreateAlert} onOpenChange={setShowCreateAlert}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="h-6 text-[10px] px-2">
                                        <Plus className="mr-1 h-3 w-3" />
                                        Create
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Create Custom Alert</DialogTitle>
                                        <DialogDescription>
                                            Set up a custom reminder for important case events
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-4">
                                        <div>
                                            <Label htmlFor="caseId">Case*</Label>
                                            <Select value={alertForm.caseId} onValueChange={(value) =>
                                                setAlertForm(prev => ({ ...prev, caseId: value }))
                                            }>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a case" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {cases.map(case_ => (
                                                        <SelectItem key={case_.id} value={case_.id}>
                                                            {case_.caseNumber} - {case_.clientName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label htmlFor="type">Alert Type*</Label>
                                            <Select value={alertForm.type} onValueChange={(value) =>
                                                setAlertForm(prev => ({ ...prev, type: value as Alert['type'] }))
                                            }>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="hearing">Hearing</SelectItem>
                                                    <SelectItem value="deadline">Deadline</SelectItem>
                                                    <SelectItem value="payment">Payment</SelectItem>
                                                    <SelectItem value="document">Document</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label htmlFor="message">Alert Message*</Label>
                                            <Input
                                                id="message"
                                                value={alertForm.message}
                                                onChange={(e) => setAlertForm(prev => ({ ...prev, message: e.target.value }))}
                                                placeholder="Enter alert message..."
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="alertTime">Alert Date & Time*</Label>
                                            <Input
                                                id="alertTime"
                                                type="datetime-local"
                                                value={alertForm.alertTime}
                                                onChange={(e) => setAlertForm(prev => ({ ...prev, alertTime: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setShowCreateAlert(false)}>
                                            Cancel
                                        </Button>
                                        <Button onClick={handleCreateAlert}>
                                            Create Alert
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setIsOpen(false)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto p-3">
                        <div className="space-y-2 text-xs">
                            {loading ? (
                                <div className="flex items-center justify-center py-6">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                </div>
                            ) : (
                                <>
                                    {/* Today's Hearings */}
                                    {notifications?.todaysHearings && notifications.todaysHearings.length > 0 && (
                                        <div className="space-y-1.5">
                                            <h4 className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                                                <Clock className="h-3 w-3" />
                                                Today's Hearings ({notifications.todaysHearings.length})
                                            </h4>
                                            {notifications.todaysHearings.map((hearing: any) => (
                                                <div key={`today-${hearing._id}`} className="p-1.5 rounded-md bg-destructive/5 border border-destructive/20">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate">{hearing.caseNumber || 'No case number'}</p>
                                                            <p className="text-[10px] text-muted-foreground truncate">
                                                                {hearing.clientName || 'No client'} {hearing.courtName ? `• ${hearing.courtName}` : ''}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {hearing.hearingTime || 'Time TBD'}
                                                            </p>
                                                        </div>
                                                        {getUrgencyBadge(hearing.priority)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Tomorrow's Hearings */}
                                    {notifications?.tomorrowsHearings && notifications.tomorrowsHearings.length > 0 && (
                                        <div className="space-y-1.5">
                                            <h4 className="text-xs font-semibold text-warning flex items-center gap-1.5">
                                                <Calendar className="h-3 w-3" />
                                                Tomorrow's Hearings ({notifications.tomorrowsHearings.length})
                                            </h4>
                                            {notifications.tomorrowsHearings.map((hearing: any) => (
                                                <div key={`tomorrow-${hearing._id}`} className="p-1.5 rounded-md bg-warning/5 border border-warning/20">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate">{hearing.caseNumber || 'No case number'}</p>
                                                            <p className="text-[10px] text-muted-foreground truncate">
                                                                {hearing.clientName || 'No client'} {hearing.courtName ? `• ${hearing.courtName}` : ''}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {hearing.hearingTime || 'Time TBD'}
                                                            </p>
                                                        </div>
                                                        {getUrgencyBadge(hearing.priority)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Urgent Cases */}
                                    {notifications?.urgentCases && notifications.urgentCases.length > 0 && (
                                        <div className="space-y-1.5">
                                            <h4 className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                                                <AlertTriangle className="h-3 w-3" />
                                                Other Urgent Cases ({notifications.urgentCases.length})
                                            </h4>
                                            {notifications.urgentCases.slice(0, 3).map((case_: any) => (
                                                <div key={`urgent-${case_._id}`} className="p-1.5 rounded-md bg-destructive/5 border border-destructive/20">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate">{case_.caseNumber || 'No case number'}</p>
                                                            <p className="text-[10px] text-muted-foreground truncate">
                                                                {case_.clientName || 'No client'}
                                                            </p>
                                                            {case_.hearingDate && (
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    Next hearing: {formatDate(case_.hearingDate)}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <Badge variant="destructive" className="text-[10px] h-4 px-1">Urgent</Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Overdue Invoices */}
                                    {notifications?.overdueInvoices && notifications.overdueInvoices.length > 0 && (
                                        <div className="space-y-1.5">
                                            <h4 className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                                                <AlertTriangle className="h-3 w-3" />
                                                Overdue Invoices ({notifications.overdueInvoices.length})
                                            </h4>
                                            {notifications.overdueInvoices.slice(0, 3).map((invoice: any) => (
                                                <div key={`overdue-${invoice._id}`} className="p-1.5 rounded-md bg-destructive/5 border border-destructive/20">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate">{invoice.invoiceNumber}</p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                Due: {formatDate(invoice.dueDate)}
                                                            </p>
                                                            <p className="text-[10px] font-medium text-destructive">
                                                                ₹{invoice.total.toLocaleString('en-IN')}
                                                            </p>
                                                        </div>
                                                        <Badge variant="destructive" className="text-[10px] h-4 px-1">Overdue</Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Custom Alerts */}
                                    {recentAlerts.length > 0 && (
                                        <div className="space-y-1.5">
                                            <h4 className="text-xs font-semibold flex items-center gap-1.5">
                                                <Bell className="h-3 w-3" />
                                                Custom Alerts
                                            </h4>
                                            {recentAlerts.slice(0, 3).map((alert) => {
                                                const associatedCase = cases.find(c => c.id === alert.caseId);
                                                const isUpcoming = new Date(alert.alertTime) > new Date();

                                                return (
                                                    <div
                                                        key={alert.id}
                                                        className={`p-1.5 rounded-md border transition-colors ${alert.isRead ? 'bg-muted/30' : 'bg-primary/5 border-primary/20'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                                                {getAlertIcon(alert.type)}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                                                        <p className="text-xs font-medium truncate">{alert.message}</p>
                                                                        <Badge variant={getAlertBadgeColor(alert.type)} className="text-[10px] h-4 px-1">
                                                                            {alert.type}
                                                                        </Badge>
                                                                        {!alert.isRead && (
                                                                            <Badge variant="destructive" className="text-[10px] h-4 px-1">New</Badge>
                                                                        )}
                                                                    </div>

                                                                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                                                                        <p>
                                                                            {isUpcoming ? 'Scheduled for: ' : 'Alert time: '}
                                                                            {new Date(alert.alertTime).toLocaleString('en-IN')}
                                                                        </p>
                                                                        {associatedCase && (
                                                                            <p className="truncate">Case: {associatedCase.caseNumber} - {associatedCase.clientName}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-0.5 flex-shrink-0">
                                                                {!alert.isRead && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-5 w-5 p-0"
                                                                        onClick={async () => { if (isActionBusy) return; setIsActionBusy(true); await markAlertAsRead(alert.id); setIsActionBusy(false); }}
                                                                        disabled={isActionBusy}
                                                                    >
                                                                        <CheckCircle className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-5 w-5 p-0"
                                                                    onClick={async () => { if (isActionBusy) return; setIsActionBusy(true); await deleteAlert(alert.id); setIsActionBusy(false); }}
                                                                    disabled={isActionBusy}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* No notifications state */}
                                    {(!notifications || (
                                        notifications.todaysHearings.length === 0 &&
                                        notifications.tomorrowsHearings.length === 0 &&
                                        notifications.urgentCases.length === 0 &&
                                        notifications.overdueInvoices.length === 0 &&
                                        recentAlerts.length === 0
                                    )) && (
                                            <div className="text-center py-6 text-muted-foreground">
                                                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                <p className="text-xs">No urgent notifications</p>
                                            </div>
                                        )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Summary Footer */}
                    {notifications && (
                        <div className="p-2 border-t border-border bg-muted/20">
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <div>
                                    <div className="text-sm font-bold text-destructive">
                                        {notifications.summary.todayHearings || 0}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Today's Hearings</p>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-warning">
                                        {notifications.summary.urgentCount || 0}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Urgent Cases</p>
                                </div>
                            </div>
                            {notifications.summary.overdueCount > 0 && (
                                <div className="mt-1 text-center">
                                    <div className="text-xs font-medium text-destructive">
                                        {notifications.summary.overdueCount} overdue invoice{notifications.summary.overdueCount !== 1 ? 's' : ''}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
