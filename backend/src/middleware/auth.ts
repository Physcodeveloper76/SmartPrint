import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, mockProfiles } from '../config/supabase';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ message: 'Invalid or expired session token.' });
    }

    const profile = mockProfiles.find(p => p.id === data.user.id);
    const role = profile?.role || data.user.role || 'user';

    req.user = {
      id: data.user.id,
      email: data.user.email,
      role: role
    };

    next();
  } catch (err: any) {
    console.error('[Auth Middleware] Verification error:', err);
    return res.status(500).json({ message: 'Authentication verification failed' });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}
