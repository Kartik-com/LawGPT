import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Clock, AlertTriangle, CheckCircle, Plus, X, Trash2, Calendar } from 'lucide-react';
import { useLegalData, Alert } from '@/contexts/LegalDataContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFormatting } from '@/contexts/FormattingContext';
import { apiFetch } from '@/lib/api';

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

export const AlertManager = () => {
  const { cases, alerts, addAlert, markAlertAsRead, deleteAlert } = useLegalData();
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [isActionBusy, setIsActionBusy] = useState(false);
  const [notifications, setNotifications] = useState<DashboardNotifications | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { formatCurrency } = useFormatting();

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
        const response = await apiFetch('/api/dashboard/notifications');
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
      case 'hearing': return <Clock className="h-4 w-4 text-primary" />;
      case 'deadline': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'payment': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'document': return <Bell className="h-4 w-4 text-secondary" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
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
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge variant="secondary">High</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="shadow-elevated lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
            {unreadAlerts.length > 0 && (
              <Badge variant="destructive">
                {unreadAlerts.length} new
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <Dialog open={showCreateAlert} onOpenChange={setShowCreateAlert}>
              <DialogTrigger asChild>
                <Button size="sm" className="whitespace-nowrap">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Alert
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
          </div>
        </div>

        <CardDescription>
          {loading ? 'Loading notifications...' :
            notifications ?
              `${notifications.summary.todayHearings} today, ${notifications.summary.tomorrowHearings} tomorrow, ${notifications.summary.urgentCount} urgent` :
              'Manage notifications and reminders for your cases'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Today's Hearings */}
              {notifications?.todaysHearings && notifications.todaysHearings.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Today's Hearings ({notifications.todaysHearings.length})
                  </h4>
                  {notifications.todaysHearings.map((hearing: any) => (
                    <div key={`today-${hearing._id}`} className="p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{hearing.caseNumber || 'No case number'}</p>
                          <p className="text-xs text-muted-foreground">
                            {hearing.clientName || 'No client'} {hearing.courtName ? `• ${hearing.courtName}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
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
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-warning flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Tomorrow's Hearings ({notifications.tomorrowsHearings.length})
                  </h4>
                  {notifications.tomorrowsHearings.map((hearing: any) => (
                    <div key={`tomorrow-${hearing._id}`} className="p-2 rounded-lg bg-warning/5 border border-warning/20">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{hearing.caseNumber || 'No case number'}</p>
                          <p className="text-xs text-muted-foreground">
                            {hearing.clientName || 'No client'} {hearing.courtName ? `• ${hearing.courtName}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {hearing.hearingTime || 'Time TBD'}
                          </p>
                        </div>
                        {getUrgencyBadge(hearing.priority)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Urgent Cases (only showing cases NOT in today/tomorrow to avoid duplicates) */}
              {notifications?.urgentCases && notifications.urgentCases.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Other Urgent Cases ({notifications.urgentCases.length})
                  </h4>
                  {notifications.urgentCases.slice(0, 3).map((case_: any) => (
                    <div key={`urgent-${case_._id}`} className="p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{case_.caseNumber || 'No case number'}</p>
                          <p className="text-xs text-muted-foreground">
                            {case_.clientName || 'No client'}
                          </p>
                          {case_.hearingDate && (
                            <p className="text-xs text-muted-foreground">
                              Next hearing: {formatDate(case_.hearingDate)}
                            </p>
                          )}
                        </div>
                        <Badge variant="destructive">Urgent</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Overdue Invoices */}
              {notifications?.overdueInvoices && notifications.overdueInvoices.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Overdue Invoices ({notifications.overdueInvoices.length})
                  </h4>
                  {notifications.overdueInvoices.slice(0, 3).map((invoice: any) => (
                    <div key={`overdue-${invoice._id}`} className="p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            Due: {formatDate(invoice.dueDate)}
                          </p>
                          <p className="text-xs font-medium text-destructive">
                            {formatCurrency(invoice.total)}
                          </p>
                        </div>
                        <Badge variant="destructive">Overdue</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom Alerts */}
              {recentAlerts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Custom Alerts
                  </h4>
                  {recentAlerts.slice(0, 3).map((alert) => {
                    const associatedCase = cases.find(c => c.id === alert.caseId);
                    const isUpcoming = new Date(alert.alertTime) > new Date();

                    return (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border transition-colors overflow-hidden ${alert.isRead ? 'bg-muted/30' : 'bg-primary/5 border-primary/20'
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {getAlertIcon(alert.type)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium break-words truncate">{alert.message}</p>
                                <Badge variant={getAlertBadgeColor(alert.type)}>
                                  {alert.type}
                                </Badge>
                                {!alert.isRead && (
                                  <Badge variant="destructive" className="text-xs">New</Badge>
                                )}
                              </div>

                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>
                                  {isUpcoming ? 'Scheduled for: ' : 'Alert time: '}
                                  {new Date(alert.alertTime).toLocaleString('en-IN')}
                                </p>
                                {associatedCase && (
                                  <p>Case: {associatedCase.caseNumber} - {associatedCase.clientName}</p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-1">
                            {!alert.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => { if (isActionBusy) return; setIsActionBusy(true); await markAlertAsRead(alert.id); setIsActionBusy(false); }}
                                disabled={isActionBusy}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => { if (isActionBusy) return; setIsActionBusy(true); await deleteAlert(alert.id); setIsActionBusy(false); }}
                              disabled={isActionBusy}
                            >
                              <Trash2 className="h-4 w-4" />
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
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No urgent notifications</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setShowCreateAlert(true)}
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      Create Alert
                    </Button>
                  </div>
                )}
            </>
          )}
        </div>

        {/* Notification Summary */}
        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-destructive">
                {notifications?.summary.todayHearings || 0}
              </div>
              <p className="text-xs text-muted-foreground">Today's Hearings</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-warning">
                {notifications?.summary.urgentCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">Urgent Cases</p>
            </div>
          </div>
          {notifications?.summary.overdueCount > 0 && (
            <div className="mt-2 text-center">
              <div className="text-sm font-medium text-destructive">
                {notifications.summary.overdueCount} overdue invoice{notifications.summary.overdueCount !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};