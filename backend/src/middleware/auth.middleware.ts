import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: Role;
    companyId?: string | null;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: Role; companyId?: string };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireRole = (roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      console.log('requireRole failed: No user info');
      res.status(401).json({ error: 'Unauthorized: No user info' });
      return;
    }

    console.log(`requireRole check. User role: ${req.user.role}, Allowed: ${roles}`);

    if (!roles.includes(req.user.role) && req.user.role !== 'SUPER_ADMIN') {
      console.log('requireRole failed: Insufficient role');
      res.status(403).json({ error: 'Forbidden: Insufficient role' });
      return;
    }

    next();
  };
};
