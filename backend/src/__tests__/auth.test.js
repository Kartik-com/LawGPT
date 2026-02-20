import { jest, describe, test, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';

/**
 * Auth route smoke tests
 * Tests critical security and validation behaviors without a real DB connection.
 * Full integration tests with DB would require MONGODB_URI in the test environment.
 */

// Minimal express app for unit-level route tests
let app;
let router;

beforeAll(async () => {
    // Minimal env setup
    process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-chars-for-test';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-chars-for-test';
    process.env.NODE_ENV = 'test';
});

describe('Auth Input Validation', () => {
    describe('POST /register', () => {
        test('should reject missing email', async () => {
            // We test the Zod schema directly without spinning up the full app
            const { registerSchema } = await import('../../src/schemas/authSchemas.js');

            const result = registerSchema.safeParse({ password: 'password123', name: 'Test User' });
            expect(result.success).toBe(false);
            const issues = result.error?.issues ?? [];
            expect(issues[0]?.path ?? []).toContain('email');
        });

        test('should reject invalid email format', async () => {
            const { registerSchema } = await import('../../src/schemas/authSchemas.js');

            const result = registerSchema.safeParse({
                email: 'not-an-email',
                password: 'password123',
                name: 'Test User'
            });
            expect(result.success).toBe(false);
        });

        test('should reject passwords shorter than 8 characters', async () => {
            const { registerSchema } = await import('../../src/schemas/authSchemas.js');

            const result = registerSchema.safeParse({
                email: 'user@example.com',
                password: 'short',
                name: 'Test User'
            });
            expect(result.success).toBe(false);
            const issues = result.error?.issues ?? [];
            expect(issues.some(e => (e.path ?? []).includes('password'))).toBe(true);
        });

        test('should accept valid registration data', async () => {
            const { registerSchema } = await import('../../src/schemas/authSchemas.js');

            const result = registerSchema.safeParse({
                email: 'user@example.com',
                password: 'secureP@ss123',
                name: 'Test User',
                role: 'lawyer'
            });
            expect(result.success).toBe(true);
        });

        test('should normalise email to lowercase', async () => {
            const { registerSchema } = await import('../../src/schemas/authSchemas.js');

            const result = registerSchema.safeParse({
                email: 'User@Example.COM',
                password: 'secureP@ss123',
                name: 'Test User'
            });
            expect(result.success).toBe(true);
            expect(result.data.email).toBe('user@example.com');
        });
    });

    describe('POST /login', () => {
        test('should reject empty credentials', async () => {
            const { loginSchema } = await import('../../src/schemas/authSchemas.js');

            const result = loginSchema.safeParse({});
            expect(result.success).toBe(false);
        });

        test('should accept valid login data', async () => {
            const { loginSchema } = await import('../../src/schemas/authSchemas.js');

            const result = loginSchema.safeParse({
                email: 'user@example.com',
                password: 'mypassword'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('POST /forgot-password', () => {
        test('should reject invalid email', async () => {
            const { forgotPasswordSchema } = await import('../../src/schemas/authSchemas.js');

            const result = forgotPasswordSchema.safeParse({ email: 'not-valid' });
            expect(result.success).toBe(false);
        });
    });

    describe('POST /reset-password', () => {
        test('should reject weak new password', async () => {
            const { resetPasswordSchema } = await import('../../src/schemas/authSchemas.js');

            const result = resetPasswordSchema.safeParse({
                token: 'abc123token',
                newPassword: 'weak'
            });
            expect(result.success).toBe(false);
        });
    });
});

describe('RBAC Middleware', () => {
    test('requireRole returns 401 with no user on req', async () => {
        const { requireRole } = await import('../../src/middleware/rbac.js');
        const middlware = requireRole('admin');

        const req = { user: null };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        middlware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('requireRole returns 403 for wrong role', async () => {
        const { requireRole } = await import('../../src/middleware/rbac.js');
        const middleware = requireRole('admin');

        const req = { user: { role: 'lawyer' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('requireRole calls next() for allowed role', async () => {
        const { requireRole } = await import('../../src/middleware/rbac.js');
        const middleware = requireRole('lawyer', 'admin');

        const req = { user: { role: 'lawyer' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe('Validate Middleware', () => {
    test('returns 400 for invalid body', async () => {
        const { validate } = await import('../../src/middleware/validate.js');
        const { loginSchema } = await import('../../src/schemas/authSchemas.js');

        const middleware = validate({ body: loginSchema });
        const req = { body: { email: 'bad-email', password: '' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    test('calls next() for valid body', async () => {
        const { validate } = await import('../../src/middleware/validate.js');
        const { loginSchema } = await import('../../src/schemas/authSchemas.js');

        const middleware = validate({ body: loginSchema });
        const req = { body: { email: 'user@example.com', password: 'mypassword' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
