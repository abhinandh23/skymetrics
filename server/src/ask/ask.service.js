import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { getDb, getReadOnlyDb } from '../db/mongo.js';
import { HttpError } from '../utils/httpError.js';
import { TtlCache } from '../utils/ttlCache.js';
import { buildSystemInstruction, buildUserPrompt, CHART_TYPES } from './prompt.js';
import { validatePipeline } from './validator.js';

const MAX_ATTEMPTS = 2; // first try + one retry with the validator's feedback

const llmOutputSchema = z.object({
  answerable: z.boolean().default(true),
  collection: z.string().optional(),
  pipeline: z.array(z.unknown()).optional(),
  chartType: z.enum(CHART_TYPES).catch('table'),
  xField: z.string().nullish().catch(null),
  yFields: z.array(z.string()).nullish().catch(null),
  explanation: z.string().max(2000).catch(''),
});

const contextCache = new TtlCache({ ttlMs: 5 * 60 * 1000 });

async function promptContext() {
  const cached = contextCache.get('months');
  if (cached) return cached;
  const months = (await getDb().collection('carrier_monthly').distinct('month')).sort();
  const context = { months };
  contextCache.set('months', context);
  return context;
}

/** Strip optional markdown fences and parse the model's JSON reply. */
export function parseLlmOutput(text) {
  const cleaned = String(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let json;
  try {
    json = JSON.parse(cleaned);
  } catch {
    return { ok: false, errors: ['response was not valid JSON'] };
  }
  const result = llmOutputSchema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  return { ok: true, value: result.data };
}

/** Flatten `_id: { airline, month }` into top-level columns and stringify ObjectIds. */
export function normaliseRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === '_id' && value && typeof value === 'object' && !(value instanceof ObjectId)) {
      for (const [k, v] of Object.entries(value)) if (!(k in row)) out[k] = v;
    } else if (value instanceof ObjectId) {
      out[key] = value.toString();
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function logAsk(entry) {
  try {
    await getDb()
      .collection('ask_logs')
      .insertOne({ ...entry, createdAt: new Date() });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error('Failed to write ask_logs entry', err);
  }
}

/**
 * Turn a natural-language question into a validated pipeline, run it, and log the outcome.
 * @param {{ question: string, user: { id: string, email: string }, llm: import('./gemini.js').LlmClient, maxTimeMS: number }} input
 */
export async function askQuestion({ question, user, llm, maxTimeMS }) {
  const started = Date.now();
  const base = { userId: user.id, email: user.email, question, model: llm.model };
  const systemInstruction = buildSystemInstruction(await promptContext());

  /** @type {{ attempt: number, ok: boolean, errors?: string[] }[]} */
  const attempts = [];
  let feedback = null;
  let accepted = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !accepted; attempt += 1) {
    let raw;
    try {
      raw = await llm.generate({ systemInstruction, prompt: buildUserPrompt(question, feedback) });
    } catch (err) {
      await logAsk({
        ...base,
        outcome: 'llm_error',
        error: String(err?.message ?? err),
        attempts,
        durationMs: Date.now() - started,
      });
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new HttpError(504, 'The language model took too long to respond. Please try again.');
      }
      throw new HttpError(
        502,
        'The language model is unavailable right now. Please try again shortly.',
      );
    }

    const parsed = parseLlmOutput(raw);
    if (parsed.ok && !parsed.value.answerable) {
      await logAsk({
        ...base,
        outcome: 'unanswerable',
        explanation: parsed.value.explanation,
        attempts,
        durationMs: Date.now() - started,
      });
      throw new HttpError(
        422,
        parsed.value.explanation || 'This question cannot be answered from the available data.',
        {
          reason: 'unanswerable',
        },
      );
    }

    const checked = parsed.ok
      ? validatePipeline(parsed.value.collection, parsed.value.pipeline)
      : parsed;
    attempts.push({ attempt, ok: checked.ok, ...(checked.ok ? {} : { errors: checked.errors }) });

    if (checked.ok) accepted = { ...parsed.value, pipeline: checked.pipeline };
    else feedback = { previous: String(raw), errors: checked.errors };
  }

  if (!accepted) {
    const errors = attempts.at(-1)?.errors ?? [];
    await logAsk({
      ...base,
      outcome: 'rejected',
      errors,
      attempts,
      durationMs: Date.now() - started,
    });
    throw new HttpError(422, 'Could not build a safe query for this question. Try rephrasing it.', {
      reason: 'validation_failed',
      errors,
    });
  }

  const pipelineJson = JSON.stringify(accepted.pipeline);
  let rows;
  try {
    rows = await getReadOnlyDb()
      .collection(accepted.collection)
      .aggregate(accepted.pipeline, { maxTimeMS, allowDiskUse: false })
      .toArray();
  } catch (err) {
    await logAsk({
      ...base,
      outcome: 'query_error',
      collection: accepted.collection,
      pipelineJson,
      error: err?.message,
      attempts,
      durationMs: Date.now() - started,
    });
    if (err?.code === 50) throw new HttpError(504, 'The query took too long to run.');
    throw new HttpError(
      422,
      'The generated query could not be executed. Try rephrasing the question.',
      {
        reason: 'query_failed',
      },
    );
  }

  const durationMs = Date.now() - started;
  await logAsk({
    ...base,
    outcome: 'success',
    collection: accepted.collection,
    pipelineJson,
    rowCount: rows.length,
    attempts,
    durationMs,
  });

  return {
    question,
    collection: accepted.collection,
    pipeline: accepted.pipeline,
    chartType: accepted.chartType,
    xField: accepted.xField ?? null,
    yFields: accepted.yFields ?? null,
    explanation: accepted.explanation,
    rows: rows.map(normaliseRow),
    rowCount: rows.length,
    attempts: attempts.length,
    durationMs,
  };
}

/** Test hook: clear cached prompt context. */
export const resetAskContext = () => contextCache.clear();
