/**
 * Role-Based Access Control (RBAC) middleware
 * Usage: router.get('/admin-only', requireAuth, requireRole('admin'), handler)
 */

/**
 * Factory that returns an Express middleware allowing only users with specified roles.
 * @param {...string} roles - Allowed roles e.g. 'admin', 'lawyer', 'assistant'
 */
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `This action requires one of the following roles: ${roles.join(', ')}`,
            });
        }
        next();
    };
}
