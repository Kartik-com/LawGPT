import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  IndianRupee,
  Clock,
  FileText,
  User,
  Calendar,
  Download,
  Send,
  Filter,
  Search,
  Check
} from 'lucide-react';
import { useLegalData, TimeEntry, Invoice } from '@/contexts/LegalDataContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useFormatting } from '@/contexts/FormattingContext';

// Use Invoice from context

const Billing = () => {
  const { cases, clients, timeEntries, addTimeEntry, invoices, createInvoice, updateInvoice, deleteInvoice, sendInvoice } = useLegalData();
  const { formatCurrency, formatDateShort, currencySymbol, currencyCode } = useFormatting();
  const [showTimeDialog, setShowTimeDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState<Invoice | null>(null);
  const [showMarkPaidConfirm, setShowMarkPaidConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();

  // New invoice form state
  const [invoiceForm, setInvoiceForm] = useState<{ clientId: string; caseId?: string; issueDate: string; dueDate: string; taxRate: string; discountAmount: string; items: { description: string; quantity: string; unitPrice: string; }[]; notes: string; terms: string; }>(
    { clientId: '', caseId: '', issueDate: new Date().toISOString().split('T')[0], dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], taxRate: '0', discountAmount: '0', items: [{ description: '', quantity: '1', unitPrice: '0' }], notes: '', terms: '' }
  );

  // Form state for time entry
  const [timeFormData, setTimeFormData] = useState({
    caseId: '',
    description: '',
    duration: '',
    hourlyRate: '2000',
    date: new Date().toISOString().split('T')[0],
    billable: true
  });

  const resetTimeForm = () => {
    setTimeFormData({
      caseId: '',
      description: '',
      duration: '',
      hourlyRate: '2000',
      date: new Date().toISOString().split('T')[0],
      billable: true
    });
  };

  const handleTimeSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    addTimeEntry({
      caseId: timeFormData.caseId,
      description: timeFormData.description,
      duration: parseInt(timeFormData.duration),
      hourlyRate: parseInt(timeFormData.hourlyRate),
      date: new Date(timeFormData.date),
      billable: timeFormData.billable
    });

    toast({
      title: "Time Entry Added",
      description: "Billable time has been recorded successfully",
    });

    setShowTimeDialog(false);
    resetTimeForm();
  };

  // Helpers
  const computeTotals = (items: { description: string; quantity: string; unitPrice: string; }[], taxRate: number, discountAmount: number) => {
    const mapped = items.map(i => ({ description: i.description, quantity: Number(i.quantity || 0), unitPrice: Number(i.unitPrice || 0), amount: Number(i.quantity || 0) * Number(i.unitPrice || 0) }));
    const subtotal = mapped.reduce((s, i) => s + i.amount, 0);
    const taxAmount = Math.round((subtotal * taxRate) / 100);
    const total = Math.max(0, subtotal + taxAmount - discountAmount);
    return { items: mapped, subtotal, taxAmount, total };
  };

  // Calculate stats
  const totalBilled = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const paidAmount = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total || 0), 0);
  const pendingAmount = invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue').reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalHours = timeEntries.reduce((sum, entry) => sum + entry.duration, 0);
  const collectionRate = totalBilled > 0 ? Math.round((paidAmount / totalBilled) * 100) : 0;
  const averageInvoice = invoices.length > 0 ? Math.round(totalBilled / invoices.length) : 0;
  const avgHoursPerInvoice = invoices.length > 0 ? Math.round(totalHours / invoices.length) : 0;

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return 'default';
      case 'sent': return 'secondary';
      case 'overdue': return 'destructive';
      case 'draft': return 'outline';
      default: return 'outline';
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const clientName = clients.find(c => c.id === inv.clientId)?.name || '';
    const matchesSearch = clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-2 md:space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Billing & Time Tracking</h1>
          <p className="text-xs text-muted-foreground">Manage invoices and track billable hours</p>
        </div>

        <div className="flex gap-1.5">
          <Dialog open={showTimeDialog} onOpenChange={setShowTimeDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={resetTimeForm} size="sm" className="h-8 text-xs border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                Log Time
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Billable Time</DialogTitle>
                <DialogDescription>Record time spent on case work</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleTimeSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="caseId">Case*</Label>
                  <Select value={timeFormData.caseId} onValueChange={(value) => setTimeFormData(prev => ({ ...prev, caseId: value }))}>
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="duration">Duration (minutes)*</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={timeFormData.duration}
                      onChange={(e) => setTimeFormData(prev => ({ ...prev, duration: e.target.value }))}
                      placeholder="e.g., 60"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="hourlyRate">Hourly Rate ({currencySymbol})*</Label>
                    <Input
                      id="hourlyRate"
                      type="number"
                      value={timeFormData.hourlyRate}
                      onChange={(e) => setTimeFormData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="date">Date*</Label>
                  <Input
                    id="date"
                    type="date"
                    value={timeFormData.date}
                    onChange={(e) => setTimeFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description*</Label>
                  <Textarea
                    id="description"
                    value={timeFormData.description}
                    onChange={(e) => setTimeFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the work performed..."
                    required
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowTimeDialog(false)} className="border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">
                    Cancel
                  </Button>
                  <Button type="submit" className="border border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">Log Time</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button onClick={() => setShowInvoiceDialog(true)} size="sm" className="h-8 text-xs border border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-3">
        <Card className="shadow-card-custom">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium">Total Billed</CardTitle>
            <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-xl font-bold">{formatCurrency(totalBilled)}</div>
            <p className="text-[10px] text-muted-foreground">All time invoices</p>
          </CardContent>
        </Card>

        <Card className="shadow-card-custom">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium">Paid Amount</CardTitle>
            <IndianRupee className="h-3.5 w-3.5 text-success" />
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-xl font-bold text-success">{formatCurrency(paidAmount)}</div>
            <p className="text-[10px] text-muted-foreground">Received payments</p>
          </CardContent>
        </Card>

        <Card className="shadow-card-custom">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium">Pending Amount</CardTitle>
            <IndianRupee className="h-3.5 w-3.5 text-warning" />
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-xl font-bold text-warning">{formatCurrency(pendingAmount)}</div>
            <p className="text-[10px] text-muted-foreground">Outstanding invoices</p>
          </CardContent>
        </Card>

        <Card className="shadow-card-custom">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium">Hours Logged</CardTitle>
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-xl font-bold">{Math.round(totalHours / 60)}h</div>
            <p className="text-[10px] text-muted-foreground">{totalHours} minutes total</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 md:gap-3">
        {/* Invoices */}
        <Card className="lg:col-span-2 shadow-elevated">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                Invoices
              </CardTitle>
              <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">
                <Download className="mr-1.5 h-3 w-3" />
                Export
              </Button>
            </div>
            <CardDescription className="text-[10px]">Manage client invoices and payments</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {/* Search and Filter */}
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs border-transparent hover:border-accent hover:border-2 transition-all"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-8 text-xs border-transparent hover:border-accent hover:border-2 transition-all">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-2 border rounded-lg border-transparent hover:border-accent hover:border-2 transition-all">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-medium text-xs">{invoice.invoiceNumber}</span>
                      <Badge variant={getStatusColor(invoice.status)} className="text-[10px] h-4 px-1">
                        {invoice.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {clients.find(c => c.id === invoice.clientId)?.name || 'Client'} • Due: {formatDateShort(invoice.dueDate)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{formatCurrency(invoice.total || 0)}</div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setShowSendDialog(invoice)} className="h-6 text-[10px] px-2 border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">
                        <Send className="mr-1 h-3 w-3" />
                        Send
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        // Get fresh invoice data from invoices array
                        const freshInvoice = invoices.find(inv => inv.id === invoice.id);
                        setSelectedInvoice(freshInvoice || invoice);
                      }} className="h-6 text-[10px] px-2 border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredInvoices.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-1.5 opacity-50" />
                  <p className="text-xs">No invoices found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Time Entries */}
        <Card className="shadow-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              Recent Time Entries
            </CardTitle>
            <CardDescription className="text-[10px]">Latest billable hours logged</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2">
              {timeEntries.slice(0, 5).map((entry) => {
                const case_ = cases.find(c => c.id === entry.caseId);
                const amount = (entry.duration / 60) * entry.hourlyRate;

                return (
                  <div key={entry.id} className="p-2 border rounded-lg space-y-1.5 border-transparent hover:border-accent hover:border-2 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs">
                        {case_?.caseNumber || 'Unknown Case'}
                      </span>
                      <Badge variant={entry.billable ? 'default' : 'outline'} className="text-[10px] h-4 px-1">
                        {entry.billable ? 'Billable' : 'Non-billable'}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      {entry.description}
                    </p>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">
                        {Math.round(entry.duration / 60 * 10) / 10}h @ {currencySymbol}{entry.hourlyRate}/hr
                      </span>
                      <span className="font-medium">{formatCurrency(amount)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatDateShort(entry.date)}
                    </div>
                  </div>
                );
              })}

              {timeEntries.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-1.5 opacity-50" />
                  <p className="text-xs">No time entries yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1.5 h-7 text-xs border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all"
                    onClick={() => setShowTimeDialog(true)}
                  >
                    <Plus className="mr-1.5 h-3 w-3" />
                    Log First Entry
                  </Button>
                </div>
              )}

              {timeEntries.length > 5 && (
                <Button variant="outline" className="w-full h-7 text-xs border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">
                  View All Entries
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Status */}
      <Card className="shadow-card-custom">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Payment Overview</CardTitle>
          <CardDescription className="text-[10px]">Monthly payment status and trends</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-success mb-0.5">
                {collectionRate}%
              </div>
              <p className="text-[10px] text-muted-foreground">Collection Rate</p>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold mb-0.5">
                {formatCurrency(averageInvoice)}
              </div>
              <p className="text-[10px] text-muted-foreground">Average Invoice</p>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-primary mb-0.5">
                {avgHoursPerInvoice}h
              </div>
              <p className="text-[10px] text-muted-foreground">Avg. Hours per Invoice</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Invoice Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>Fill invoice details and items</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Client*</Label>
              <Select value={invoiceForm.clientId} onValueChange={(v) => setInvoiceForm(p => ({ ...p, clientId: v }))}>
                <SelectTrigger className="border-transparent hover:border-accent hover:border-2 transition-all">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Case (optional)</Label>
              <Select value={invoiceForm.caseId} onValueChange={(v) => setInvoiceForm(p => ({ ...p, caseId: v }))}>
                <SelectTrigger className="border-transparent hover:border-accent hover:border-2 transition-all">
                  <SelectValue placeholder="Select case" />
                </SelectTrigger>
                <SelectContent>
                  {cases.map(cs => (
                    <SelectItem key={cs.id} value={cs.id}>{cs.caseNumber} - {cs.clientName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Issue Date</Label>
              <Input type="date" value={invoiceForm.issueDate} onChange={(e) => setInvoiceForm(p => ({ ...p, issueDate: e.target.value }))} className="border-transparent hover:border-accent hover:border-2 transition-all" />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm(p => ({ ...p, dueDate: e.target.value }))} className="border-transparent hover:border-accent hover:border-2 transition-all" />
            </div>
            <div>
              <Label>Tax Rate (%)</Label>
              <Input type="number" value={invoiceForm.taxRate} onChange={(e) => setInvoiceForm(p => ({ ...p, taxRate: e.target.value }))} className="border-transparent hover:border-accent hover:border-2 transition-all" />
            </div>
            <div>
              <Label>Discount ({currencySymbol})</Label>
              <Input type="number" value={invoiceForm.discountAmount} onChange={(e) => setInvoiceForm(p => ({ ...p, discountAmount: e.target.value }))} className="border-transparent hover:border-accent hover:border-2 transition-all" />
            </div>
          </div>
          <div className="mt-4">
            <Label>Items</Label>
            <div className="mt-2">
              <div className="grid grid-cols-12 gap-3 px-3 py-3 rounded-md bg-muted text-xs font-medium">
                <div className="col-span-6 text-left">Description</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-center">Unit Price ({currencySymbol})</div>
                <div className="col-span-1 text-center">Amount ({currencySymbol})</div>
                <div className="col-span-1 text-center">Action</div>
              </div>
              <div className="space-y-3 mt-3">
                {invoiceForm.items.map((it, idx) => (
                  <div className="grid grid-cols-12 gap-3 items-center" key={idx}>
                    <div className="col-span-6">
                      <Input placeholder="Description" value={it.description} onChange={(e) => setInvoiceForm(p => { const items = [...p.items]; items[idx] = { ...items[idx], description: e.target.value }; return { ...p, items }; })} className="border-transparent hover:border-accent hover:border-2 transition-all" />
                    </div>
                    <div className="col-span-2">
                      <Input className="text-center border-transparent hover:border-accent hover:border-2 transition-all" min="0" step="1" type="number" placeholder="Qty" value={it.quantity} onChange={(e) => setInvoiceForm(p => { const items = [...p.items]; items[idx] = { ...items[idx], quantity: e.target.value }; return { ...p, items }; })} />
                    </div>
                    <div className="col-span-2">
                      <Input className="text-center border-transparent hover:border-accent hover:border-2 transition-all" min="0" step="0.01" type="number" placeholder="Unit Price" value={it.unitPrice} onChange={(e) => setInvoiceForm(p => { const items = [...p.items]; items[idx] = { ...items[idx], unitPrice: e.target.value }; return { ...p, items }; })} />
                    </div>
                    <div className="col-span-1 text-center font-medium">
                      {formatCurrency(Number(it.quantity || 0) * Number(it.unitPrice || 0))}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setInvoiceForm(p => {
                          const items = [...p.items];
                          items.splice(idx, 1);
                          return { ...p, items: items.length ? items : [{ description: '', quantity: '1', unitPrice: '0' }] };
                        })}
                        className="border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Button variant="outline" onClick={() => setInvoiceForm(p => ({ ...p, items: [...p.items, { description: '', quantity: '1', unitPrice: '0' }] }))} className="border-border hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={invoiceForm.notes} onChange={(e) => setInvoiceForm(p => ({ ...p, notes: e.target.value }))} className="border-transparent hover:border-accent hover:border-2 transition-all" />
            <Label>Terms</Label>
            <Textarea value={invoiceForm.terms} onChange={(e) => setInvoiceForm(p => ({ ...p, terms: e.target.value }))} className="border-transparent hover:border-accent hover:border-2 transition-all" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)} className="border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">Cancel</Button>
            <Button onClick={async () => {
              const { items, subtotal, taxAmount, total } = computeTotals(invoiceForm.items, Number(invoiceForm.taxRate || 0), Number(invoiceForm.discountAmount || 0));
              const payload: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
                clientId: invoiceForm.clientId,
                caseId: invoiceForm.caseId || undefined,
                invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
                issueDate: new Date(invoiceForm.issueDate),
                dueDate: new Date(invoiceForm.dueDate),
                status: 'draft',
                currency: currencyCode,
                items,
                subtotal,
                taxRate: Number(invoiceForm.taxRate || 0),
                taxAmount,
                discountAmount: Number(invoiceForm.discountAmount || 0),
                total,
                notes: invoiceForm.notes,
                terms: invoiceForm.terms,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any;
              await createInvoice(payload);
              setShowInvoiceDialog(false);
              setInvoiceForm({ clientId: '', caseId: '', issueDate: new Date().toISOString().split('T')[0], dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], taxRate: '0', discountAmount: '0', items: [{ description: '', quantity: '1', unitPrice: '0' }], notes: '', terms: '' });
              toast({ title: 'Invoice Created', description: 'Invoice has been created successfully.' });
            }} className="border border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">Save Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Receipt Modal */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invoice Receipt</DialogTitle>
            <DialogDescription>Complete billing details</DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xl font-bold">{clients.find(c => c.id === selectedInvoice.clientId)?.name}</div>
                  <div className="text-muted-foreground text-sm">Invoice #{selectedInvoice.invoiceNumber}</div>
                </div>
                <div className="text-right text-sm">
                  <div>Issue: {formatDateShort(selectedInvoice.issueDate)}</div>
                  <div>Due: {formatDateShort(selectedInvoice.dueDate)}</div>
                  <div>Status: <Badge variant={getStatusColor(selectedInvoice.status)}>{selectedInvoice.status}</Badge></div>
                </div>
              </div>
              <div className="border rounded-md">
                <div className="grid grid-cols-12 font-medium bg-muted p-2">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Unit</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>
                {selectedInvoice.items.map((i, idx) => (
                  <div key={idx} className="grid grid-cols-12 p-2 border-t">
                    <div className="col-span-6">{i.description}</div>
                    <div className="col-span-2 text-right">{i.quantity}</div>
                    <div className="col-span-2 text-right">{formatCurrency(i.unitPrice)}</div>
                    <div className="col-span-2 text-right">{formatCurrency(i.amount)}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(selectedInvoice.subtotal)}</span></div>
                  <div className="flex justify-between"><span>Tax ({selectedInvoice.taxRate}%)</span><span>{formatCurrency(selectedInvoice.taxAmount)}</span></div>
                  <div className="flex justify-between"><span>Discount</span><span>{formatCurrency(selectedInvoice.discountAmount)}</span></div>
                  <div className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(selectedInvoice.total)}</span></div>
                </div>
              </div>
              {selectedInvoice.notes && <div>
                <div className="font-medium">Notes</div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedInvoice.notes}</div>
              </div>}
              {selectedInvoice.terms && <div>
                <div className="font-medium">Terms</div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedInvoice.terms}</div>
              </div>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedInvoice(null)} className="border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">Close</Button>

                {/* Only show Mark as Paid button if invoice is not already paid */}
                {selectedInvoice.status !== 'paid' && (
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setShowMarkPaidConfirm(true)}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Mark as Paid
                  </Button>
                )}

                <Button variant="outline" onClick={async () => {
                  const confirmed = window.confirm(`Delete Invoice ${selectedInvoice.invoiceNumber}?\n\nThis action cannot be undone.`);
                  if (confirmed) {
                    await deleteInvoice(selectedInvoice.id);
                    setSelectedInvoice(null);
                    toast({ title: 'Invoice Deleted', description: 'Invoice has been deleted successfully.' });
                  }
                }} className="border-transparent hover:border-accent hover:border-2 hover:bg-transparent hover:text-foreground transition-all">
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Confirmation Dialog */}
      <AlertDialog open={showMarkPaidConfirm} onOpenChange={setShowMarkPaidConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Invoice as Paid?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {selectedInvoice && (
                <div className="space-y-2 mt-2">
                  <div>Are you sure you want to mark this invoice as <span className="font-semibold text-green-600">PAID</span>?</div>
                  <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                    <div><span className="font-medium">Invoice:</span> {selectedInvoice.invoiceNumber}</div>
                    <div><span className="font-medium">Client:</span> {clients.find(c => c.id === selectedInvoice.clientId)?.name}</div>
                    <div><span className="font-medium">Amount:</span> <span className="text-lg font-bold">{formatCurrency(selectedInvoice.total)}</span></div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">This action cannot be undone.</div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={async () => {
                if (selectedInvoice) {
                  console.log('🔍 Before update - Invoice ID:', selectedInvoice.id, 'Status:', selectedInvoice.status);
                  await updateInvoice(selectedInvoice.id, { status: 'paid' });
                  console.log('✅ Update call completed');

                  toast({
                    title: '✓ Invoice Marked as Paid',
                    description: `Invoice ${selectedInvoice.invoiceNumber} (${formatCurrency(selectedInvoice.total)}) has been marked as paid.`,
                  });
                  setShowMarkPaidConfirm(false);
                  setSelectedInvoice(null);
                }
              }}
            >
              <Check className="mr-2 h-4 w-4" />
              Confirm Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Invoice Dialog */}
      <Dialog open={!!showSendDialog} onOpenChange={(open) => { if (!open) setShowSendDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
            <DialogDescription>Open your email client with invoice details pre-filled</DialogDescription>
          </DialogHeader>
          {showSendDialog && (
            <SendForm invoice={showSendDialog} onCancel={() => setShowSendDialog(null)} onSent={() => {
              setShowSendDialog(null);
              toast({ title: 'Email Client Opened', description: 'Your default email client has been opened with the invoice details pre-filled.' });
            }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Billing;

interface SendFormProps {
  invoice: Invoice;
  onCancel: () => void;
  onSent: (previewUrl?: string) => void;
}

const SendForm: React.FC<SendFormProps> = ({ invoice, onCancel, onSent }) => {
  const { clients } = useLegalData();
  const { formatDateShort } = useFormatting();
  const client = clients.find(c => c.id === invoice.clientId);

  // Generate auto-generated content
  const generateAutoContent = () => {
    const daysUntilDue = Math.ceil((new Date(invoice.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysUntilDue < 0;
    const isDueSoon = daysUntilDue <= 7 && daysUntilDue >= 0;

    let urgencyText = '';
    if (isOverdue) {
      urgencyText = `This invoice is overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}. `;
    } else if (isDueSoon) {
      urgencyText = `This invoice is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}. `;
    }

    const totalAmount = `${currencySymbol}${invoice.total.toLocaleString(currencyCode === 'INR' ? 'en-IN' : 'en-US')}`;
    const dueDate = formatDateShort(invoice.dueDate);

    return {
      subject: `Invoice ${invoice.invoiceNumber} - Legal Services - Due ${dueDate}`,
      message: `Dear ${client?.name || 'Valued Client'},

We hope this email finds you well. ${urgencyText}Please find attached your invoice ${invoice.invoiceNumber} for legal services provided. The total amount due is ${totalAmount} and payment is due by ${dueDate}.

INVOICE SUMMARY:
• Invoice Number: ${invoice.invoiceNumber}
• Issue Date: ${formatDateShort(invoice.issueDate)}
• Due Date: ${dueDate}
• Total Amount: ${totalAmount}

SERVICES PROVIDED:
${invoice.items.map(item => `• ${item.description} (Qty: ${item.quantity}, Rate: ${currencySymbol}${item.unitPrice.toLocaleString(currencyCode === 'INR' ? 'en-IN' : 'en-US')}, Amount: ${currencySymbol}${item.amount.toLocaleString(currencyCode === 'INR' ? 'en-IN' : 'en-US')})`).join('\n')}

PAYMENT BREAKDOWN:
• Subtotal: ${currencySymbol}${invoice.subtotal.toLocaleString(currencyCode === 'INR' ? 'en-IN' : 'en-US')}
${invoice.taxRate > 0 ? `• Tax (${invoice.taxRate}%): ${currencySymbol}${invoice.taxAmount.toLocaleString(currencyCode === 'INR' ? 'en-IN' : 'en-US')}` : ''}
${invoice.discountAmount > 0 ? `• Discount: -${currencySymbol}${invoice.discountAmount.toLocaleString(currencyCode === 'INR' ? 'en-IN' : 'en-US')}` : ''}
• TOTAL AMOUNT: ${totalAmount}

${invoice.notes ? `ADDITIONAL NOTES:\n${invoice.notes}\n` : ''}${invoice.terms ? `TERMS & CONDITIONS:\n${invoice.terms}\n` : ''}PAYMENT INSTRUCTIONS:
Please remit payment by ${dueDate} to avoid any late fees. For payment queries or to discuss payment arrangements, please contact us immediately.

Thank you for choosing our legal services. We appreciate your business and look forward to continuing our professional relationship.

Best regards,
Legal Services Team`
    };
  };

  const autoContent = generateAutoContent();
  const [to, setTo] = useState(client?.email || '');
  const [subject, setSubject] = useState(autoContent.subject);
  const [message, setMessage] = useState(autoContent.message);
  const [useAutoContent, setUseAutoContent] = useState(true);

  const handleUseAutoContent = () => {
    if (useAutoContent) {
      setSubject(autoContent.subject);
      setMessage(autoContent.message);
    }
    setUseAutoContent(!useAutoContent);
  };

  const handleSendEmail = () => {
    // Create mailto URL with pre-filled content
    const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

    // Open default email client
    window.open(mailtoUrl, '_self');

    // Call onSent callback to close dialog
    onSent();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="useAutoContent"
            checked={useAutoContent}
            onCheckedChange={handleUseAutoContent}
          />
          <Label htmlFor="useAutoContent" className="text-sm font-medium text-blue-800">
            Use auto-generated professional email content
          </Label>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSubject(autoContent.subject);
            setMessage(autoContent.message);
          }}
          className="text-blue-600 border-blue-300 hover:bg-blue-100"
        >
          Reset to Auto
        </Button>
      </div>

      <div>
        <Label>To*</Label>
        <Input value={to} type="email" onChange={(e) => setTo(e.target.value)} required />
      </div>

      <div>
        <Label>Subject*</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>

      <div>
        <Label>Message</Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={12}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Clicking "Send Email" will open your default email client (Outlook, Gmail, etc.) with this content pre-filled.
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSendEmail}>
          Send Email
        </Button>
      </DialogFooter>
    </div>
  );
};