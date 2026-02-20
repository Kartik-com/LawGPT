import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getApiUrl, apiFetch } from '@/lib/api';

export interface Case {
  id: string;
  caseNumber: string;
  clientName: string;
  opposingParty: string;
  courtName: string;
  judgeName: string;
  hearingDate: Date;
  hearingTime: string;
  status: 'active' | 'pending' | 'closed' | 'won' | 'lost';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  caseType: string;
  description: string;
  nextHearing?: Date;
  documents: string[];
  notes: string;
  alerts: Alert[];
  createdAt: Date;
  updatedAt: Date;
  folderId?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  panNumber?: string;
  aadharNumber?: string;
  cases: string[]; // Case IDs
  documents: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Alert {
  id: string;
  caseId: string;
  type: 'hearing' | 'deadline' | 'payment' | 'document';
  message: string;
  alertTime: Date;
  isRead: boolean;
  createdAt: Date;
}

export interface LegalSection {
  id: string;
  actName: string;
  sectionNumber: string;
  title: string;
  description: string;
  punishment?: string;
  keywords: string[];
}

export interface TimeEntry {
  id: string;
  caseId: string;
  description: string;
  duration: number; // in minutes
  hourlyRate: number;
  date: Date;
  billable: boolean;
}

export interface Hearing {
  id: string;
  caseId: string;
  hearingDate: Date;
  hearingTime?: string;
  courtName: string;
  judgeName?: string;
  hearingType: 'first_hearing' | 'interim_hearing' | 'final_hearing' | 'evidence_hearing' | 'argument_hearing' | 'judgment_hearing' | 'other';
  status: 'scheduled' | 'completed' | 'adjourned' | 'cancelled';
  purpose?: string;
  courtInstructions?: string;
  documentsToBring: string[];
  proceedings?: string;
  nextHearingDate?: Date;
  nextHearingTime?: string;
  adjournmentReason?: string;
  attendance: {
    clientPresent: boolean;
    opposingPartyPresent: boolean;
    witnessesPresent: string[];
  };
  orders: Array<{
    orderType: string;
    orderDetails: string;
    orderDate: Date;
  }>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  caseId?: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  currency: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  notes?: string;
  terms?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface LegalDataContextType {
  // Cases
  cases: Case[];
  addCase: (case_: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Case>;
  updateCase: (id: string, updates: Partial<Case>) => Promise<Case>;
  deleteCase: (id: string) => Promise<void>;
  getCaseById: (caseId: string) => Case | undefined;
  refreshCase: (caseId: string) => Promise<Case>;

  // Client operations
  clients: Client[];
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Client>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;

  // Alerts
  alerts: Alert[];
  addAlert: (alertData: Omit<Alert, 'id' | 'createdAt'>) => void;
  markAlertAsRead: (alertId: string) => void;
  deleteAlert: (alertId: string) => void;

  // Legal Sections
  legalSections: LegalSection[];
  searchLegalSections: (query: string) => LegalSection[];

  // Time Entries
  timeEntries: TimeEntry[];
  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => void;

  // Hearings
  hearings: Hearing[];
  addHearing: (hearing: Omit<Hearing, 'id' | 'createdAt' | 'updatedAt'>, override?: boolean, overrideReason?: string) => Promise<void>;
  updateHearing: (hearingId: string, updates: Partial<Hearing>, override?: boolean, overrideReason?: string) => void;
  deleteHearing: (hearingId: string) => void;
  getHearingsByCaseId: (caseId: string) => Hearing[];
  checkHearingConflict: (startAt: Date, endAt: Date, timezone: string, resourceScope?: any, excludeHearingId?: string) => Promise<{ hasConflict: boolean; conflicts: any[] }>;

  // Invoices
  invoices: Invoice[];
  createInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateInvoice: (invoiceId: string, updates: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (invoiceId: string) => Promise<void>;
  sendInvoice: (invoiceId: string, payload: { to?: string; subject?: string; message?: string }) => Promise<{ previewUrl?: string }>;
}

const LegalDataContext = createContext<LegalDataContextType | undefined>(undefined);

export const useLegalData = () => {
  const context = useContext(LegalDataContext);
  if (context === undefined) {
    throw new Error('useLegalData must be used within a LegalDataProvider');
  }
  return context;
};

interface LegalDataProviderProps {
  children: ReactNode;
}

// Mock Indian Legal Sections Data
const mockLegalSections: LegalSection[] = [
  {
    id: '1',
    actName: 'Indian Penal Code, 1860',
    sectionNumber: '302',
    title: 'Punishment for murder',
    description: 'Whoever commits murder shall be punished with death, or imprisonment for life, and shall also be liable to fine.',
    punishment: 'Death or life imprisonment and fine',
    keywords: ['murder', 'death', 'life imprisonment', 'killing']
  },
  {
    id: '2',
    actName: 'Indian Penal Code, 1860',
    sectionNumber: '420',
    title: 'Cheating and dishonestly inducing delivery of property',
    description: 'Whoever cheats and thereby dishonestly induces the person deceived to deliver any property to any person...',
    punishment: 'Imprisonment up to 7 years and fine',
    keywords: ['cheating', 'fraud', 'property', 'dishonestly']
  },
  {
    id: '3',
    actName: 'Code of Criminal Procedure, 1973',
    sectionNumber: '154',
    title: 'Information in cognizable cases',
    description: 'Every information relating to the commission of a cognizable offence...',
    punishment: 'N/A - Procedural',
    keywords: ['FIR', 'cognizable', 'information', 'police']
  },
  {
    id: '4',
    actName: 'Indian Contract Act, 1872',
    sectionNumber: '10',
    title: 'What agreements are contracts',
    description: 'All agreements are contracts if they are made by the free consent of parties competent to contract...',
    punishment: 'N/A - Civil Law',
    keywords: ['contract', 'agreement', 'consent', 'competent']
  }
];

export const LegalDataProvider: React.FC<LegalDataProviderProps> = ({ children }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [legalSections] = useState<LegalSection[]>(mockLegalSections);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Get authentication status
  const { isAuthenticated } = useAuth();

  // Initial loads - only fetch if user is authenticated
  React.useEffect(() => {
    // Don't fetch data if user is not authenticated
    if (!isAuthenticated) {
      return;
    }

    let mounted = true;
    const abortController = new AbortController();

    // Load initial data from API
    Promise.all([
      apiFetch(getApiUrl('/api/cases'), { credentials: 'include', signal: abortController.signal })
        .then(r => {
          if (r.status === 401) {
            // User not authenticated, return empty array
            return [];
          }
          return r.ok ? r.json() : Promise.resolve([]);
        })
        .catch(() => []),
      apiFetch(getApiUrl('/api/clients'), { credentials: 'include', signal: abortController.signal })
        .then(r => {
          if (r.status === 401) return [];
          return r.ok ? r.json() : Promise.resolve([]);
        })
        .catch(() => []),
      apiFetch(getApiUrl('/api/alerts'), { credentials: 'include', signal: abortController.signal })
        .then(r => {
          if (r.status === 401) return [];
          return r.ok ? r.json() : Promise.resolve([]);
        })
        .catch(() => []),
      apiFetch(getApiUrl('/api/time-entries'), { credentials: 'include', signal: abortController.signal })
        .then(r => {
          if (r.status === 401) return [];
          return r.ok ? r.json() : Promise.resolve([]);
        })
        .catch(() => []),
      apiFetch(getApiUrl('/api/hearings'), { credentials: 'include', signal: abortController.signal })
        .then(r => {
          if (r.status === 401) return [];
          return r.ok ? r.json() : Promise.resolve([]);
        })
        .catch(() => []),
      apiFetch(getApiUrl('/api/invoices'), { credentials: 'include', signal: abortController.signal })
        .then(r => {
          if (r.status === 401) return [];
          return r.ok ? r.json() : Promise.resolve([]);
        })
        .catch(() => []),
    ]).then(([casesRes, clientsRes, alertsRes, timeEntriesRes, hearingsRes, invoicesRes]) => {
      if (!mounted) return;
      setCases(Array.isArray(casesRes) ? casesRes.map(mapCaseFromApi) : []);
      setClients(Array.isArray(clientsRes) ? clientsRes.map(mapClientFromApi) : []);
      setAlerts(Array.isArray(alertsRes) ? alertsRes.map(mapAlertFromApi) : []);
      setTimeEntries(Array.isArray(timeEntriesRes) ? timeEntriesRes.map(mapTimeEntryFromApi) : []);
      const mappedHearings = Array.isArray(hearingsRes) ? hearingsRes.map(mapHearingFromApi) : [];
      setHearings(mappedHearings);
      setInvoices(Array.isArray(invoicesRes) ? invoicesRes.map(mapInvoiceFromApi) : []);
    }).catch((error) => {
      // Silently ignore errors; UI can still function without data
      // Don't log aborted requests or 401 errors as they're expected
      if (!abortController.signal.aborted && error.status !== 401) {
        // Error logging removed for production
      }
    });

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [isAuthenticated]);

  // Case management functions
  const addCase = async (caseData: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>) => {
    const res = await apiFetch(getApiUrl('/api/cases'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(caseData) });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Failed to create case' }));
      throw new Error(errorData.error || 'Failed to create case');
    }
    const saved = await res.json();
    const mappedCase = mapCaseFromApi(saved);
    setCases(prev => [...prev, mappedCase]);
    return mappedCase;
  };

  const updateCase = async (caseId: string, updates: Partial<Case>): Promise<Case> => {
    const res = await apiFetch(getApiUrl(`/api/cases/${caseId}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(updates) });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Failed to update case' }));
      throw new Error(errorData.error || 'Failed to update case');
    }
    const saved = await res.json();
    const mappedCase = mapCaseFromApi(saved);
    setCases(prev => prev.map(c => c.id === caseId ? mappedCase : c));
    return mappedCase;
  };

  const deleteCase = async (caseId: string): Promise<void> => {
    const res = await apiFetch(getApiUrl(`/api/cases/${caseId}`), { method: 'DELETE', credentials: 'include' });
    if (!res.ok) {
      throw new Error('Failed to delete case');
    }
    setCases(prev => prev.filter(c => c.id !== caseId));
  };

  const getCaseById = (caseId: string) => {
    return cases.find(c => c.id === caseId);
  };

  // Client management functions
  const addClient = async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const res = await apiFetch(getApiUrl('/api/clients'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(clientData) });
      if (res.ok) {
        const saved = await res.json();
        setClients(prev => [...prev, mapClientFromApi(saved)]);
        return saved;
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to create client' }));
        throw new Error(errorData.error || 'Failed to create client');
      }
    } catch (error) {
      throw error;
    }
  };

  const updateClient = async (clientId: string, updates: Partial<Client>): Promise<Client> => {
    const res = await apiFetch(getApiUrl(`/api/clients/${clientId}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(updates) });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Failed to update client' }));
      throw new Error(errorData.error || 'Failed to update client');
    }
    const saved = await res.json();
    const mappedClient = mapClientFromApi(saved);
    setClients(prev => prev.map(c => c.id === clientId ? mappedClient : c));
    return mappedClient;
  };

  const deleteClient = async (clientId: string): Promise<void> => {
    const res = await apiFetch(getApiUrl(`/api/clients/${clientId}`), { method: 'DELETE', credentials: 'include' });
    if (!res.ok) {
      throw new Error('Failed to delete client');
    }
    setClients(prev => prev.filter(c => c.id !== clientId));
  };

  // Alert management
  const addAlert = async (alertData: Omit<Alert, 'id' | 'createdAt'>) => {
    const res = await apiFetch(getApiUrl('/api/alerts'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(alertData) });
    if (res.ok) {
      const saved = await res.json();
      setAlerts(prev => [...prev, mapAlertFromApi(saved)]);
    }
  };

  const markAlertAsRead = async (alertId: string) => {
    const res = await apiFetch(getApiUrl(`/api/alerts/${alertId}/read`), { method: 'PATCH', credentials: 'include' });
    if (res.ok) {
      const saved = await res.json();
      setAlerts(prev => prev.map(a => a.id === alertId ? mapAlertFromApi(saved) : a));
    }
  };

  const deleteAlert = async (alertId: string) => {
    const res = await apiFetch(getApiUrl(`/api/alerts/${alertId}`), { method: 'DELETE', credentials: 'include' });
    if (res.ok) setAlerts(prev => prev.filter(a => a.id !== alertId));
  };


  // Legal research
  const searchLegalSections = (query: string): LegalSection[] => {
    if (!query) return legalSections;

    const lowerQuery = query.toLowerCase();
    return legalSections.filter(section =>
      section.sectionNumber.toLowerCase().includes(lowerQuery) ||
      section.title.toLowerCase().includes(lowerQuery) ||
      section.description.toLowerCase().includes(lowerQuery) ||
      section.actName.toLowerCase().includes(lowerQuery) ||
      section.keywords.some(keyword => keyword.toLowerCase().includes(lowerQuery))
    );
  };

  // Time tracking
  const addTimeEntry = async (entry: Omit<TimeEntry, 'id'>) => {
    const res = await apiFetch(getApiUrl('/api/time-entries'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(entry) });
    if (res.ok) {
      const saved = await res.json();
      setTimeEntries(prev => [...prev, mapTimeEntryFromApi(saved)]);
    }
  };

  // Hearing management functions
  const checkHearingConflict = async (
    startAt: Date,
    endAt: Date,
    timezone: string,
    resourceScope: any = {},
    excludeHearingId?: string
  ) => {
    const res = await apiFetch(getApiUrl('/api/hearings/check-conflict'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        timezone,
        resourceScope,
        excludeHearingId
      })
    });

    if (!res.ok) {
      throw new Error('Failed to check conflicts');
    }

    return await res.json();
  };

