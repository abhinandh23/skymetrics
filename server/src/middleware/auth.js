import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import { forbidden, unauthorized } from '../utils/httpError.js';

/** Require a valid `Authorization: Bearer <jwt>` header; sets `req.user`. */
export function authenticate(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, getEnv().JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    return next();
  } catch {
    return next(unauthorized('Invalid or expired token'));
  }
}

/** @param {...('analyst' | 'viewer')} roles */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden(`This action requires one of the roles: ${roles.join(', ')}`));
    }
    return next();
  };
}
