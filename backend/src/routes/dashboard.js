import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { 
  queryDocuments,
  getDocumentById,
  COLLECTIONS 
} from '../services/firestore.js';

const router = express.Router();
router.use(requireAuth);

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Get cases statistics
    const allCases = await queryDocuments(
      COLLECTIONS.CASES,
      [{ field: 'owner', operator: '==', value: userId }]
    );
    const totalCases = allCases.length;
    const activeCases = allCases.filter(c => c.status === 'active').length;
    const todaysCases = allCases.filter(c => {
      if (!c.hearingDate) return false;
      const hearingDate = c.hearingDate.toDate ? c.hearingDate.toDate() : new Date(c.hearingDate);
      return hearingDate >= today && hearingDate < tomorrow;
    }).length;
    const urgentCases = allCases.filter(c => c.priority === 'urgent').length;

    // Get clients count
    const allClients = await queryDocuments(
      COLLECTIONS.CLIENTS,
      [{ field: 'owner', operator: '==', value: userId }]
    );
    const totalClients = allClients.length;

    // Calculate revenue from ALL invoices this month (not just paid ones for better visibility)
    const allInvoices = await queryDocuments(
      COLLECTIONS.INVOICES,
      [{ field: 'owner', operator: '==', value: userId }]
    );
    
    const allInvoicesThisMonth = allInvoices.filter(inv => {
      if (!inv.createdAt) return false;
      const created = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      return created >= startOfMonth && created <= endOfMonth;
    });

    // Also get paid invoices specifically
    const paidInvoicesThisMonth = allInvoices.filter(inv => {
      if (inv.status !== 'paid') return false;
      if (!inv.paidAt) return false;
      const paid = inv.paidAt.toDate ? inv.paidAt.toDate() : new Date(inv.paidAt);
      return paid >= startOfMonth && paid <= endOfMonth;
    });

    const totalInvoiceRevenue = allInvoicesThisMonth.reduce((total, invoice) => total + (invoice.total || 0), 0);
    const paidInvoiceRevenue = paidInvoicesThisMonth.reduce((total, invoice) => total + (invoice.total || 0), 0);

    // Calculate previous month for comparison
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const allInvoicesPrevMonth = allInvoices.filter(inv => {
      if (!inv.createdAt) return false;
      const created = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      return created >= startOfPrevMonth && created <= endOfPrevMonth;
    });

    const prevMonthRevenue = allInvoicesPrevMonth.reduce((total, invoice) => total + (invoice.total || 0), 0);
    const revenueGrowth = prevMonthRevenue > 0 ? ((totalInvoiceRevenue - prevMonthRevenue) / prevMonthRevenue * 100).toFixed(1) : 0;

    // Get billable time entries for this month
    const allTimeEntries = await queryDocuments(
      COLLECTIONS.TIME_ENTRIES,
      [
        { field: 'owner', operator: '==', value: userId },
        { field: 'billable', operator: '==', value: true }
      ]
    );
    
    const billableTimeEntries = allTimeEntries.filter(entry => {
      if (!entry.date) return false;
      const entryDate = entry.date.toDate ? entry.date.toDate() : new Date(entry.date);
      return entryDate >= startOfMonth && entryDate <= endOfMonth;
    });

    const monthlyBillableMinutes = billableTimeEntries.reduce((total, entry) => total + (entry.duration || 0), 0);
    const monthlyBillableHours = monthlyBillableMinutes / 60;
    const monthlyBillableAmount = billableTimeEntries.reduce((total, entry) => total + ((entry.duration || 0) * (entry.hourlyRate || 0)), 0);

    res.json({
      totalCases,
      activeCases,
      todaysCases,
      urgentCases,
      totalClients,
      revenue: {
        currentMonth: totalInvoiceRevenue, // Show total invoice revenue for better visibility
        growth: revenueGrowth,
        invoiced: totalInvoiceRevenue,
        paid: paidInvoiceRevenue,
        billable: monthlyBillableAmount,
        billableHours: monthlyBillableHours
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get recent activity - with fallback to show existing data if no Activity records exist
router.get('/activity', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Try to get activities from Activity collection first
    const allActivities = await queryDocuments(
      COLLECTIONS.ACTIVITIES,
      [{ field: 'owner', operator: '==', value: userId }],
      { field: 'createdAt', direction: 'desc' }
    );

    if (allActivities.length > 0) {
      const activities = allActivities.slice(0, 10).map(activity => ({
        id: activity.id,
        type: activity.type,
        message: activity.message,
        timestamp: activity.createdAt?.toDate ? activity.createdAt.toDate() : new Date(activity.createdAt),
        metadata: activity.metadata
      }));
      
      return res.json(activities);
    }

    // Fallback: Generate activities from recent data if no Activity records exist
    const activities = [];

    // Get recent cases (last 7 days)
    const allCases = await queryDocuments(
      COLLECTIONS.CASES,
      [{ field: 'owner', operator: '==', value: userId }],
      { field: 'createdAt', direction: 'desc' }
    );
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCases = allCases.filter(c => {
      if (!c.createdAt) return false;
      const created = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      return created >= sevenDaysAgo;
    }).slice(0, 3);

    recentCases.forEach(case_ => {
      const createdAt = case_.createdAt?.toDate ? case_.createdAt.toDate() : new Date(case_.createdAt);
      activities.push({
        id: `case-${case_.id}`,
        type: 'case_created',
        message: `New case ${case_.caseNumber} created for ${case_.clientName}`,
        timestamp: createdAt,
        metadata: {
          caseNumber: case_.caseNumber,
          clientName: case_.clientName,
          priority: case_.priority
        }
      });
    });

    // Get recent clients (last 7 days)
    const allClients = await queryDocuments(
      COLLECTIONS.CLIENTS,
      [{ field: 'owner', operator: '==', value: userId }],
      { field: 'createdAt', direction: 'desc' }
    );
    
    const recentClients = allClients.filter(c => {
      if (!c.createdAt) return false;
      const created = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      return created >= sevenDaysAgo;
    }).slice(0, 2);

    recentClients.forEach(client => {
      const createdAt = client.createdAt?.toDate ? client.createdAt.toDate() : new Date(client.createdAt);
      activities.push({
        id: `client-${client.id}`,
        type: 'client_registered',
        message: `New client ${client.name} registered`,
        timestamp: createdAt,
        metadata: {
          clientName: client.name,
          email: client.email
        }
      });
    });

    // Get recent invoices (last 7 days)
    const allInvoices = await queryDocuments(
      COLLECTIONS.INVOICES,
      [{ field: 'owner', operator: '==', value: userId }],
      { field: 'createdAt', direction: 'desc' }
    );
    
    const recentInvoices = allInvoices.filter(inv => {
      if (!inv.createdAt) return false;
      const created = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      return created >= sevenDaysAgo;
    }).slice(0, 2);

    for (const invoice of recentInvoices) {
      const client = invoice.clientId ? await getDocumentById(COLLECTIONS.CLIENTS, invoice.clientId) : null;
      const createdAt = invoice.createdAt?.toDate ? invoice.createdAt.toDate() : new Date(invoice.createdAt);
      activities.push({
        id: `invoice-${invoice.id}`,
        type: 'invoice_created',
        message: `Invoice ${invoice.invoiceNumber} created for ${client?.name || 'client'}`,
        timestamp: createdAt,
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          clientName: client?.name,
          amount: invoice.total,
          currency: invoice.currency
        }
      });
    }

    // Get recent time entries (last 3 days)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const allTimeEntries = await queryDocuments(
      COLLECTIONS.TIME_ENTRIES,
      [{ field: 'owner', operator: '==', value: userId }],
      { field: 'createdAt', direction: 'desc' }
    );
    
    const recentTimeEntries = allTimeEntries.filter(te => {
      if (!te.createdAt) return false;
      const created = te.createdAt.toDate ? te.createdAt.toDate() : new Date(te.createdAt);
      return created >= threeDaysAgo;
    }).slice(0, 2);

    for (const timeEntry of recentTimeEntries) {
      const case_ = timeEntry.caseId ? await getDocumentById(COLLECTIONS.CASES, timeEntry.caseId) : null;
      const durationText = timeEntry.duration >= 60 
        ? `${Math.floor(timeEntry.duration / 60)}h ${timeEntry.duration % 60}m` 
        : `${timeEntry.duration}m`;
      const createdAt = timeEntry.createdAt?.toDate ? timeEntry.createdAt.toDate() : new Date(timeEntry.createdAt);
      
      activities.push({
        id: `time-${timeEntry.id}`,
        type: 'time_logged',
        message: `${durationText} logged for ${case_?.caseNumber || 'case'}`,
        timestamp: createdAt,
        metadata: {
          duration: timeEntry.duration,
          durationText: durationText,
          description: timeEntry.description,
          caseNumber: case_?.caseNumber,
          billable: timeEntry.billable
        }
      });
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(activities.slice(0, 10));
  } catch (error) {
    console.error('Dashboard activity error:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// Get important notifications (today, tomorrow, urgent) - no duplicates, no fake data
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const dayAfterTomorrow = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);

    // Get alerts for today and tomorrow
    const allAlerts = await queryDocuments(
      COLLECTIONS.ALERTS,
      [{ field: 'owner', operator: '==', value: userId }]
    );
    
    const upcomingAlerts = allAlerts.filter(alert => {
      if (!alert.alertTime) return false;
      const alertTime = alert.alertTime.toDate ? alert.alertTime.toDate() : new Date(alert.alertTime);
      return alertTime >= today && alertTime < dayAfterTomorrow;
    }).sort((a, b) => {
      const aTime = a.alertTime.toDate ? a.alertTime.toDate() : new Date(a.alertTime);
      const bTime = b.alertTime.toDate ? b.alertTime.toDate() : new Date(b.alertTime);
      return aTime - bTime;
    });

    // Get cases with hearings today
    const allCases = await queryDocuments(
      COLLECTIONS.CASES,
      [{ field: 'owner', operator: '==', value: userId }]
    );
    
    const todaysHearings = allCases.filter(c => {
      if (!c.hearingDate) return false;
      const hearingDate = c.hearingDate.toDate ? c.hearingDate.toDate() : new Date(c.hearingDate);
      return hearingDate >= today && hearingDate < tomorrow;
    }).sort((a, b) => {
      const aTime = a.hearingTime || '';
      const bTime = b.hearingTime || '';
      return aTime.localeCompare(bTime);
    });

    // Get cases with hearings tomorrow
    const tomorrowsHearings = allCases.filter(c => {
      if (!c.hearingDate) return false;
      const hearingDate = c.hearingDate.toDate ? c.hearingDate.toDate() : new Date(c.hearingDate);
      return hearingDate >= tomorrow && hearingDate < dayAfterTomorrow;
    }).sort((a, b) => {
      const aTime = a.hearingTime || '';
      const bTime = b.hearingTime || '';
      return aTime.localeCompare(bTime);
    });

    // Get urgent cases with hearings in next 7 days (exclude today and tomorrow to avoid duplicates)
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const urgentCases = allCases.filter(c => {
      if (c.priority !== 'urgent') return false;
      if (!c.hearingDate) return false;
      const hearingDate = c.hearingDate.toDate ? c.hearingDate.toDate() : new Date(c.hearingDate);
      return hearingDate >= dayAfterTomorrow && hearingDate <= sevenDaysLater;
    }).sort((a, b) => {
      const aDate = a.hearingDate.toDate ? a.hearingDate.toDate() : new Date(a.hearingDate);
      const bDate = b.hearingDate.toDate ? b.hearingDate.toDate() : new Date(b.hearingDate);
      return aDate - bDate;
    });

    // Get overdue invoices
    const allInvoices = await queryDocuments(
      COLLECTIONS.INVOICES,
      [{ field: 'owner', operator: '==', value: userId }]
    );
    
    const overdueInvoices = allInvoices.filter(inv => {
      if (!['sent', 'overdue'].includes(inv.status)) return false;
      if (!inv.dueDate) return false;
      const dueDate = inv.dueDate.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate);
      return dueDate < today;
    }).sort((a, b) => {
      const aDate = a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
      const bDate = b.dueDate.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
      return aDate - bDate;
    }).slice(0, 5);

    const notifications = {
      alerts: upcomingAlerts,
      urgentCases,
      overdueInvoices,
      todaysHearings,
      tomorrowsHearings,
      summary: {
        totalUnread: upcomingAlerts.filter(a => !a.isRead).length,
        urgentCount: urgentCases.length,
        overdueCount: overdueInvoices.length,
        todayHearings: todaysHearings.length,
        tomorrowHearings: tomorrowsHearings.length
      }
    };

    res.json(notifications);
  } catch (error) {
    console.error('Dashboard notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

export default router;