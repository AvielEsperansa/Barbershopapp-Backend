import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccess, AccessTokenPayload } from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
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
        // בדיקה אם זה טוקן Cron
        const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        if (decoded.type === 'cron-service' && decoded.role === 'admin') {
            // טוקן Cron - מאפשר גישה מלאה
            req.user = {
                id: decoded.id,
                email: 'cron-service@barbershop.com',
                role: 'admin'
            };
            next();
            return;
        }

        // טוקן רגיל
        const payload = verifyAccess(token);
        req.user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role
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
