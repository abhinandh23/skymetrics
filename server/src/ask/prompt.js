import { AIRLINE_NAMES } from '../services/airlines.js';
import { describeSchema } from './schema.js';
import { ACCUMULATORS, ALLOWED_STAGES, EXPRESSION_OPERATORS, MAX_LIMIT } from './validator.js';

export const CHART_TYPES = /** @type {const} */ (['bar', 'line', 'pie', 'table']);

/**
 * @param {{ months: string[] }} context
 */
export function buildSystemInstruction({ months }) {
  const airlines = Object.entries(AIRLINE_NAMES)
    .map(([code, name]) => `${code}=${name}`)
    .join(', ');
  return `You translate questions about US airline on-time performance into a single read-only MongoDB aggregation pipeline.

DATA (pre-aggregated KPI collections; there is no per-flight data):
${describeSchema()}

Months available: ${months.length ? months.join(', ') : 'unknown'}.
Airline codes: ${airlines}.

RULES
- Query exactly one of the collections above and only the fields listed for it.
- Allowed stages: ${[...ALLOWED_STAGES].join(', ')}.
- Allowed accumulators in $group: ${[...ACCUMULATORS].join(', ')}.
- Allowed expression operators: ${[...EXPRESSION_OPERATORS].join(', ')}.
- In $match use plain field conditions ($eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists, $not), $and/$or/$nor, or $expr.
- Never use $lookup, $out, $merge, $unionWith, $function, $accumulator, $where, $regex, variables like $$ROOT, or any operator not listed.
- Month values are strings like "2026-07". If the question names a month without a year, use the matching month from the available months. If it asks about data that is not available, set "answerable" to false.
- For "top N" / "worst N" questions use $sort then $limit. Every pipeline must return at most ${MAX_LIMIT} documents.
- Percentages (onTimePct, cancelPct, ...) are already 0-100. When combining several documents, weight them: on-time % and average delays by "completed", cancellation/diversion % by "flights". Round results with $round to 2 decimals.
- After $group, use $project to give every output field a readable flat name (move values out of _id and set _id to 0).
- Use airline codes in filters (e.g. "Delta" -> "DL").

OUTPUT: reply with JSON only, no markdown, in exactly this shape:
{
  "answerable": true,
  "collection": "<one collection name>",
  "pipeline": [ { "$match": { } } ],
  "chartType": "bar" | "line" | "pie" | "table",
  "xField": "<output field for the x axis / labels, or null>",
  "yFields": ["<numeric output fields to plot>"],
  "explanation": "<one or two sentences describing what the query computes>"
}
Chart choice: "line" when x is a month or date, "bar" to compare categories, "pie" only for shares of a whole with at most 8 slices, "table" when a chart would not help.`;
}

/**
 * @param {string} question
 * @param {{ previous: string, errors: string[] } | null} feedback
 */
export function buildUserPrompt(question, feedback) {
  let prompt = `Question: ${question}`;
  if (feedback) {
    prompt += `

Your previous answer was rejected by the safety validator.
Previous answer: ${feedback.previous.slice(0, 4000)}
Validation errors:
${feedback.errors.map((e) => `- ${e}`).join('\n')}
Return a corrected answer that follows all the rules.`;
  }
  return prompt;
}
