import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Calendar,
  User,
  Building,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { useLegalData, Case } from '@/contexts/LegalDataContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CaseConflictChecker } from '@/components/CaseConflictChecker';
import { CaseSummaryGenerator } from '@/components/CaseSummaryGenerator';
import { CaseDetailsPopup } from '@/components/CaseDetailsPopup';
import { useToast } from '@/hooks/use-toast';
import { useFormAutoSave } from '@/hooks/useFormAutoSave';

const COURT_OPTIONS = [
  'Supreme Court of India',
  'Delhi High Court',
  'Bombay High Court',
  'Calcutta High Court',
  'Madras High Court',
  'Allahabad High Court',
  'Punjab and Haryana High Court',
  'Gujarat High Court',
  'Karnataka High Court',
  'Kerala High Court',
  'District Court'
];

const Cases = () => {
  const { cases, clients, addCase, updateCase, deleteCase, addClient } = useLegalData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showCaseDetails, setShowCaseDetails] = useState(false);
  const [caseForDetails, setCaseForDetails] = useState<Case | null>(null);
  const { toast } = useToast();
  const [clientSelection, setClientSelection] = useState<{ mode: 'existing' | 'custom'; clientId?: string }>({ mode: 'custom' });
  const [courtSelectValue, setCourtSelectValue] = useState('');
  const todayIsoString = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!caseForDetails) return;
    const latest = cases.find(c => c.id === caseForDetails.id);
    if (latest && latest !== caseForDetails) {
      setCaseForDetails(latest);
    }
  }, [cases, caseForDetails]);

  // Form state for adding/editing cases
  const [formData, setFormData] = useState({
    caseNumber: '',
    clientName: '',
    opposingParty: '',
    courtName: '',
    judgeName: '',
    hearingDate: '',
    hearingTime: '',
    status: 'active' as Case['status'],
    priority: 'medium' as Case['priority'],
    caseType: '',
    description: '',
    notes: ''
  });

  // Auto-save form data (only when adding new case, not editing)
  const { clearSavedData, getSavedData } = useFormAutoSave('case-form', formData, {
    enabled: !selectedCase // Only auto-save for new cases, not edits
  });

  const resetForm = () => {
    setFormData({
      caseNumber: '',
      clientName: '',
      opposingParty: '',
      courtName: '',
      judgeName: '',
      hearingDate: '',
      hearingTime: '',
      status: 'active',
      priority: 'medium',
      caseType: '',
      description: '',
      notes: ''
    });
    setClientSelection({ mode: 'custom' });
    setCourtSelectValue('');
  };

  // Restore saved data when opening dialog for new case
  const handleOpenDialog = () => {
    setSelectedCase(null);
    const savedData = getSavedData();
    if (savedData) {
      setFormData(savedData);
      toast({
        title: 'Draft Restored',
        description: 'Your previously entered case data has been restored.',
        duration: 3000
      });
    } else {
      resetForm();
    }
  };

  const handleClientSelect = (value: string) => {
    if (value === '__custom__') {
      setClientSelection({ mode: 'custom' });
      setFormData(prev => ({ ...prev, clientName: '' }));
      return;
    }
    setClientSelection({ mode: 'existing', clientId: value });
    const selected = clients.find(client => client.id === value);
    setFormData(prev => ({ ...prev, clientName: selected?.name || '' }));
  };

  const handleCourtSelect = (value: string) => {
    if (value === '__custom__') {
      setCourtSelectValue('__custom__');
      setFormData(prev => ({ ...prev, courtName: '' }));
    } else {
      setCourtSelectValue(value);
      setFormData(prev => ({ ...prev, courtName: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedCaseNumber = formData.caseNumber.trim();
    const trimmedClientName = formData.clientName.trim();
    const trimmedCourtName = formData.courtName.trim();
    const trimmedDescription = formData.description.trim();
    const trimmedNotes = formData.notes.trim();

    if (!trimmedCaseNumber) {
      toast({
        title: 'Validation error',
        description: 'Case number is required',
        variant: 'destructive'
      });
      return;
    }

    let selectedClientRecord = null;
    if (clientSelection.mode === 'existing') {
      if (!clientSelection.clientId) {
        toast({
          title: 'Validation error',
          description: 'Please select an existing client or add a new one',
          variant: 'destructive'
        });
        return;
      }
      selectedClientRecord = clients.find(client => client.id === clientSelection.clientId);
      if (!selectedClientRecord) {
        toast({
          title: 'Client not found',
          description: 'Please refresh the page and try again.',
          variant: 'destructive'
        });
        return;
      }
    } else if (!trimmedClientName) {
      toast({
        title: 'Validation error',
        description: 'Client name is required',
        variant: 'destructive'
      });
      return;
    }

    if (!trimmedCourtName) {
      toast({
        title: 'Validation error',
        description: 'Court name is required',
        variant: 'destructive'
      });
      return;
    }

    if (formData.hearingDate) {
      const parsed = new Date(formData.hearingDate);
      if (Number.isNaN(parsed.getTime())) {
        toast({
          title: 'Validation error',
          description: 'Please provide a valid hearing date',
          variant: 'destructive'
        });
        return;
      }
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      if (parsed < startOfToday) {
        toast({
          title: 'Validation error',
          description: 'Next hearing date cannot be in the past',
          variant: 'destructive'
        });
        return;
      }
    }

    if (selectedCase) {
      // Update existing case
      const hearingDateObj = formData.hearingDate ? new Date(formData.hearingDate) : selectedCase.hearingDate;
      updateCase(selectedCase.id, {
        ...formData,
        caseNumber: trimmedCaseNumber,
        clientName: selectedClientRecord ? selectedClientRecord.name : trimmedClientName,
        courtName: trimmedCourtName,
        description: trimmedDescription,
        notes: trimmedNotes,
        hearingDate: hearingDateObj,
        nextHearing: hearingDateObj, // Update nextHearing to match hearingDate
        documents: selectedCase.documents,
        alerts: selectedCase.alerts
      });
    } else {
      // Ensure client exists if a new one was entered
      const existingClient = selectedClientRecord || clients.find(client =>
        client.name.toLowerCase() === trimmedClientName.toLowerCase()
      );

      let clientCreated = false;
      let createdClientId: string | null = null;

      // Try to create client if needed, but don't block case creation
      if (!existingClient && clientSelection.mode === 'custom') {
        try {
          // Generate unique placeholder values to avoid duplicate conflicts
          const timestamp = Date.now();
          const uniqueSuffix = timestamp.toString().slice(-6); // Last 6 digits of timestamp
          const uniqueEmail = `pending-${uniqueSuffix}@example.com`;
          // Generate unique phone: 6 + 9 digits (using timestamp to ensure uniqueness)
          const uniquePhone = `6${uniqueSuffix.padStart(9, '0').slice(0, 9)}`;

          // Use valid placeholder phone number that passes validation (starts with 6-9)
          const newClient = await addClient({
            name: trimmedClientName,
            email: uniqueEmail,
            phone: uniquePhone, // Valid placeholder that starts with 6, unique per creation
            address: '',
            panNumber: '',
            aadharNumber: '',
            cases: [],
            documents: [],
            notes: `Auto-created when adding case: ${trimmedCaseNumber}. Please update email and phone details.`
          }) as any; // Type assertion since addClient returns the client but type says void
          if (newClient && newClient.id) {
            clientCreated = true;
            createdClientId = newClient.id;
          }
        } catch (error) {
          console.error('Error creating client:', error);
          // Don't block case creation - just log the error
          // We'll show a notification after case is created
        }
      }

      // Create case regardless of client creation status
      try {
        const hearingDateObj = formData.hearingDate ? new Date(formData.hearingDate) : undefined as unknown as Date;
        await addCase({
          ...formData,
          caseNumber: trimmedCaseNumber,
          clientName: selectedClientRecord ? selectedClientRecord.name : trimmedClientName,
          courtName: trimmedCourtName,
          description: trimmedDescription,
          notes: trimmedNotes,
          hearingDate: hearingDateObj,
          nextHearing: hearingDateObj,
          documents: [],
          alerts: []
        });

        // Show success message
        toast({
          title: 'Case created',
          description: 'Case has been added successfully.'
        });

        // If client was auto-created, show notification to complete details
        if (clientCreated && createdClientId) {
          setTimeout(() => {
            toast({
              title: 'Complete Client Details',
              description: `Client "${trimmedClientName}" was auto-created. Please update email and phone number in Client Management.`,
              duration: 8000
            });
          }, 500);
        } else if (!existingClient && clientSelection.mode === 'custom' && !clientCreated) {
          // Client creation failed but case was created
          setTimeout(() => {
            toast({
              title: 'Action Required',
              description: `Case created but client creation failed. Please add client "${trimmedClientName}" manually in Client Management.`,
              variant: 'destructive',
              duration: 8000
            });
          }, 500);
        }
      } catch (error) {
        console.error('Error creating case:', error);
        toast({
          title: 'Failed to create case',
          description: error instanceof Error ? error.message : 'Unable to create case. Please try again.',
          variant: 'destructive'
        });
        return;
      }
    }

    // Success toast is now handled in the try block above for new cases
    if (selectedCase) {
      toast({
        title: 'Case updated',
        description: 'Case details have been updated.'
      });
    }

    // Clear saved draft data after successful submission
    clearSavedData();

    setShowAddDialog(false);
    setSelectedCase(null);
    resetForm();
  };

  // Filter cases based on search and filters
  const filteredCases = cases.filter(case_ => {
    const matchesSearch = case_.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      case_.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      case_.opposingParty.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || case_.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || case_.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusIcon = (status: Case['status']) => {
    switch (status) {
      case 'active': return <Clock className="h-3.5 w-3.5" />;
      case 'pending': return <AlertTriangle className="h-3.5 w-3.5" />;
      case 'won': return <CheckCircle className="h-3.5 w-3.5" />;
      case 'closed': return <XCircle className="h-3.5 w-3.5" />;
      case 'lost': return <XCircle className="h-3.5 w-3.5" />;
      default: return <FileText className="h-3.5 w-3.5" />;
    }
  };

  const getStatusColor = (status: Case['status']) => {
    switch (status) {
      case 'active': return 'default';
      case 'pending': return 'secondary';
      case 'won': return 'outline';
      case 'closed': return 'outline';
      case 'lost': return 'destructive';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: Case['priority']) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'outline';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Case Management</h1>
          <p className="text-xs text-muted-foreground">Manage all your legal cases efficiently</p>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialog} size="sm" className="h-8 text-xs">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add New Case
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedCase ? 'Edit Case' : 'Add New Case'}</DialogTitle>
              <DialogDescription>
                {selectedCase ? 'Update case information' : 'Enter the details for the new case'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="caseNumber">Case Number*</Label>
                  <Input
                    id="caseNumber"
                    value={formData.caseNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, caseNumber: e.target.value }))}
                    placeholder="e.g., CC/2024/001"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="clientSelect">Client*</Label>
                  <Select
                    value={clientSelection.mode === 'existing' ? (clientSelection.clientId ?? '') : '__custom__'}
                    onValueChange={handleClientSelect}
                  >
                    <SelectTrigger id="clientSelect">
                      <SelectValue placeholder="Select an existing client or add new" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">+ Add new client</SelectItem>
                    </SelectContent>
                  </Select>
                  {clientSelection.mode === 'custom' && (
                    <Input
                      className="mt-2"
                      value={formData.clientName}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                      placeholder="Client's full name"
                      required
                    />
                  )}
                  {clientSelection.mode === 'existing' && clientSelection.clientId && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Selected client: {formData.clientName || clients.find(c => c.id === clientSelection.clientId)?.name}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="opposingParty">Opposing Party</Label>
                  <Input
                    id="opposingParty"
                    value={formData.opposingParty}
                    onChange={(e) => setFormData(prev => ({ ...prev, opposingParty: e.target.value }))}
                    placeholder="Opposing party name"
                  />
                </div>
                <div>
                  <Label htmlFor="caseType">Case Type*</Label>
                  <Select value={formData.caseType} onValueChange={(value) => setFormData(prev => ({ ...prev, caseType: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select case type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="criminal">Criminal</SelectItem>
                      <SelectItem value="civil">Civil</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="property">Property</SelectItem>
                      <SelectItem value="tax">Tax</SelectItem>
                      <SelectItem value="labor">Labor</SelectItem>
                      <SelectItem value="constitutional">Constitutional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="courtName">Court Name*</Label>
                  <Select
                    value={courtSelectValue || undefined}
                    onValueChange={handleCourtSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a court" />
                    </SelectTrigger>
                    <SelectContent>
                      {COURT_OPTIONS.map(option => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">Other (enter manually)</SelectItem>
                    </SelectContent>
                  </Select>
                  {courtSelectValue === '__custom__' && (
                    <Input
                      className="mt-2"
                      value={formData.courtName}
                      onChange={(e) => setFormData(prev => ({ ...prev, courtName: e.target.value }))}
                      placeholder="Enter court name"
                      required
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="judgeName">Judge Name</Label>
                  <Input
                    id="judgeName"
                    value={formData.judgeName}
                    onChange={(e) => setFormData(prev => ({ ...prev, judgeName: e.target.value }))}
                    placeholder="Hon'ble Justice Name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hearingDate">Next Hearing Date</Label>
                  <Input
                    id="hearingDate"
                    type="date"
                    value={formData.hearingDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, hearingDate: e.target.value }))}
                    min={todayIsoString}
                  />
                </div>
                <div>
                  <Label htmlFor="hearingTime">Hearing Time</Label>
                  <Input
                    id="hearingTime"
                    type="time"
                    value={formData.hearingTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, hearingTime: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as Case['status'] }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as Case['priority'] }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Case Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the case..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes or observations..."
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowAddDialog(false); setSelectedCase(null); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit">
                  {selectedCase ? 'Update Case' : 'Add Case'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Search & Filter Cases</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-48">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by case number, client name, or opposing party..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredCases.map((case_) => (
          <Card
            key={case_.id}
            className="shadow-card-custom hover:shadow-elevated transition-shadow cursor-pointer"
            onClick={() => {
              setCaseForDetails(case_);
              setShowCaseDetails(true);
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    {getStatusIcon(case_.status)}
                    {case_.caseNumber}
                  </CardTitle>
                  <CardDescription className="text-[10px]">{case_.caseType}</CardDescription>
                </div>
                <div className="flex gap-0.5">
                  <Badge variant={getStatusColor(case_.status)} className="text-[10px] h-4 px-1">
                    {case_.status}
                  </Badge>
                  <Badge variant={getPriorityColor(case_.priority)} className="text-[10px] h-4 px-1">
                    {case_.priority}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{case_.clientName}</span>
                </div>
                {case_.opposingParty && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>vs</span>
                    <span>{case_.opposingParty}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs">
                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{case_.courtName}</span>
                </div>
                {case_.nextHearing && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      {new Date(case_.nextHearing).toLocaleDateString('en-IN')}
                      {case_.hearingTime && ` at ${case_.hearingTime}`}
                    </span>
                  </div>
                )}
                {case_.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {case_.description}
                  </p>
                )}
              </div>

              <div className="flex gap-1.5 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCase(case_);
                    setFormData({
                      caseNumber: case_.caseNumber,
                      clientName: case_.clientName,
                      opposingParty: case_.opposingParty,
                      courtName: case_.courtName,
                      judgeName: case_.judgeName,
                      hearingDate: case_.hearingDate ? case_.hearingDate.toISOString().split('T')[0] : '',
                      hearingTime: case_.hearingTime,
                      status: case_.status,
                      priority: case_.priority,
                      caseType: case_.caseType,
                      description: case_.description,
                      notes: case_.notes
                    });
                    const matchedClient = clients.find(client => client.name.toLowerCase() === case_.clientName.toLowerCase());
                    if (matchedClient) {
                      setClientSelection({ mode: 'existing', clientId: matchedClient.id });
                    } else {
                      setClientSelection({ mode: 'custom' });
                    }
                    setCourtSelectValue(COURT_OPTIONS.includes(case_.courtName) ? case_.courtName : '__custom__');
                    setShowAddDialog(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this case?')) {
                      deleteCase(case_.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCases.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <h3 className="text-sm font-semibold mb-1.5">No cases found</h3>
            <p className="text-xs text-muted-foreground mb-2">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'No cases match your search criteria.'
                : 'Start by adding your first case.'
              }
            </p>
            <Button onClick={() => setShowAddDialog(true)} size="sm" className="h-7 text-xs">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add First Case
            </Button>
          </CardContent>
        </Card>
      )}

      {/* AI Conflict Checker */}
      <CaseConflictChecker
        currentCase={selectedCase || (showAddDialog ? {
          id: 'temp',
          caseNumber: formData.caseNumber,
          clientName: formData.clientName,
          opposingParty: formData.opposingParty,
          courtName: formData.courtName,
          judgeName: formData.judgeName,
          hearingDate: formData.hearingDate ? new Date(formData.hearingDate) : new Date(),
          hearingTime: formData.hearingTime,
          status: formData.status,
          priority: formData.priority,
          caseType: formData.caseType,
          description: formData.description,
          nextHearing: undefined,
          documents: [],
          notes: formData.notes,
          alerts: [],
          createdAt: new Date(),
          updatedAt: new Date()
        } as Case : undefined)}
      />

      {/* AI Case Summary Generator */}
      {selectedCase && (
        <CaseSummaryGenerator caseId={selectedCase.id} />
      )}

      {/* Case Details Popup */}
      <CaseDetailsPopup
        case_={caseForDetails}
        isOpen={showCaseDetails}
        onClose={() => {
          setShowCaseDetails(false);
          setCaseForDetails(null);
        }}
      />
    </div>
  );
};

export default Cases;