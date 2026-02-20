/**
 * Security regression test suite — Elite V3, Phase 2.
 * Tests: CSRF protection, NoSQL injection sanitization, RBAC, JWT validation, file types.
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { csrfProtection, setCsrfToken } from '../middleware/csrf.js';
import { requireRole } from '../middleware/rbac.js';
import mongoSanitize from 'express-mongo-sanitize';

// ── Test app fixture ──────────────────────────────────────────────────────────

function buildTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());                    // Needed for req.cookies
    app.use(mongoSanitize({ replaceWith: '_' }));

    // CSRF token endpoint (sets cookie + returns it in body)
    app.get('/csrf-token', setCsrfToken);

    // Protected mutating route
    app.post('/protected', csrfProtection, (req, res) =>
        res.json({ ok: true, body: req.body })
    );

    // Admin-only route
    app.get('/admin',
        (req, _res, next) => {
            if (req.headers['x-mock-user']) {
                try { req.user = JSON.parse(req.headers['x-mock-user']); } catch { /* skip */ }
            }
            next();
        },
        requireRole('admin'),
        (_req, res) => res.json({ ok: true })
    );

    return app;
}

const app = buildTestApp();

// ── Helper ────────────────────────────────────────────────────────────────────

async function getCsrfPair() {
    const res = await request(app).get('/csrf-token');
    const token = res.body.csrfToken;
    const setCookieArr = [].concat(res.headers['set-cookie'] || []);
    const cookieLine = setCookieArr.find(c => c.startsWith('csrf-token='));
    const cookie = cookieLine ? cookieLine.split(';')[0] : `csrf-token=${token}`;
    return { token, cookie };
}

// ── CSRF Tests ────────────────────────────────────────────────────────────────

describe('Security — CSRF Protection', () => {
    it('POST without X-CSRF-Token header returns 403', async () => {
        const { cookie } = await getCsrfPair();
        const res = await request(app)
            .post('/protected')
            .set('Cookie', cookie)
            .send({ x: 1 });
        expect(res.status).toBe(403);
    });

    it('POST with correct X-CSRF-Token returns 200', async () => {
        const { token, cookie } = await getCsrfPair();
        const res = await request(app)
            .post('/protected')
            .set('Cookie', cookie)
            .set('X-CSRF-Token', token)
            .send({ x: 1 });
        expect(res.status).toBe(200);
    });

    it('POST with wrong X-CSRF-Token returns 403', async () => {
        const { cookie } = await getCsrfPair();
        const res = await request(app)
            .post('/protected')
            .set('Cookie', cookie)
            .set('X-CSRF-Token', 'wrong-token-abc')
            .send({ x: 1 });
        expect(res.status).toBe(403);
    });
});

// ── NoSQL Injection Tests ─────────────────────────────────────────────────────

describe('Security — NoSQL Injection Prevention', () => {
    it('Sanitizes $where operator in request body', async () => {
        const { token, cookie } = await getCsrfPair();
        const res = await request(app)
            .post('/protected')
            .set('Cookie', cookie)
            .set('X-CSRF-Token', token)
            .send({ query: { $where: 'sleep(1000)' } });
        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body.body)).not.toContain('$where');
    });

    it('Sanitizes $gt in nested object', async () => {
        const { token, cookie } = await getCsrfPair();
        const res = await request(app)
            .post('/protected')
            .set('Cookie', cookie)
            .set('X-CSRF-Token', token)
            .send({ password: { $gt: '' } });
        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body.body)).not.toContain('$gt');
    });
});

// ── RBAC / Privilege Escalation Tests ────────────────────────────────────────

describe('Security — Privilege Escalation (RBAC)', () => {
    it('Non-admin user returns 403', async () => {
        const res = await request(app)
            .get('/admin')
            .set('x-mock-user', JSON.stringify({ userId: 'u1', role: 'user' }));
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Forbidden/i);
    });

    it('Unauthenticated request returns 401', async () => {
        const res = await request(app).get('/admin');
        expect(res.status).toBe(401);
    });

    it('Admin user returns 200', async () => {
        const res = await request(app)
            .get('/admin')
            .set('x-mock-user', JSON.stringify({ userId: 'u2', role: 'admin' }));
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});

// ── JWT Security Tests ────────────────────────────────────────────────────────

describe('Security — JWT Token Validation', () => {
    const secret = 'test-secret-minimum-32-chars-value-here';

    it('Expired JWT is rejected', () => {
        const token = jwt.sign({ userId: 'u1' }, secret, { expiresIn: '0ms' });
        expect(() => jwt.verify(token, secret)).toThrow(/jwt expired/i);
    });

    it('JWT with wrong secret is rejected', () => {
        const token = jwt.sign({ userId: 'u1' }, 'a-different-secret-entirely-bbb');
        expect(() => jwt.verify(token, secret)).toThrow(/invalid signature/i);
    });

    it('Tampered JWT payload is rejected', () => {
        const token = jwt.sign({ userId: 'u1', role: 'user' }, secret);
        const parts = token.split('.');
        const fake = Buffer.from(JSON.stringify({ userId: 'u1', role: 'admin' })).toString('base64url');
        expect(() => jwt.verify(`${parts[0]}.${fake}.${parts[2]}`, secret)).toThrow(/invalid signature/i);
    });
});

// ── File Upload Type Validation ───────────────────────────────────────────────

describe('Security — File Type Validation', () => {
    const allowedMimeTypes = [
        'application/pdf',
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
    ];

    it('Dangerous MIME types are not in allowed list', () => {
        const dangerous = [
            'application/x-executable',
            'application/x-msdownload',
            'text/javascript',
            'application/x-sh',
            'application/x-php',
        ];
        dangerous.forEach(mime => {
            expect(allowedMimeTypes.includes(mime)).toBe(false);
        });
    });
});
