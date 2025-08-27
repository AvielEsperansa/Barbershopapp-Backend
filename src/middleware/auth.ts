import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccess, AccessTokenPayload } from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        email: string;
        role: string;
    };
}
export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Missing access token' });

    try {
        const payload = verifyAccess(token);
        (req as any).user = { id: payload.sub, email: payload.email, role: payload.role };
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid/expired access token' });
    }
}
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = verifyAccess(token);
        req.user = {
            userId: decoded.sub,
            email: decoded.email,
            role: decoded.role
        };
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

// Middleware to check if user has specific role
export function requireRole(roles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
}

// Middleware to check if user is admin
export const requireAdmin = requireRole(['admin']);

// Middleware to check if user is barber
export const requireBarber = requireRole(['barber', 'admin']);

// Middleware to check if user is customer
export const requireCustomer = requireRole(['customer', 'barber', 'admin']);
