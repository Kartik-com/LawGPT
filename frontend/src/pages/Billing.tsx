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

// Use Invoice from context

const Billing = () => {
  const { cases, clients, timeEntries, addTimeEntry, invoices, createInvoice, updateInvoice, deleteInvoice, sendInvoice } = useLegalData();
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing & Time Tracking</h1>
          <p className="text-muted-foreground">Manage invoices and track billable hours</p>
        </div>

        <div className="flex gap-2">
          <Dialog open={showTimeDialog} onOpenChange={setShowTimeDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={resetTimeForm}>
                <Clock className="mr-2 h-4 w-4" />
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
                    <Label htmlFor="hourlyRate">Hourly Rate (₹)*</Label>
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
                  <Button type="button" variant="outline" onClick={() => setShowTimeDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Log Time</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button onClick={() => setShowInvoiceDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-card-custom">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalBilled.toLocaleString('en-IN')}</div>
            <p className="text-xs text-muted-foreground">All time invoices</p>
          </CardContent>
        </Card>

        <Card className="shadow-card-custom">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
            <IndianRupee className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">₹{paidAmount.toLocaleString('en-IN')}</div>
            <p className="text-xs text-muted-foreground">Received payments</p>
          </CardContent>
        </Card>

        <Card className="shadow-card-custom">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
            <IndianRupee className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">₹{pendingAmount.toLocaleString('en-IN')}</div>
            <p className="text-xs text-muted-foreground">Outstanding invoices</p>
          </CardContent>
        </Card>

        <Card className="shadow-card-custom">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours Logged</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(totalHours / 60)}h</div>
            <p className="text-xs text-muted-foreground">{totalHours} minutes total</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoices */}
        <Card className="lg:col-span-2 shadow-elevated">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Invoices
              </CardTitle>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
            <CardDescription>Manage client invoices and payments</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Search and Filter */}
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
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

            <div className="space-y-3">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{invoice.invoiceNumber}</span>
                      <Badge variant={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {clients.find(c => c.id === invoice.clientId)?.name || 'Client'} • Due: {invoice.dueDate.toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">₹{(invoice.total || 0).toLocaleString('en-IN')}</div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setShowSendDialog(invoice)}>
                        <Send className="mr-1 h-3 w-3" />
                        Send
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        // Get fresh invoice data from invoices array
                        const freshInvoice = invoices.find(inv => inv.id === invoice.id);
                        setSelectedInvoice(freshInvoice || invoice);
                      }}>
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredInvoices.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No invoices found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Time Entries */}
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Time Entries
            </CardTitle>
            <CardDescription>Latest billable hours logged</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {timeEntries.slice(0, 5).map((entry) => {
                const case_ = cases.find(c => c.id === entry.caseId);
                const amount = (entry.duration / 60) * entry.hourlyRate;

                return (
                  <div key={entry.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {case_?.caseNumber || 'Unknown Case'}
                      </span>
                      <Badge variant={entry.billable ? 'default' : 'outline'}>
                        {entry.billable ? 'Billable' : 'Non-billable'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {entry.description}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {Math.round(entry.duration / 60 * 10) / 10}h @ ₹{entry.hourlyRate}/hr
                      </span>
                      <span className="font-medium">₹{amount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entry.date.toLocaleDateString('en-IN')}
                    </div>
                  </div>
                );
              })}

              {timeEntries.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No time entries yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowTimeDialog(true)}
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    Log First Entry
                  </Button>
                </div>
              )}

              {timeEntries.length > 5 && (
                <Button variant="outline" className="w-full">
                  View All Entries
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Status */}
      <Card className="shadow-card-custom">
        <CardHeader>
          <CardTitle>Payment Overview</CardTitle>
          <CardDescription>Monthly payment status and trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-success mb-1">
                {collectionRate}%
              </div>
              <p className="text-sm text-muted-foreground">Collection Rate</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold mb-1">
                ₹{averageInvoice.toLocaleString('en-IN')}
              </div>
              <p className="text-sm text-muted-foreground">Average Invoice</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary mb-1">
                {avgHoursPerInvoice}h
              </div>
              <p className="text-sm text-muted-foreground">Avg. Hours per Invoice</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Invoice Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>Fill invoice details and items</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Client*</Label>
              <Select value={invoiceForm.clientId} onValueChange={(v) => setInvoiceForm(p => ({ ...p, clientId: v }))}>
                <SelectTrigger>
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
                <SelectTrigger>
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
              <Input type="date" value={invoiceForm.issueDate} onChange={(e) => setInvoiceForm(p => ({ ...p, issueDate: e.target.value }))} />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm(p => ({ ...p, dueDate: e.target.value }))} />
            </div>
            <div>
              <Label>Tax Rate (%)</Label>
              <Input type="number" value={invoiceForm.taxRate} onChange={(e) => setInvoiceForm(p => ({ ...p, taxRate: e.target.value }))} />
            </div>
            <div>
              <Label>Discount (₹)</Label>
              <Input type="number" value={invoiceForm.discountAmount} onChange={(e) => setInvoiceForm(p => ({ ...p, discountAmount: e.target.value }))} />
            </div>
          </div>
          <div className="mt-4">
            <Label>Items</Label>
            <div className="mt-2">
              <div className="grid grid-cols-12 gap-2 px-2 py-2 rounded-md bg-muted text-xs font-medium">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit Price (₹)</div>
                <div className="col-span-1 text-right">Amount (₹)</div>
                <div className="col-span-1 text-right">Action</div>
              </div>
              <div className="space-y-2 mt-2">
                {invoiceForm.items.map((it, idx) => (
                  <div className="grid grid-cols-12 gap-2 items-center" key={idx}>
                    <div className="col-span-6">
                      <Input placeholder="Description" value={it.description} onChange={(e) => setInvoiceForm(p => { const items = [...p.items]; items[idx] = { ...items[idx], description: e.target.value }; return { ...p, items }; })} />
                    </div>
                    <div className="col-span-2">
                      <Input className="text-right" min="0" step="1" type="number" placeholder="Qty" value={it.quantity} onChange={(e) => setInvoiceForm(p => { const items = [...p.items]; items[idx] = { ...items[idx], quantity: e.target.value }; return { ...p, items }; })} />
                    </div>
                    <div className="col-span-2">
                      <Input className="text-right" min="0" step="0.01" type="number" placeholder="Unit Price" value={it.unitPrice} onChange={(e) => setInvoiceForm(p => { const items = [...p.items]; items[idx] = { ...items[idx], unitPrice: e.target.value }; return { ...p, items }; })} />
                    </div>
                    <div className="col-span-1 text-right font-medium">
                      ₹{(Number(it.quantity || 0) * Number(it.unitPrice || 0)).toLocaleString('en-IN')}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setInvoiceForm(p => {
                          const items = [...p.items];
                          items.splice(idx, 1);
                          return { ...p, items: items.length ? items : [{ description: '', quantity: '1', unitPrice: '0' }] };
                        })}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Button variant="outline" onClick={() => setInvoiceForm(p => ({ ...p, items: [...p.items, { description: '', quantity: '1', unitPrice: '0' }] }))}>Add Item</Button>
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={invoiceForm.notes} onChange={(e) => setInvoiceForm(p => ({ ...p, notes: e.target.value }))} />
            <Label>Terms</Label>
            <Textarea value={invoiceForm.terms} onChange={(e) => setInvoiceForm(p => ({ ...p, terms: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>Cancel</Button>
            <Button onClick={async () => {
              const { items, subtotal, taxAmount, total } = computeTotals(invoiceForm.items, Number(invoiceForm.taxRate || 0), Number(invoiceForm.discountAmount || 0));
              const payload: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
                clientId: invoiceForm.clientId,
                caseId: invoiceForm.caseId || undefined,
                invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
                issueDate: new Date(invoiceForm.issueDate),
                dueDate: new Date(invoiceForm.dueDate),
                status: 'draft',
                currency: 'INR',
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
            }}>Save Invoice</Button>
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
                  <div>Issue: {selectedInvoice.issueDate.toLocaleDateString('en-IN')}</div>
                  <div>Due: {selectedInvoice.dueDate.toLocaleDateString('en-IN')}</div>
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
                    <div className="col-span-2 text-right">₹{i.unitPrice.toLocaleString('en-IN')}</div>
                    <div className="col-span-2 text-right">₹{i.amount.toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>₹{selectedInvoice.subtotal.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between"><span>Tax ({selectedInvoice.taxRate}%)</span><span>₹{selectedInvoice.taxAmount.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between"><span>Discount</span><span>₹{selectedInvoice.discountAmount.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between font-bold"><span>Total</span><span>₹{selectedInvoice.total.toLocaleString('en-IN')}</span></div>
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
                <Button variant="outline" onClick={() => setSelectedInvoice(null)}>Close</Button>

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
                }}>
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
                    <div><span className="font-medium">Amount:</span> <span className="text-lg font-bold">₹{selectedInvoice.total.toLocaleString('en-IN')}</span></div>
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
                    description: `Invoice ${selectedInvoice.invoiceNumber} (₹${selectedInvoice.total.toLocaleString('en-IN')}) has been marked as paid.`,
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

    const totalAmount = `₹${invoice.total.toLocaleString('en-IN')}`;
    const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-IN');

    return {
      subject: `Invoice ${invoice.invoiceNumber} - Legal Services - Due ${dueDate}`,
      message: `Dear ${client?.name || 'Valued Client'},

We hope this email finds you well. ${urgencyText}Please find attached your invoice ${invoice.invoiceNumber} for legal services provided. The total amount due is ${totalAmount} and payment is due by ${dueDate}.

INVOICE SUMMARY:
• Invoice Number: ${invoice.invoiceNumber}
• Issue Date: ${new Date(invoice.issueDate).toLocaleDateString('en-IN')}
• Due Date: ${dueDate}
• Total Amount: ${totalAmount}

SERVICES PROVIDED:
${invoice.items.map(item => `• ${item.description} (Qty: ${item.quantity}, Rate: ₹${item.unitPrice.toLocaleString('en-IN')}, Amount: ₹${item.amount.toLocaleString('en-IN')})`).join('\n')}

PAYMENT BREAKDOWN:
• Subtotal: ₹${invoice.subtotal.toLocaleString('en-IN')}
${invoice.taxRate > 0 ? `• Tax (${invoice.taxRate}%): ₹${invoice.taxAmount.toLocaleString('en-IN')}` : ''}
${invoice.discountAmount > 0 ? `• Discount: -₹${invoice.discountAmount.toLocaleString('en-IN')}` : ''}
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