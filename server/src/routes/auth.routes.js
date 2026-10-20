import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const authRouter = Router();

authRouter.post('/register', validate({ body: auth.registerSchema }), auth.register);
authRouter.post('/login', validate({ body: auth.loginSchema }), auth.login);
authRouter.get('/me', authenticate, auth.me);
