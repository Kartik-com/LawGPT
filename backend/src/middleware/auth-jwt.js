import jwt from 'jsonwebtoken';
import { getDocumentById, MODELS } from '../services/mongodb.js';

/**
 * JWT-based authentication middleware
 * Replaces Firebase token verification
 */
export async function requireAuth(req, res, next) {
    try {
        // Get token from cookie or Authorization header
        const token = req.cookies?.token || (req.headers.authorization || '').replace('Bearer ', '');

        // Log for debugging in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Auth check:', {
                hasCookie: !!req.cookies?.token,
                hasAuthHeader: !!req.headers.authorization,
                path: req.path,
                method: req.method
            });
        }

        if (!token) {
            if (process.env.NODE_ENV === 'development') {
                console.log('No token found in request');
            }
            res.clearCookie('token', {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/'
            });
            return res.status(401).json({
                error: 'No authentication token provided',
                ...(process.env.NODE_ENV === 'development' && {
                    debug: 'No token in cookies or Authorization header',
                    cookies: Object.keys(req.cookies || {}),
                    hasAuthHeader: !!req.headers.authorization
                })
            });
        }

        let decodedToken;

        // Verify JWT token
        try {
            decodedToken = jwt.verify(token, process.env.JWT_SECRET);

            if (process.env.NODE_ENV === 'development') {
                console.log('Verified JWT token for user:', decodedToken.email);
            }
        } catch (jwtError) {
            console.error('JWT verification failed:', jwtError.message);

            if (process.env.NODE_ENV === 'development') {
                console.error('JWT verification error details:', {
                    name: jwtError.name,
                    message: jwtError.message,
                    tokenLength: token.length,
                    tokenPrefix: token.substring(0, 20)
                });
            }

            res.clearCookie('token', {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/'
            });

            return res.status(401).json({
                error: 'Invalid or expired token',
                ...(process.env.NODE_ENV === 'development' && {
                    details: jwtError.message,
                    name: jwtError.name
                })
            });
        }

        // Get user profile from MongoDB
        const userProfile = await getDocumentById(MODELS.USERS, decodedToken.userId);

        if (!userProfile) {
            console.error('User profile not found for userId:', decodedToken.userId);
            res.clearCookie('token', {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/'
            });
            return res.status(401).json({
                error: 'User profile not found',
                ...(process.env.NODE_ENV === 'development' && { userId: decodedToken.userId })
            });
        }

        // Attach user info to request
        req.user = {
            userId: decodedToken.userId,
            email: decodedToken.email,
            role: decodedToken.role || userProfile.role || 'lawyer',
            name: userProfile.name,
            barNumber: userProfile.barNumber,
            firm: userProfile.firm,
        };

        if (process.env.NODE_ENV === 'development') {
            console.log('Auth successful for user:', req.user.email);
        }

        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        console.error('Auth middleware stack:', error.stack);

        // Clear invalid cookies
        res.clearCookie('token', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/'
        });

        return res.status(401).json({
            error: 'Authentication failed',
            ...(process.env.NODE_ENV === 'development' && {
                details: error.message,
                stack: error.stack
            })
        });
    }
}
