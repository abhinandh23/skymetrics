/**
 * Fake LLM client: returns queued responses in order (strings, objects or Errors).
 * @param {...(string | object | Error)} responses
 */
export function fakeLlm(...responses) {
  const queue = [...responses];
  const calls = [];
  return {
    model: 'fake-model',
    calls,
    async generate(input) {
      calls.push(input);
      const next = queue.shift();
      if (next === undefined) throw new Error('fakeLlm: no more responses');
      if (next instanceof Error) throw next;
      return typeof next === 'string' ? next : JSON.stringify(next);
    },
  };
}

export const worstRoutesAnswer = {
  answerable: true,
  collection: 'route_monthly',
  pipeline: [
    { $match: { month: '2026-06' } },
    { $sort: { avgArrDelay: -1 } },
    { $limit: 5 },
    { $project: { _id: 0, route: 1, avgArrDelay: 1 } },
  ],
  chartType: 'bar',
  xField: 'route',
  yFields: ['avgArrDelay'],
  explanation: 'Routes in June 2026 sorted by average arrival delay.',
};
