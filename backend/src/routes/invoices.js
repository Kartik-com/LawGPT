import express from 'express';
import { requireAuth } from '../middleware/auth-jwt.js';
import { sendInvoiceEmail } from '../utils/mailer.js';
import { logActivity } from '../middleware/activityLogger.js';
import {
  createDocument,
  getDocumentById,
  updateDocument,
  deleteDocument,
  queryDocuments,
  MODELS,
  COLLECTIONS
} from '../services/mongodb.js';

// Helper function to generate email content
function generateInvoiceEmailContent(invoice, client) {
  const daysUntilDue = Math.ceil((new Date(invoice.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
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

  return `We hope this email finds you well. ${urgencyText}Please find attached your invoice ${invoice.invoiceNumber} for legal services provided. The total amount due is ${totalAmount} and payment is due by ${dueDate}. We have provided detailed breakdown of all services rendered below for your review and records.`;
}

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const items = await queryDocuments(
      MODELS.INVOICES,
      [{ field: 'owner', operator: '==', value: req.user.userId }],
      { field: 'createdAt', direction: 'desc' }
    );
    res.json(items);
  } catch (error) {
    console.error('Get invoices error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message
    });
    res.status(500).json({
      error: 'Failed to fetch invoices',
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        code: error.code
      })
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await getDocumentById(COLLECTIONS.INVOICES, req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.owner?.toString() !== req.user.userId.toString()) return res.status(403).json({ error: 'Forbidden' });
    res.json(item);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = { ...req.body, owner: req.user.userId };
    const created = await createDocument(COLLECTIONS.INVOICES, data);

    // Get client info for activity log
    const client = created.clientId ? await getDocumentById(COLLECTIONS.CLIENTS, created.clientId) : null;

    // Log activity
    await logActivity(
      req.user.userId,
      'invoice_created',
      `Invoice ${created.invoiceNumber} created for ${client?.name || 'client'}`,
      'invoice',
      created.id,
      {
        invoiceNumber: created.invoiceNumber,
        clientName: client?.name,
        amount: created.total,
        currency: created.currency,
        status: created.status
      }
    );

    res.status(201).json(created);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const original = await getDocumentById(COLLECTIONS.INVOICES, req.params.id);
    if (!original) return res.status(404).json({ error: 'Not found' });
    if (original.owner?.toString() !== req.user.userId.toString()) return res.status(403).json({ error: 'Forbidden' });

    const updated = await updateDocument(COLLECTIONS.INVOICES, req.params.id, req.body);

    // Get client info for activity log
    const client = updated.clientId ? await getDocumentById(COLLECTIONS.CLIENTS, updated.clientId) : null;

    // Check if payment status changed
    if (original.status !== 'paid' && updated.status === 'paid') {
      await logActivity(
        req.user.userId,
        'payment_received',
        `Payment received for invoice ${updated.invoiceNumber}`,
        'invoice',
        updated.id,
        {
          invoiceNumber: updated.invoiceNumber,
          clientName: client?.name,
          amount: updated.total,
          currency: updated.currency
        }
      );
    } else {
      await logActivity(
        req.user.userId,
        'invoice_updated',
        `Invoice ${updated.invoiceNumber} updated`,
        'invoice',
        updated.id,
        {
          invoiceNumber: updated.invoiceNumber,
          clientName: client?.name,
          amount: updated.total,
          currency: updated.currency,
          status: updated.status
        }
      );
    }

    res.json(updated);
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await getDocumentById(COLLECTIONS.INVOICES, req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.owner?.toString() !== req.user.userId.toString()) return res.status(403).json({ error: 'Forbidden' });

    await deleteDocument(COLLECTIONS.INVOICES, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

router.post('/:id/send', async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    const invoice = await getDocumentById(COLLECTIONS.INVOICES, req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    if (invoice.owner?.toString() !== req.user.userId.toString()) return res.status(403).json({ error: 'Forbidden' });

    // Get client information for personalized email
    const client = invoice.clientId ? await getDocumentById(COLLECTIONS.CLIENTS, invoice.clientId) : null;
    if (!client) return res.status(400).json({ error: 'Client not found for invoice' });
    if (client.owner?.toString() !== req.user.userId.toString()) return res.status(403).json({ error: 'Forbidden' });

    let recipient = to;
    if (!recipient) {
      recipient = client.email;
    }

    const result = await sendInvoiceEmail({
      to: recipient,
      subject: subject || `Invoice ${invoice.invoiceNumber} - Legal Services - Due ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}`,
      message: message || generateInvoiceEmailContent(invoice, client),
      invoice,
      client,
    });

    // Log activity
    await logActivity(
      req.user.userId,
      'invoice_sent',
      `Invoice ${invoice.invoiceNumber} sent to ${client.name}`,
      'invoice',
      invoice.id,
      {
        invoiceNumber: invoice.invoiceNumber,
        clientName: client.name,
        clientEmail: recipient,
        amount: invoice.total,
        currency: invoice.currency
      }
    );

    res.json(result);
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ error: error.message || 'Failed to send invoice' });
  }
});

export default router;


