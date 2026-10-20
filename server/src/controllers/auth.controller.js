import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { notFound } from '../utils/httpError.js';

export const registerSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().trim().min(1).max(80),
});

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

export async function register(req, res) {
  res.status(201).json(await authService.register(req.valid.body));
}

export async function login(req, res) {
  res.json(await authService.login(req.valid.body));
}

export async function me(req, res) {
  const user = await authService.getUserById(req.user.id);
  if (!user) throw notFound('User not found');
  res.json({ user });
}