  const addHearing = async (
    hearing: Omit<Hearing, 'id' | 'createdAt' | 'updatedAt'>,
    override: boolean = false,
    overrideReason?: string
  ) => {
    const payload = {
      ...hearing,
      override,
      overrideReason
    };

    const res = await apiFetch(getApiUrl('/api/hearings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Failed to create hearing' }));
      // If it's a conflict error (409), throw with conflict details
      if (res.status === 409) {
        const error: any = new Error(errorData.message || 'Hearing conflicts with existing schedules');
        error.conflicts = errorData.conflicts;
        error.status = 409;
        throw error;
      }
      throw new Error(errorData.error || 'Failed to create hearing');
    }

    const saved = await res.json();
    const mappedHearing = mapHearingFromApi(saved);
    setHearings(prev => [...prev, mappedHearing]);
    return saved;
  };

  const updateHearing = async (hearingId: string, updates: Partial<Hearing>) => {
    try {
      console.log('[LegalDataContext] updateHearing called with ID:', hearingId);
      console.log('[LegalDataContext] API URL:', getApiUrl(`/api/hearings/${hearingId}`));

      const res = await apiFetch(getApiUrl(`/api/hearings/${hearingId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update hearing' }));
        console.error('[LegalDataContext] Update failed:', errorData);
        throw new Error(errorData.error || 'Failed to update hearing');
      }

      const saved = await res.json();
      const mappedHearing = mapHearingFromApi(saved);

      // Update hearing in state
      setHearings(prev => {
        const hearingIndex = prev.findIndex(h => {
          const idMatch = h.id === hearingId ||
            h.id === hearingId.toString() ||
            h.id === saved._id ||
            h.id === saved.id;
          const caseIdMatch = h.caseId === saved.caseId || h.caseId === saved.caseId?.toString();
          return idMatch || (caseIdMatch && h.hearingDate === saved.hearingDate);
        });

        if (hearingIndex !== -1) {
          const updatedHearings = [...prev];
          updatedHearings[hearingIndex] = mappedHearing;
          return updatedHearings;
        } else {
          return [...prev, mappedHearing];
        }
      });

      return saved;
    } catch (error) {
      throw error;
    }
  };

  const deleteHearing = async (hearingId: string) => {
    const res = await apiFetch(getApiUrl(`/api/hearings/${hearingId}`), { method: 'DELETE', credentials: 'include' });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Failed to delete hearing' }));
      throw new Error(errorData.error || 'Failed to delete hearing');
    }
    setHearings(prev => prev.filter(h => h.id !== hearingId));
  };

  const getHearingsByCaseId = (caseId: string) => {
    return hearings.filter(h => {
      return h.caseId === caseId || h.caseId === caseId.toString();
    });
  };

  // Invoices
  const createInvoice = async (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload = mapInvoiceToApi(invoice);
    const res = await apiFetch(getApiUrl('/api/invoices'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
    if (res.ok) {
      const saved = await res.json();
      setInvoices(prev => [mapInvoiceFromApi(saved), ...prev]);
    }
  };

  const updateInvoice = async (invoiceId: string, updates: Partial<Invoice>) => {
    const res = await apiFetch(getApiUrl(`/api/invoices/${invoiceId}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(mapInvoicePartialToApi(updates)) });
    if (res.ok) {
      const saved = await res.json();
      setInvoices(prev => prev.map(i => i.id === invoiceId ? mapInvoiceFromApi(saved) : i));
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    const res = await apiFetch(getApiUrl(`/api/invoices/${invoiceId}`), { method: 'DELETE', credentials: 'include' });
    if (res.ok) setInvoices(prev => prev.filter(i => i.id !== invoiceId));
  };

  const sendInvoice = async (invoiceId: string, payload: { to?: string; subject?: string; message?: string }) => {
    const res = await apiFetch(getApiUrl(`/api/invoices/${invoiceId}/send`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('Failed to send invoice');
    const body = await res.json();
    return { previewUrl: body.previewUrl } as { previewUrl?: string };
  };

  // Refresh a single case from the API
  const refreshCase = async (caseId: string) => {
    try {
      console.log('[refreshCase] Fetching case:', caseId);
      const res = await apiFetch(getApiUrl(`/api/cases/${caseId}`), {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to refresh case');
      }

      const rawCase = await res.json();
      console.log('[refreshCase] Received case data:', rawCase);
      console.log('[refreshCase] Case nextHearing:', rawCase.nextHearing);

      const mappedCase = mapCaseFromApi(rawCase);
      console.log('[refreshCase] Mapped case nextHearing:', mappedCase.nextHearing);

      // Update the case in the global state
      setCases(prev => {
        const index = prev.findIndex(c => c.id === caseId);
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = mappedCase;
          console.log('[refreshCase] Updated case in state at index:', index);
          return updated;
        }
        console.log('[refreshCase] Case not found in state, ID:', caseId);
        return prev;
      });

      return mappedCase;
    } catch (error) {
      console.error('Error refreshing case:', error);
      throw error;
    }
  };

  const value: LegalDataContextType = {
    cases,
    addCase,
    updateCase,
    deleteCase,
    getCaseById,
    refreshCase,
    clients,
    addClient,
    updateClient,
    deleteClient,
    alerts,
    addAlert,
    markAlertAsRead,
    deleteAlert,
    legalSections,
    searchLegalSections,
    timeEntries,
    addTimeEntry,
    hearings,
    addHearing,
    updateHearing,
    deleteHearing,
    getHearingsByCaseId,
    checkHearingConflict,
    invoices,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    sendInvoice,
  };

  return (
    <LegalDataContext.Provider value={value}>
      {children}
    </LegalDataContext.Provider>
  );
};

// Helper to safely convert Firestore timestamps / mixed values to JS Date
function toSafeDate(value: any): Date | undefined {
  // Return undefined only for truly absent values
  if (value === null || value === undefined) return undefined;

  // Already a valid Date object
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  // Firestore Timestamp object with toDate() method
  if (typeof value.toDate === 'function') {
    try {
      const d = value.toDate();
      return Number.isNaN(d.getTime()) ? undefined : d;
    } catch (error) {
      console.error('[toSafeDate] Error calling toDate():', error);
      return undefined;
    }
  }

  // Firestore Timestamp-like plain object { seconds, nanoseconds } or {_seconds, _nanoseconds}
  if (typeof value === 'object' && (value.seconds !== undefined || value._seconds !== undefined)) {
    const seconds = value.seconds ?? value._seconds;
    if (typeof seconds === 'number') {
      const millis = seconds * 1000;
      const d = new Date(millis);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }
  }

  // ISO string or number - try to parse
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  } catch (error) {
    console.error('[toSafeDate] Error parsing date:', error, 'value:', value);
    return undefined;
  }
}

// Mappers
function mapCaseFromApi(raw: any): Case {
  return {
    id: raw._id || raw.id,
    caseNumber: raw.caseNumber,
    clientName: raw.clientName,
    opposingParty: raw.opposingParty,
    courtName: raw.courtName,
    judgeName: raw.judgeName,
    hearingDate: (toSafeDate(raw.hearingDate) || undefined) as any,
    hearingTime: raw.hearingTime,
    status: raw.status,
    priority: raw.priority,
    caseType: raw.caseType,
    description: raw.description,
    nextHearing: toSafeDate(raw.nextHearing) as any,
    documents: raw.documents || [],
    notes: raw.notes || '',
    alerts: [],
    createdAt: toSafeDate(raw.createdAt) || new Date(),
    updatedAt: toSafeDate(raw.updatedAt) || new Date(),
    folderId: raw.folderId,
  } as Case;
}

function mapClientFromApi(raw: any): Client {
  return {
    id: raw._id || raw.id,
    name: raw.name,
    email: raw.email,
    phone: raw.phone,
    address: raw.address || '',
    panNumber: raw.panNumber,
    aadharNumber: raw.aadharNumber,
    cases: raw.cases || [],
    documents: raw.documents || [],
    notes: raw.notes || '',
    createdAt: toSafeDate(raw.createdAt) || new Date(),
    updatedAt: toSafeDate(raw.updatedAt) || new Date(),
  } as Client;
}

function mapAlertFromApi(raw: any): Alert {
  return {
    id: raw._id || raw.id,
    caseId: raw.caseId,
    type: raw.type,
    message: raw.message,
    alertTime: toSafeDate(raw.alertTime) || new Date(),
    isRead: !!raw.isRead,
    createdAt: toSafeDate(raw.createdAt) || new Date(),
  } as Alert;
}

function mapTimeEntryFromApi(raw: any): TimeEntry {
  return {
    id: raw._id || raw.id,
    caseId: raw.caseId,
    description: raw.description,
    duration: raw.duration,
    hourlyRate: raw.hourlyRate,
    date: toSafeDate(raw.date) || new Date(),
    billable: !!raw.billable,
  } as TimeEntry;
}

function mapHearingFromApi(raw: any): Hearing {
  return {
    id: raw._id || raw.id,
    caseId: raw.caseId,
    hearingDate: toSafeDate(raw.hearingDate) || new Date(),
    hearingTime: raw.hearingTime,
    courtName: raw.courtName,
    judgeName: raw.judgeName,
    hearingType: raw.hearingType,
    status: raw.status,
    purpose: raw.purpose,
    courtInstructions: raw.courtInstructions,
    documentsToBring: raw.documentsToBring || [],
    proceedings: raw.proceedings,
    nextHearingDate: raw.nextHearingDate ? new Date(raw.nextHearingDate) : undefined,
    nextHearingTime: raw.nextHearingTime,
    adjournmentReason: raw.adjournmentReason,
    attendance: {
      clientPresent: !!raw.attendance?.clientPresent,
      opposingPartyPresent: !!raw.attendance?.opposingPartyPresent,
      witnessesPresent: raw.attendance?.witnessesPresent || [],
    },
    orders: (raw.orders || []).map((order: any) => ({
      orderType: order.orderType,
      orderDetails: order.orderDetails,
      orderDate: order.orderDate ? new Date(order.orderDate) : new Date(),
    })),
    notes: raw.notes,
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
    // Preserve populated case data if available
    populatedCase: raw.caseId && typeof raw.caseId === 'object' ? raw.caseId : null,
  } as Hearing & { populatedCase?: any };
}

function mapInvoiceFromApi(raw: any): Invoice {
  return {
    id: raw._id || raw.id,
    clientId: raw.clientId,
    caseId: raw.caseId,
    invoiceNumber: raw.invoiceNumber,
    issueDate: toSafeDate(raw.issueDate) || new Date(),
    dueDate: toSafeDate(raw.dueDate) || new Date(),
    status: raw.status,
    currency: raw.currency || 'INR',
    items: (raw.items || []).map((i: any) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, amount: i.amount })),
    subtotal: raw.subtotal || 0,
    taxRate: raw.taxRate || 0,
    taxAmount: raw.taxAmount || 0,
    discountAmount: raw.discountAmount || 0,
    total: raw.total || 0,
    notes: raw.notes,
    terms: raw.terms,
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
  } as Invoice;
}

function mapInvoiceToApi(inv: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) {
  return {
    clientId: inv.clientId,
    caseId: inv.caseId,
    invoiceNumber: inv.invoiceNumber,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    status: inv.status,
    currency: inv.currency,
    items: inv.items,
    subtotal: inv.subtotal,
    taxRate: inv.taxRate,
    taxAmount: inv.taxAmount,
    discountAmount: inv.discountAmount,
    total: inv.total,
    notes: inv.notes,
    terms: inv.terms,
  };
}

function mapInvoicePartialToApi(updates: Partial<Invoice>) {
  const u: any = { ...updates };
  if ('id' in u) delete u.id;
  if (u.issueDate instanceof Date) u.issueDate = u.issueDate.toISOString();
  if (u.dueDate instanceof Date) u.dueDate = u.dueDate.toISOString();
  return u;
}