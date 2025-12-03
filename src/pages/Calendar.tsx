import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';
import { useLegalData, Case } from '@/contexts/LegalDataContext';
import { CaseDetailsPopup } from '@/components/CaseDetailsPopup';
import { CaseConflictChecker } from '@/components/CaseConflictChecker';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const Calendar = () => {
  const { cases, clients, addCase, updateCase, deleteCase, addClient, hearings } = useLegalData();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [showCaseDetails, setShowCaseDetails] = useState(false);
  const [caseForDetails, setCaseForDetails] = useState<Case | null>(null);

  // Form state
  const [formCaseNumber, setFormCaseNumber] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formCourtName, setFormCourtName] = useState('');
  const [formJudgeName, setFormJudgeName] = useState('');
  const [formHearingTime, setFormHearingTime] = useState('');
  const [formPriority, setFormPriority] = useState<Case['priority']>('medium');
  const [formDescription, setFormDescription] = useState('');

  // Get current month and year
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Get first day of the month and number of days
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // Generate calendar days
  const calendarDays = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Get cases and hearings for a specific date
  const getCasesForDate = (date: Date) => {
    const casesForDate = cases.filter(case_ => {
      if (!case_.hearingDate) return false;
      const caseDate = new Date(case_.hearingDate);
      return caseDate.toDateString() === date.toDateString();
    });

    // Also include hearings with next hearing dates
    const hearingsForDate = hearings.filter(hearing => {
      if (!hearing.nextHearingDate) return false;
      const hearingDate = new Date(hearing.nextHearingDate);
      return hearingDate.toDateString() === date.toDateString();
    });

    // Combine cases and hearings, marking hearings with a special property
    const combinedEvents = [
      ...casesForDate.map(case_ => ({ ...case_, isHearing: false, eventType: 'case' })),
      ...hearingsForDate.map(hearing => {
        // Use populated case data if available, otherwise fallback to finding the case
        const caseData = (hearing as any).populatedCase || 
          (hearing.caseId && typeof hearing.caseId === 'object' ? hearing.caseId : null);
        
        return { 
          ...hearing, 
          isHearing: true, 
          eventType: 'next_hearing',
          caseNumber: caseData?.caseNumber || `Case ${hearing.caseId}`,
          clientName: caseData?.clientName || 'Client Name Not Found',
          courtName: hearing.courtName,
          judgeName: hearing.judgeName,
          hearingTime: hearing.nextHearingTime,
          hearingDate: hearing.nextHearingDate,
          description: hearing.purpose || hearing.courtInstructions || 'Next hearing scheduled'
        };
      })
    ];

    return combinedEvents;
  };

  // Check for conflicts (same court, overlapping times)
  const getConflictsForDate = (date: Date) => {
    const casesForDay = getCasesForDate(date);
    const conflicts: string[] = [];
    
    casesForDay.forEach((case1, i) => {
      casesForDay.slice(i + 1).forEach(case2 => {
        if (case1.courtName === case2.courtName) {
          const time1 = case1.hearingTime || '10:00';
          const time2 = case2.hearingTime || '10:00';
          const timeDiff = Math.abs(
            new Date(`2000-01-01 ${time1}`).getTime() - 
            new Date(`2000-01-01 ${time2}`).getTime()
          );
          
          if (timeDiff < 2 * 60 * 60 * 1000) { // Less than 2 hours apart
            conflicts.push(`${case1.caseNumber} & ${case2.caseNumber}`);
          }
        }
      });
    });
    
    return conflicts;
  };

  // Navigate months
  const previousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Get today's date
  const today = new Date();
  const isToday = (day: number) => {
    return today.getDate() === day && 
           today.getMonth() === currentMonth && 
           today.getFullYear() === currentYear;
  };

  // Get selected date cases
  const selectedDateCases = useMemo(() => (selectedDate ? getCasesForDate(selectedDate) : []), [selectedDate, cases]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getPriorityColor = (priority: Case['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-warning text-warning-foreground';
      case 'medium': return 'bg-primary text-primary-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const openCreateModal = () => {
    if (!selectedDate) setSelectedDate(new Date());
    setEditingCase(null);
    setFormCaseNumber('');
    setFormClientName('');
    setFormCourtName('');
    setFormJudgeName('');
    setFormHearingTime('');
    setFormPriority('medium');
    setFormDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Case) => {
    setEditingCase(c);
    setSelectedDate(c.hearingDate ? new Date(c.hearingDate) : new Date());
    setFormCaseNumber(c.caseNumber || '');
    setFormClientName(c.clientName || '');
    setFormCourtName(c.courtName || '');
    setFormJudgeName(c.judgeName || '');
    setFormHearingTime(c.hearingTime || '');
    setFormPriority(c.priority || 'medium');
    setFormDescription(c.description || '');
    setIsModalOpen(true);
  };

  const resetModal = () => {
    setIsModalOpen(false);
    setEditingCase(null);
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    const trimmedCaseNumber = formCaseNumber.trim();
    const trimmedClientName = formClientName.trim();
    const trimmedCourtName = formCourtName.trim();
    const trimmedDescription = formDescription.trim();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (selectedDate < startOfToday) {
      toast({
        title: 'Invalid date',
        description: 'You cannot schedule hearings in the past.',
        variant: 'destructive'
      });
      return;
    }

    if (!trimmedCaseNumber) {
      toast({
        title: 'Validation error',
        description: 'Case number is required.',
        variant: 'destructive'
      });
      return;
    }

    if (!trimmedClientName) {
      toast({
        title: 'Validation error',
        description: 'Client name is required.',
        variant: 'destructive'
      });
      return;
    }

    if (!trimmedCourtName) {
      toast({
        title: 'Validation error',
        description: 'Court name is required.',
        variant: 'destructive'
      });
      return;
    }

    const basePayload = {
      caseNumber: trimmedCaseNumber,
      clientName: trimmedClientName,
      opposingParty: '',
      courtName: trimmedCourtName,
      judgeName: formJudgeName.trim(),
      hearingDate: selectedDate,
      hearingTime: formHearingTime.trim(),
      status: 'active' as const,
      priority: formPriority,
      caseType: '',
      description: trimmedDescription,
      nextHearing: undefined as unknown as Date,
      documents: [] as string[],
      notes: '',
      alerts: [],
    };

    if (editingCase) {
      await updateCase(editingCase.id, basePayload as Partial<Case>);
    } else {
      // Check if client exists, if not create a new client
      const existingClient = clients.find(client => 
        client.name.toLowerCase() === formClientName.trim().toLowerCase()
      );
      
      if (!existingClient) {
        // Create new client with minimal information
        await addClient({
          name: formClientName.trim(),
          email: 'pending@example.com', // Temporary email, will be updated later
          phone: '0000000000', // Temporary phone, will be updated later
          address: '', // Will be filled later in client interface
          panNumber: '', // Will be filled later in client interface
          aadharNumber: '', // Will be filled later in client interface
          cases: [],
          documents: [],
          notes: `Auto-created when adding case: ${formCaseNumber.trim()}. Please update email and phone details.`
        });
      }
      
      try {
        console.log('Creating new case from calendar:', formCaseNumber.trim());
        await addCase(basePayload as Omit<Case, 'id' | 'createdAt' | 'updatedAt'>);
        console.log('Case created successfully from calendar');
      } catch (error) {
        console.error('Error creating case from calendar:', error);
        toast({
          title: 'Failed to create case',
          description: error instanceof Error ? error.message : 'Unable to create case. Please try again.',
          variant: 'destructive'
        });
        return;
      }
    }
    resetModal();
    toast({
      title: editingCase ? 'Case updated' : 'Case created',
      description: editingCase ? 'Case has been updated.' : 'Case has been scheduled.'
    });
  };

  const handleDelete = async (c: Case) => {
    await deleteCase(c.id);
  };

  const handleViewCaseDetails = (hearing: any) => {
    // Try multiple approaches to find the case
    let associatedCase = null;
    
    // First, try using the populated case data if available
    if (hearing.populatedCase && hearing.populatedCase._id) {
      associatedCase = cases.find(c => c.id === hearing.populatedCase._id);
    }
    
    // If not found, try the regular caseId approach
    if (!associatedCase) {
      associatedCase = cases.find(c => 
        c.id === hearing.caseId || 
        c.id === hearing.caseId.toString() || 
        hearing.caseId === c.id || 
        hearing.caseId === c.id.toString()
      );
    }
    
    // If still not found, try finding by case number if we have it
    if (!associatedCase && hearing.caseNumber && hearing.caseNumber !== `Case ${hearing.caseId}`) {
      associatedCase = cases.find(c => c.caseNumber === hearing.caseNumber);
    }
    
    if (associatedCase) {
      setCaseForDetails(associatedCase);
      setShowCaseDetails(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Legal Calendar</h1>
          <p className="text-muted-foreground">Court hearings and important dates</p>
        </div>
        <Button onClick={openCreateModal} >
          <Plus className="mr-2 h-4 w-4" />
          Schedule Hearing
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2 shadow-elevated">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                {monthNames[currentMonth]} {currentYear}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={previousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription>Click on a date to view scheduled hearings</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Week headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <div key={index} className="p-2 h-16"></div>;
                }

                const date = new Date(currentYear, currentMonth, day);
                const casesForDay = getCasesForDate(date);
                const conflictsForDay = getConflictsForDate(date);
                const isSelected = selectedDate?.toDateString() === date.toDateString();

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "p-2 h-16 border rounded-lg cursor-pointer transition-colors hover:bg-muted",
                      isToday(day) && "bg-primary text-primary-foreground",
                      isSelected && !isToday(day) && "bg-accent text-accent-foreground",
                      casesForDay.length > 0 && "border-primary",
                      conflictsForDay.length > 0 && "border-destructive bg-destructive/5"
                    )}
                  >
                    <div className="text-sm font-medium">{day}</div>
                    {casesForDay.length > 0 && (
                      <div className="text-xs">
                        <div className="flex flex-wrap gap-1 mt-1">
                          {casesForDay.slice(0, 2).map((event, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "w-2 h-2 rounded-full",
                                event.isHearing ? 'bg-blue-500' :
                                event.priority === 'urgent' ? 'bg-destructive' :
                                event.priority === 'high' ? 'bg-warning' :
                                event.priority === 'medium' ? 'bg-primary' : 'bg-muted-foreground'
                              )}
                              title={event.isHearing ? 'Next Hearing' : `${event.priority} priority case`}
                            />
                          ))}
                          {casesForDay.length > 2 && (
                            <span className="text-xs">+{casesForDay.length - 2}</span>
                          )}
                        </div>
                        {conflictsForDay.length > 0 && (
                          <div className="text-xs text-destructive font-medium mt-1">
                            ⚠ Conflict
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Date Details */}
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              {selectedDate ? selectedDate.toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : 'Select a Date'}
            </CardTitle>
            <CardDescription>
              {selectedDate ? (
                selectedDateCases.length > 0 ? 
                `${selectedDateCases.length} hearing${selectedDateCases.length > 1 ? 's' : ''} scheduled` :
                'No hearings scheduled'
              ) : 'Click on a date to view hearings'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDateCases.length > 0 ? (
              <div className="space-y-4">
                {selectedDateCases.map((event, index) => (
                  <div key={event.id || index} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">
                        {event.isHearing ? `Next Hearing - ${event.caseNumber}` : event.caseNumber}
                      </h4>
                      <div className="flex items-center gap-2">
                        {event.isHearing ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            Next Hearing
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={getPriorityColor(event.priority)}>
                            {event.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        <span>{event.isHearing ? event.clientName : event.clientName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        <span>{event.courtName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span>{event.hearingTime || 'Time not specified'}</span>
                      </div>
                      {event.judgeName && (
                        <div className="flex items-center gap-2">
                          <FileText className="h-3 w-3" />
                          <span>{event.judgeName}</span>
                        </div>
                      )}
                      {event.isHearing && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CalendarIcon className="h-3 w-3" />
                          <span>Scheduled Next Hearing</span>
                        </div>
                      )}
                    </div>
                    
                    {event.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                    )}
                    
                    {!event.isHearing && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(event)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(event)}>Delete</Button>
                      </div>
                    )}
                    
                    {event.isHearing && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => handleViewCaseDetails(event)}
                        >
                          View in Case Details
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : selectedDate ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hearings scheduled for this date</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={openCreateModal}>
                  <Plus className="mr-2 h-3 w-3" />
                  Schedule Hearing
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a date to view hearings</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Hearings */}
      <Card className="shadow-card-custom">
        <CardHeader>
          <CardTitle>Upcoming Hearings</CardTitle>
          <CardDescription>Next 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {cases
              .filter(case_ => {
                if (!case_.hearingDate) return false;
                const caseDate = new Date(case_.hearingDate);
                const sevenDaysFromNow = new Date();
                sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
                return caseDate >= today && caseDate <= sevenDaysFromNow;
              })
              .sort((a, b) => new Date(a.hearingDate).getTime() - new Date(b.hearingDate).getTime())
              .slice(0, 5)
              .map((case_) => (
                <div key={case_.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{case_.caseNumber}</span>
                      <Badge variant="outline" className={getPriorityColor(case_.priority)}>
                        {case_.priority}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {case_.clientName} • {case_.courtName}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium">
                      {new Date(case_.hearingDate).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="text-muted-foreground">
                      {case_.hearingTime || 'Time TBD'}
                    </div>
                  </div>
                </div>
              ))}
            
            {cases.filter(case_ => {
              if (!case_.hearingDate) return false;
              const caseDate = new Date(case_.hearingDate);
              const sevenDaysFromNow = new Date();
              sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
              return caseDate >= today && caseDate <= sevenDaysFromNow;
            }).length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No upcoming hearings in the next 7 days</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) resetModal(); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCase ? 'Edit Hearing' : 'Schedule Hearing'}</DialogTitle>
            <DialogDescription>
              {selectedDate ? selectedDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="caseNumber">Case Number</Label>
                <Input id="caseNumber" value={formCaseNumber} onChange={(e) => setFormCaseNumber(e.target.value)} placeholder="e.g., C/123/2025" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input id="clientName" value={formClientName} onChange={(e) => setFormClientName(e.target.value)} placeholder="Client" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="courtName">Court</Label>
                <Input id="courtName" value={formCourtName} onChange={(e) => setFormCourtName(e.target.value)} placeholder="Court name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="judgeName">Judge</Label>
                <Input id="judgeName" value={formJudgeName} onChange={(e) => setFormJudgeName(e.target.value)} placeholder="Judge name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="hearingTime">Time</Label>
                <Input id="hearingTime" type="time" value={formHearingTime} onChange={(e) => setFormHearingTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formPriority} onValueChange={(v) => setFormPriority(v as Case['priority'])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
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
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Optional details" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetModal}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formCaseNumber.trim() || !formClientName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Conflict Checker */}
      <CaseConflictChecker 
        currentCase={editingCase || (isModalOpen ? {
          id: 'temp',
          caseNumber: formCaseNumber,
          clientName: formClientName,
          opposingParty: '',
          courtName: formCourtName,
          judgeName: formJudgeName,
          hearingDate: selectedDate || new Date(),
          hearingTime: formHearingTime,
          status: 'active' as const,
          priority: formPriority,
          caseType: '',
          description: formDescription,
          nextHearing: undefined,
          documents: [],
          notes: '',
          alerts: [],
          createdAt: new Date(),
          updatedAt: new Date()
        } as Case : undefined)}
      />

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

export default Calendar;
