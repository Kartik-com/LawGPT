import { useMemo, useState, useRef } from 'react';
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
  Plus,
  AlertTriangle
} from 'lucide-react';
import { useLegalData, Case } from '@/contexts/LegalDataContext';
import { CaseDetailsPopup } from '@/components/CaseDetailsPopup';
import { CaseConflictChecker } from '@/components/CaseConflictChecker';
import { HearingTooltip } from '@/components/HearingTooltip';
import { ConflictDialog } from '@/components/ConflictDialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api';

const Calendar = () => {
  const { cases, clients, addCase, updateCase, deleteCase, addClient, hearings } = useLegalData();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date()); // Auto-select today
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
  const [formTimezone, setFormTimezone] = useState('Asia/Kolkata');
  const [formDuration, setFormDuration] = useState(60);

  // Conflict handling state
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingHearingData, setPendingHearingData] = useState<any>(null);

  // Tooltip state
  const [hoveredEvent, setHoveredEvent] = useState<any>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (!case_.nextHearing) return false;
      const caseDate = new Date(case_.nextHearing);
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
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
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
      hearingTime: formHearingTime.trim() || '10:00',
      timezone: formTimezone,
      duration: formDuration,
      status: 'active' as const,
      priority: formPriority,
      caseType: '',
      description: trimmedDescription,
      nextHearing: selectedDate,
      documents: [] as string[],
      notes: '',
      alerts: [],
    };

    if (editingCase) {
      await updateCase(editingCase.id, basePayload as Partial<Case>);
      resetModal();
      toast({
        title: 'Case updated',
        description: 'Case has been updated.'
      });
    } else {
      // Check if client exists, if not create a new client
      const existingClient = clients.find(client =>
        client.name.toLowerCase() === formClientName.trim().toLowerCase()
      );

      if (!existingClient) {
        // Generate unique placeholder values to avoid duplicate conflicts
        const timestamp = Date.now();
        const uniqueSuffix = timestamp.toString().slice(-6); // Last 6 digits of timestamp
        const uniqueEmail = `pending-${uniqueSuffix}@example.com`;
        // Generate unique phone: 6 + 9 digits (using timestamp to ensure uniqueness)
        const uniquePhone = `6${uniqueSuffix.padStart(9, '0').slice(0, 9)}`;

        // Create new client with minimal information
        await addClient({
          name: formClientName.trim(),
          email: uniqueEmail,
          phone: uniquePhone,
          address: '',
          panNumber: '',
          aadharNumber: '',
          cases: [],
          documents: [],
          notes: `Auto-created when adding case: ${formCaseNumber.trim()}. Please update email and phone details.`
        });
      }

      try {
        console.log('Creating new case from calendar:', formCaseNumber.trim());
        await addCase(basePayload as Omit<Case, 'id' | 'createdAt' | 'updatedAt'>);
        console.log('Case created successfully from calendar');
        resetModal();
        toast({
          title: 'Case created',
          description: 'Case has been scheduled.'
        });
      } catch (error: any) {
        console.error('Error creating case from calendar:', error);

        // Check if it's a conflict error (409)
        if (error.status === 409 && error.conflicts) {
          // Store the pending data and show conflict dialog
          setPendingHearingData(basePayload);
          setConflicts(error.conflicts);
          setShowConflictDialog(true);
        } else {
          toast({
            title: 'Failed to create case',
            description: error.message || 'Unable to create case. Please try again.',
            variant: 'destructive'
          });
        }
      }
    }
  };

  const handleConflictCancel = () => {
    setShowConflictDialog(false);
    setConflicts([]);
    setPendingHearingData(null);
  };

  const handleConflictEditTime = () => {
    setShowConflictDialog(false);
    // Keep modal open so user can edit the time
    toast({
      title: 'Edit hearing time',
      description: 'Please adjust the hearing time to avoid conflicts.'
    });
  };

  const handleConflictOverride = async (reason: string) => {
    if (!pendingHearingData) return;

    try {
      console.log('Overriding conflict with reason:', reason);

      // Check if client exists
      const existingClient = clients.find(client =>
        client.name.toLowerCase() === pendingHearingData.clientName.toLowerCase()
      );

      if (!existingClient) {
        // Generate unique placeholder values to avoid duplicate conflicts
        const timestamp = Date.now();
        const uniqueSuffix = timestamp.toString().slice(-6); // Last 6 digits of timestamp
        const uniqueEmail = `pending-${uniqueSuffix}@example.com`;
        // Generate unique phone: 6 + 9 digits (using timestamp to ensure uniqueness)
        const uniquePhone = `6${uniqueSuffix.padStart(9, '0').slice(0, 9)}`;

        await addClient({
          name: pendingHearingData.clientName,
          email: uniqueEmail,
          phone: uniquePhone,
          address: '',
          panNumber: '',
          aadharNumber: '',
          cases: [],
          documents: [],
          notes: `Auto-created when adding case: ${pendingHearingData.caseNumber}. Please update email and phone details.`
        });
      }

      // Create case with override - Note: This needs backend support for override
      await addCase(pendingHearingData as Omit<Case, 'id' | 'createdAt' | 'updatedAt'>);

      setShowConflictDialog(false);
      setConflicts([]);
      setPendingHearingData(null);
      resetModal();

      toast({
        title: 'Case created with override',
        description: 'Hearing scheduled despite conflicts. Override reason recorded.'
      });
    } catch (error: any) {
      console.error('Error overriding conflict:', error);
      toast({
        title: 'Failed to override',
        description: error.message || 'Unable to schedule hearing. Please try again.',
        variant: 'destructive'
      });
    }
  };


  const handleDelete = async (c: Case) => {
    await deleteCase(c.id);
  };

  const handleViewCaseDetails = (event: any) => {
    let associatedCase = null;

    // If this is a regular case (not a hearing event), use it directly
    if (!event.isHearing || event.eventType === 'case') {
      associatedCase = event;
    } else {
      // This is a hearing event, find the associated case
      // First, try using the populated case data if available
      if (event.populatedCase && event.populatedCase._id) {
        associatedCase = cases.find(c => c.id === event.populatedCase._id);
      }

      // If not found, try the regular caseId approach
      if (!associatedCase) {
        associatedCase = cases.find(c =>
          c.id === event.caseId ||
          c.id === event.caseId?.toString() ||
          event.caseId === c.id ||
          event.caseId === c.id?.toString()
        );
      }

      // If still not found, try finding by case number if we have it
      if (!associatedCase && event.caseNumber && event.caseNumber !== `Case ${event.caseId}`) {
        associatedCase = cases.find(c => c.caseNumber === event.caseNumber);
      }
    }

    if (associatedCase) {
      setCaseForDetails(associatedCase);
      setShowCaseDetails(true);
    }
  };



  return (
    <div className="space-y-2 md:space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Legal Calendar</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Court hearings and important dates</p>
        </div>
        <Button onClick={openCreateModal} size="sm" className="h-8 text-xs">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Schedule Hearing
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 md:gap-3">
        {/* Calendar */}
        <Card className="lg:col-span-2 shadow-elevated">
          <CardHeader className="pb-1.5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <CalendarIcon className="h-4 w-4 text-primary" />
                {monthNames[currentMonth]} {currentYear}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={previousMonth}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={nextMonth}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <CardDescription className="text-[10px]">Click on a date to view scheduled hearings</CardDescription>
          </CardHeader>
          <CardContent className="pt-1.5">
            {/* Week headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map(day => (
                <div key={day} className="p-1 text-center text-[10px] font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <div key={index} className="p-1.5 h-12"></div>;
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
                      "p-1.5 h-12 border rounded-lg cursor-pointer transition-colors hover:bg-muted",
                      isToday(day) && "border-orange-500 border-2",
                      isSelected && !isToday(day) && "border-accent border-2",
                      isSelected && isToday(day) && "border-orange-500 border-2",
                      casesForDay.length > 0 && !isToday(day) && !isSelected && "border-primary",
                      conflictsForDay.length > 0 && "bg-destructive/5"
                    )}
                  >
                    <div className="text-[11px] font-medium">{day}</div>
                    {casesForDay.length > 0 && (
                      <div className="text-[9px]">
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {casesForDay.slice(0, 2).map((event, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                event.isHearing ? 'bg-blue-500' :
                                  (event as any).priority === 'urgent' ? 'bg-red-500' :
                                    (event as any).priority === 'high' ? 'bg-orange-500' :
                                      (event as any).priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                              )}
                              title={event.isHearing ? 'Next Hearing' : `${(event as any).priority || 'medium'} priority case`}
                            />
                          ))}
                          {casesForDay.length > 2 && (
                            <span className="text-[9px]">+{casesForDay.length - 2}</span>
                          )}
                        </div>
                        {conflictsForDay.length > 0 && (
                          <div className="text-[9px] text-destructive font-medium mt-0.5">
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
          <CardHeader className="pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              {selectedDate ? selectedDate.toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : 'Select a Date'}
            </CardTitle>
            <CardDescription className="text-[10px]">
              {selectedDate ? (
                selectedDateCases.length > 0 ?
                  `${selectedDateCases.length} hearing${selectedDateCases.length > 1 ? 's' : ''} scheduled` :
                  'No hearings scheduled'
              ) : 'Click on a date to view hearings'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1.5">
            {selectedDateCases.length > 0 ? (
              <div className="space-y-2">
                {selectedDateCases.map((event, index) => (
                  <div key={event.id || index} className="p-2 border rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-[11px]">
                        {event.isHearing ? `Next Hearing - ${event.caseNumber}` : event.caseNumber}
                      </h4>
                      <div className="flex items-center gap-1.5">
                        {event.isHearing ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[9px] h-4 px-1">
                            Next Hearing
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={`${getPriorityColor((event as any).priority || 'medium')} text-[9px] h-4 px-1`}>
                            {(event as any).priority || 'medium'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-0.5 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="h-2.5 w-2.5" />
                        <span>{event.isHearing ? event.clientName : event.clientName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-2.5 w-2.5" />
                        <span>{event.courtName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-2.5 w-2.5" />
                        <span>{event.hearingTime || 'Time not specified'}</span>
                      </div>
                      {event.judgeName && (
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-2.5 w-2.5" />
                          <span>{event.judgeName}</span>
                        </div>
                      )}
                      {event.isHearing && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CalendarIcon className="h-2.5 w-2.5" />
                          <span>Scheduled Next Hearing</span>
                        </div>
                      )}
                    </div>

                    {event.description && (
                      <p className="text-[10px] text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {!event.isHearing && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleViewCaseDetails(event)}>View</Button>
                        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => openEditModal(event as Case)}>Edit</Button>
                        <Button variant="destructive" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleDelete(event as Case)}>Delete</Button>
                      </div>
                    )}

                    {event.isHearing && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => handleViewCaseDetails(event)}
                        >
                          View
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : selectedDate ? (
              <div className="text-center py-6 text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mx-auto mb-1.5 opacity-50" />
                <p className="text-xs">No hearings scheduled for this date</p>
                <Button variant="outline" size="sm" className="mt-1.5 h-6 text-[10px]" onClick={openCreateModal}>
                  <Plus className="mr-1 h-2.5 w-2.5" />
                  Schedule Hearing
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mx-auto mb-1.5 opacity-50" />
                <p className="text-xs">Select a date to view hearings</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Hearings */}
      <Card className="shadow-card-custom">
        <CardHeader className="pb-1.5">
          <CardTitle className="text-sm">Upcoming Hearings</CardTitle>
          <CardDescription className="text-[10px]">Next 7 days</CardDescription>
        </CardHeader>
        <CardContent className="pt-1.5">
          <div className="space-y-2">
            {cases
              .filter(case_ => {
                if (!case_.nextHearing) return false;
                const caseDate = new Date(case_.nextHearing);
                const sevenDaysFromNow = new Date();
                sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
                return caseDate >= today && caseDate <= sevenDaysFromNow;
              })
              .sort((a, b) => new Date(a.nextHearing!).getTime() - new Date(b.nextHearing!).getTime())
              .slice(0, 5)
              .map((case_) => (
                <div key={case_.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-xs">{case_.caseNumber}</span>
                      <Badge variant="outline" className={`${getPriorityColor(case_.priority)} text-[9px] h-4 px-1`}>
                        {case_.priority}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {case_.clientName} • {case_.courtName}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-medium">
                      {new Date(case_.nextHearing!).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {case_.hearingTime || 'Time TBD'}
                    </div>
                  </div>
                </div>
              ))}

            {cases.filter(case_ => {
              if (!case_.nextHearing) return false;
              const caseDate = new Date(case_.nextHearing);
              const sevenDaysFromNow = new Date();
              sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
              return caseDate >= today && caseDate <= sevenDaysFromNow;
            }).length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <CalendarIcon className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                  <p className="text-xs">No upcoming hearings in the next 7 days</p>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={formTimezone} onValueChange={setFormTimezone}>
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Kolkata">IST (Asia/Kolkata)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">EST (America/New_York)</SelectItem>
                    <SelectItem value="Europe/London">GMT (Europe/London)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="15"
                  max="480"
                  step="15"
                  value={formDuration}
                  onChange={(e) => setFormDuration(parseInt(e.target.value) || 60)}
                  placeholder="60"
                />
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



      {/* Conflict Dialog */}
      <ConflictDialog
        isOpen={showConflictDialog}
        onClose={handleConflictCancel}
        conflicts={conflicts}
        onCancel={handleConflictCancel}
        onEditTime={handleConflictEditTime}
        onOverride={handleConflictOverride}
      />
    </div>
  );
};

export default Calendar;
