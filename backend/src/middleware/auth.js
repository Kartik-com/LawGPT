import { verifyFirebaseToken } from '../config/firebase.js';
import { getDocumentById, COLLECTIONS } from '../services/firestore.js';

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
    
    // Try to decode as base64 session token first (for email/password login)
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
      if (decoded.uid && decoded.email) {
        decodedToken = decoded;
        if (process.env.NODE_ENV === 'development') {
          console.log('Decoded base64 session token for user:', decoded.email);
        }
      } else {
        throw new Error('Invalid session token format');
      }
    } catch (e) {
      // If not base64, try as Firebase ID token
      try {
        decodedToken = await verifyFirebaseToken(token);
        if (process.env.NODE_ENV === 'development') {
          console.log('Verified Firebase token for user:', decodedToken.email);
        }
      } catch (firebaseError) {
        console.error('Token verification failed:', firebaseError.message);
        if (process.env.NODE_ENV === 'development') {
          console.error('Token verification error details:', {
            code: firebaseError.code,
            message: firebaseError.message,
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
            details: firebaseError.message,
            code: firebaseError.code
          })
        });
      }
    }
    
    // Get user profile from Firestore
    const userProfile = await getDocumentById(COLLECTIONS.USERS, decodedToken.uid);
    
    if (!userProfile) {
      console.error('User profile not found for UID:', decodedToken.uid);
      res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
      return res.status(401).json({ 
        error: 'User profile not found',
        ...(process.env.NODE_ENV === 'development' && { uid: decodedToken.uid })
      });
    }
    
    // Attach user info to request
    req.user = {
      userId: decodedToken.uid, // Firebase UID
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



