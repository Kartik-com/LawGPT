import express from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth-jwt.js';
import {
    getDocumentById,
    updateDocument,
    MODELS,
    COLLECTIONS
} from '../services/mongodb.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/2fa/enable
 * Generate TOTP secret and QR code for 2FA setup
 */
router.post('/enable', async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get user profile
        const userProfile = await getDocumentById(COLLECTIONS.USERS, userId);
        if (!userProfile) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if 2FA is already enabled
        if (userProfile.security?.twoFactorEnabled) {
            return res.status(400).json({ error: '2FA is already enabled' });
        }

        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `LawGPT (${userProfile.email})`,
            issuer: 'LawGPT',
            length: 32
        });

        // Generate QR code
        const qrCodeDataURL = await QRCode.toDataURL(secret.otpauth_url);

        // Store secret temporarily (not enabled yet)
        await updateDocument(COLLECTIONS.USERS, userId, {
            'security.twoFactorSecret': secret.base32,
            'security.twoFactorEnabled': false,
            'security.twoFactorTempSecret': secret.base32 // Temp until verified
        });

        res.json({
            secret: secret.base32,
            qrCode: qrCodeDataURL,
            manualEntryKey: secret.base32
        });
    } catch (error) {
        console.error('Enable 2FA error:', error);
        res.status(500).json({ error: 'Failed to enable 2FA' });
    }
});

/**
 * POST /api/2fa/verify
 * Verify OTP and enable 2FA
 */
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.userId;

        if (!token) {
            return res.status(400).json({ error: 'OTP token is required' });
        }

        // Get user profile
        const userProfile = await getDocumentById(COLLECTIONS.USERS, userId);
        if (!userProfile) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get temp secret
        const secret = userProfile.security?.twoFactorTempSecret || userProfile.security?.twoFactorSecret;
        if (!secret) {
            return res.status(400).json({ error: 'No 2FA setup found. Please enable 2FA first.' });
        }

        // Verify token
        const verified = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token,
            window: 2 // Allow 2 time steps before/after for clock skew
        });

        if (!verified) {
            return res.status(400).json({ error: 'Invalid OTP token' });
        }

        // Generate backup codes
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
        }

        // Hash backup codes for storage
        const hashedBackupCodes = backupCodes.map(code =>
            crypto.createHash('sha256').update(code).digest('hex')
        );

        // Enable 2FA
        await updateDocument(COLLECTIONS.USERS, userId, {
            'security.twoFactorEnabled': true,
            'security.twoFactorSecret': secret,
            'security.twoFactorTempSecret': null,
            'security.backupCodes': hashedBackupCodes,
            'security.twoFactorEnabledAt': new Date().toISOString()
        });

        res.json({
            success: true,
            message: '2FA enabled successfully',
            backupCodes // Return unhashed codes to user (only time they'll see them)
        });
    } catch (error) {
        console.error('Verify 2FA error:', error);
        res.status(500).json({ error: 'Failed to verify 2FA' });
    }
});

/**
 * POST /api/2fa/validate
 * Validate OTP token (used during login)
 */
router.post('/validate', async (req, res) => {
    try {
        const { token, userId } = req.body;

        if (!token || !userId) {
            return res.status(400).json({ error: 'Token and userId are required' });
        }

        // Get user profile
        const userProfile = await getDocumentById(COLLECTIONS.USERS, userId);
        if (!userProfile) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!userProfile.security?.twoFactorEnabled) {
            return res.status(400).json({ error: '2FA is not enabled for this user' });
        }

        const secret = userProfile.security.twoFactorSecret;

        // Try TOTP first
        const verified = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token,
            window: 2
        });

        if (verified) {
            return res.json({ valid: true, method: 'totp' });
        }

        // Try backup codes
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const backupCodes = userProfile.security.backupCodes || [];
        const backupCodeIndex = backupCodes.indexOf(hashedToken);

        if (backupCodeIndex !== -1) {
            // Remove used backup code
            const updatedBackupCodes = backupCodes.filter((_, index) => index !== backupCodeIndex);
            await updateDocument(COLLECTIONS.USERS, userId, {
                'security.backupCodes': updatedBackupCodes
            });

            return res.json({
                valid: true,
                method: 'backup',
                remainingBackupCodes: updatedBackupCodes.length
            });
        }

        return res.status(400).json({ error: 'Invalid OTP or backup code' });
    } catch (error) {
        console.error('Validate 2FA error:', error);
        res.status(500).json({ error: 'Failed to validate 2FA' });
    }
});

/**
 * POST /api/2fa/disable
 * Disable 2FA (requires password confirmation)
 */
router.post('/disable', async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.user.userId;

        if (!password) {
            return res.status(400).json({ error: 'Password is required to disable 2FA' });
        }

        // Get user profile
        const userProfile = await getDocumentById(COLLECTIONS.USERS, userId);
        if (!userProfile) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify password (you'll need to implement password verification)
        // For now, we'll just disable it
        // TODO: Add password verification

        // Disable 2FA
        await updateDocument(COLLECTIONS.USERS, userId, {
            'security.twoFactorEnabled': false,
            'security.twoFactorSecret': null,
            'security.twoFactorTempSecret': null,
            'security.backupCodes': [],
            'security.twoFactorDisabledAt': new Date().toISOString()
        });

        res.json({
            success: true,
            message: '2FA disabled successfully'
        });
    } catch (error) {
        console.error('Disable 2FA error:', error);
        res.status(500).json({ error: 'Failed to disable 2FA' });
    }
});

/**
 * POST /api/2fa/backup-codes
 * Regenerate backup codes
 */
router.post('/backup-codes', async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.userId;

        if (!token) {
            return res.status(400).json({ error: 'OTP token is required to regenerate backup codes' });
        }

        // Get user profile
        const userProfile = await getDocumentById(COLLECTIONS.USERS, userId);
        if (!userProfile) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!userProfile.security?.twoFactorEnabled) {
            return res.status(400).json({ error: '2FA is not enabled' });
        }

        // Verify token
        const verified = speakeasy.totp.verify({
            secret: userProfile.security.twoFactorSecret,
            encoding: 'base32',
            token,
            window: 2
        });

        if (!verified) {
            return res.status(400).json({ error: 'Invalid OTP token' });
        }

        // Generate new backup codes
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
        }

        // Hash backup codes for storage
        const hashedBackupCodes = backupCodes.map(code =>
            crypto.createHash('sha256').update(code).digest('hex')
        );

        // Update backup codes
        await updateDocument(COLLECTIONS.USERS, userId, {
            'security.backupCodes': hashedBackupCodes,
            'security.backupCodesRegeneratedAt': new Date().toISOString()
        });

        res.json({
            success: true,
            backupCodes
        });
    } catch (error) {
        console.error('Regenerate backup codes error:', error);
        res.status(500).json({ error: 'Failed to regenerate backup codes' });
    }
});

/**
 * GET /api/2fa/status
 * Get 2FA status for current user
 */
router.get('/status', async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get user profile
        const userProfile = await getDocumentById(COLLECTIONS.USERS, userId);
        if (!userProfile) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            enabled: userProfile.security?.twoFactorEnabled || false,
            enabledAt: userProfile.security?.twoFactorEnabledAt || null,
            backupCodesCount: userProfile.security?.backupCodes?.length || 0
        });
    } catch (error) {
        console.error('Get 2FA status error:', error);
        res.status(500).json({ error: 'Failed to get 2FA status' });
    }
});

export default router;
