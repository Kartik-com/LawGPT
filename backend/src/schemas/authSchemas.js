import { z } from 'zod';

// Reusable base schemas
const emailSchema = z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address')
    .max(255)
    .transform(v => v.toLowerCase().trim());

const passwordSchema = z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters');

// ── Auth Schemas ──────────────────────────────────────────────────────────────

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export const registerSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string({ required_error: 'Name is required' }).min(2, 'Name must be at least 2 characters').max(100).trim(),
    role: z.enum(['lawyer', 'assistant']).optional().default('lawyer'),
    barNumber: z.string().max(50).trim().optional(),
    firm: z.string().max(200).trim().optional(),
});

export const forgotPasswordSchema = z.object({
    email: emailSchema,
});

export const resetPasswordSchema = z.object({
    token: z.string({ required_error: 'Reset token is required' }).min(1),
    newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
    currentPassword: z.string({ required_error: 'Current password is required' }).min(1),
    newPassword: passwordSchema,
});

export const reactivateSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string().min(2).max(100).trim(),
});

// ── Cases Schemas ─────────────────────────────────────────────────────────────

export const caseCreateSchema = z.object({
    title: z.string().min(1, 'Case title is required').max(200).trim(),
    caseNumber: z.string().max(100).trim().optional(),
    clientId: z.string().optional(),
    status: z.enum(['active', 'pending', 'closed', 'archived']).optional().default('active'),
    description: z.string().max(5000).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
    court: z.string().max(200).optional(),
    nextHearingDate: z.string().datetime().optional().nullable(),
    tags: z.array(z.string().max(50)).max(20).optional(),
});

export const caseUpdateSchema = caseCreateSchema.partial();

// ── Client Schemas ────────────────────────────────────────────────────────────

export const clientCreateSchema = z.object({
    name: z.string().min(1, 'Client name is required').max(200).trim(),
    email: emailSchema.optional(),
    phone: z.string().max(20).optional(),
    address: z.string().max(500).optional(),
    type: z.enum(['individual', 'organization']).optional().default('individual'),
    notes: z.string().max(5000).optional(),
});

export const clientUpdateSchema = clientCreateSchema.partial();

// ── Pagination Query Schema (reusable) ────────────────────────────────────────

export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(200).optional(),
    sortBy: z.string().max(50).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ── Invoice Schemas ───────────────────────────────────────────────────────────

export const invoiceCreateSchema = z.object({
    clientId: z.string().optional(),
    caseId: z.string().optional(),
    amount: z.number().min(0).optional(),
    dueDate: z.string().datetime().optional().nullable(),
    description: z.string().max(2000).optional(),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional().default('draft'),
    items: z.array(z.object({
        description: z.string().max(500),
        quantity: z.number().min(0),
        rate: z.number().min(0),
        amount: z.number().min(0),
    })).optional(),
});

// ── Folder / Document Schemas ─────────────────────────────────────────────────

export const folderCreateSchema = z.object({
    name: z.string().min(1, 'Folder name is required').max(255).trim(),
    parentId: z.string().nullable().optional(),
    caseId: z.string().nullable().optional(),
});

export const folderUpdateSchema = folderCreateSchema.partial();
