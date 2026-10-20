import { z } from 'zod';
import { askQuestion } from '../ask/ask.service.js';
import { getEnv } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export const askSchema = z.object({
  question: z.string().trim().min(5, 'Question is too short').max(500, 'Question is too long'),
});

export async function ask(req, res) {
  const llm = req.app.locals.llm;
  if (!llm) throw new HttpError(503, 'Ask your data is not configured (missing GEMINI_API_KEY).');
  const result = await askQuestion({
    question: req.valid.body.question,
    user: req.user,
    llm,
    maxTimeMS: getEnv().ASK_MAX_TIME_MS,
  });
  res.json(result);
}
