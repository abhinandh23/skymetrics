import { MAX_LIMIT, validatePipeline } from '../src/ask/validator.js';

const C = 'carrier_monthly';

/** Shorthand: expect rejection with an error containing `fragment`. */
function expectRejected(collection, pipeline, fragment) {
  const result = validatePipeline(collection, pipeline);
  expect(result.ok).toBe(false);
  if (fragment) expect(result.errors.join(' ')).toContain(fragment);
}

describe('validatePipeline: accepted pipelines', () => {
  test.each([
    [
      'top routes by delay',
      'route_monthly',
      [
        { $match: { month: '2026-07' } },
        { $sort: { avgArrDelay: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, route: 1, avgArrDelay: 1, flights: 1 } },
      ],
    ],
    [
      'weighted group by airline',
      C,
      [
        { $match: { month: { $in: ['2026-06', '2026-07'] } } },
        {
          $group: {
            _id: '$airline',
            completed: { $sum: '$completed' },
            weighted: { $sum: { $multiply: ['$onTimePct', '$completed'] } },
          },
        },
        { $addFields: { onTime: { $round: [{ $divide: ['$weighted', '$completed'] }, 2] } } },
        { $project: { _id: 0, airline: '$_id', onTime: 1 } },
        { $sort: { onTime: -1 } },
      ],
    ],
    [
      'compound _id and dotted sort',
      'delay_causes_monthly',
      [
        {
          $group: {
            _id: { airline: '$airline', month: '$month' },
            total: { $sum: '$totalDelayMin' },
          },
        },
        { $sort: { '_id.month': 1, total: -1 } },
        { $limit: 50 },
      ],
    ],
    [
      'count',
      'airport_monthly',
      [{ $match: { flights: { $gte: 1000 } } }, { $count: 'busyAirports' }],
    ],
    [
      '$expr, $cond and $switch',
      C,
      [
        { $match: { $expr: { $gt: ['$cancelled', '$diverted'] } } },
        {
          $project: {
            airline: 1,
            band: {
              $switch: {
                branches: [{ case: { $gte: ['$onTimePct', 80] }, then: 'good' }],
                default: 'poor',
              },
            },
            flag: { $cond: { if: { $lt: ['$avgArrDelay', 0] }, then: 'early', else: 'late' } },
          },
        },
      ],
    ],
    [
      'logical operators and $not',
      'route_monthly',
      [
        {
          $match: {
            $or: [{ origin: 'JFK' }, { dest: 'JFK' }],
            flights: { $not: { $lt: 100 } },
            avgArrDelay: { $exists: true },
          },
        },
      ],
    ],
    [
      'push then unwind',
      C,
      [
        { $group: { _id: '$month', airlines: { $push: '$airline' } } },
        { $unwind: { path: '$airlines', preserveNullAndEmptyArrays: false } },
        { $limit: 100 },
      ],
    ],
    [
      'exclusion projection',
      C,
      [{ $project: { _id: 0, avgDepDelay: 0 } }, { $sort: { flights: -1 } }],
    ],
    ['$count accumulator', C, [{ $group: { _id: '$month', n: { $count: {} } } }]],
  ])('%s', (_name, collection, pipeline) => {
    const result = validatePipeline(collection, pipeline);
    expect(result.errors).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  test('appends a $limit when the pipeline has none', () => {
    const result = validatePipeline(C, [{ $match: { airline: 'AA' } }]);
    expect(result.pipeline.at(-1)).toEqual({ $limit: MAX_LIMIT });
  });

  test('does not append a $limit after $count or an existing final $limit', () => {
    expect(validatePipeline(C, [{ $count: 'n' }]).pipeline).toHaveLength(1);
    expect(validatePipeline(C, [{ $limit: 10 }]).pipeline).toEqual([{ $limit: 10 }]);
  });

  test('appends a final $limit when $unwind follows an earlier $limit', () => {
    const result = validatePipeline(C, [
      { $limit: 10 },
      { $group: { _id: null, a: { $push: '$airline' } } },
      { $unwind: '$a' },
    ]);
    expect(result.pipeline.at(-1)).toEqual({ $limit: MAX_LIMIT });
  });

  test('returns a deep copy of the input', () => {
    const input = [{ $match: { airline: 'AA' } }];
    const result = validatePipeline(C, input);
    input[0].$match.airline = { $where: 'sleep(1000)' };
    expect(result.pipeline[0]).toEqual({ $match: { airline: 'AA' } });
  });
});

describe('validatePipeline: rejected pipelines', () => {
  test.each([
    ['unknown collection', 'users', [{ $match: {} }], 'not allowed'],
    ['system collection', 'system.users', [{ $match: {} }], 'not allowed'],
    ['ask_logs collection', 'ask_logs', [{ $match: {} }], 'not allowed'],
    ['prototype key as collection', '__proto__', [{ $match: {} }], 'not allowed'],
    ['non-string collection', { $ne: null }, [{ $match: {} }], 'not allowed'],
  ])('%s', (_name, collection, pipeline, fragment) =>
    expectRejected(collection, pipeline, fragment),
  );

  test.each([
    ['empty pipeline', [], 'non-empty array'],
    ['pipeline is an object', { $match: {} }, 'non-empty array'],
    ['too many stages', Array.from({ length: 16 }, () => ({ $match: {} })), 'at most'],
    ['stage is a string', ['$match'], 'must be an object'],
    ['stage with two keys', [{ $match: {}, $limit: 5 }], 'exactly one key'],
    ['$out', [{ $out: 'hacked' }], 'forbidden'],
    ['$merge', [{ $merge: { into: 'users' } }], 'forbidden'],
    [
      '$lookup',
      [{ $lookup: { from: 'users', localField: 'a', foreignField: 'b', as: 'u' } }],
      'forbidden',
    ],
    ['$graphLookup', [{ $graphLookup: { from: 'users' } }], 'forbidden'],
    ['$unionWith', [{ $unionWith: 'users' }], 'forbidden'],
    ['$facet', [{ $facet: { a: [{ $match: {} }] } }], 'forbidden'],
    ['$currentOp', [{ $currentOp: {} }], 'forbidden'],
    ['$collStats', [{ $collStats: {} }], 'forbidden'],
    ['$sample (not allow-listed)', [{ $sample: { size: 5 } }], 'not allowed'],
    ['$set (alias not allow-listed)', [{ $set: { a: 1 } }], 'not allowed'],
    ['$replaceRoot', [{ $replaceRoot: { newRoot: '$$ROOT' } }], 'not allowed'],
  ])('stage: %s', (_name, pipeline, fragment) => expectRejected(C, pipeline, fragment));

  test.each([
    ['$where in $match', [{ $match: { $where: 'sleep(5000)' } }], 'forbidden'],
    [
      '$where nested in $or',
      [{ $match: { $or: [{ airline: 'AA' }, { $where: 'true' }] } }],
      'forbidden',
    ],
    [
      '$function in $expr',
      [{ $match: { $expr: { $function: { body: 'x', args: [], lang: 'js' } } } }],
      'forbidden',
    ],
    [
      '$function hidden in $group',
      [
        {
          $group: {
            _id: null,
            x: { $sum: { $function: { body: 'while(1){}', args: [], lang: 'js' } } },
          },
        },
      ],
      'forbidden',
    ],
    [
      '$accumulator',
      [{ $group: { _id: null, x: { $accumulator: { init: 'function(){}' } } } }],
      'forbidden',
    ],
    ['$regex operator', [{ $match: { airline: { $regex: '^(a+)+$' } } }], 'not allowed'],
    ['$text search', [{ $match: { $text: { $search: 'x' } } }], 'not allowed'],
    ['$elemMatch', [{ $match: { airline: { $elemMatch: { a: 1 } } } }], 'not allowed'],
    [
      'unknown expression op',
      [{ $project: { x: { $dateFromString: { dateString: '$month' } } } }],
      'not allowed',
    ],
    ['$literal', [{ $project: { x: { $literal: '$where' } } }], 'not allowed'],
    ['$$ROOT variable', [{ $project: { doc: '$$ROOT' } }], 'variables'],
    ['$$NOW variable', [{ $addFields: { now: '$$NOW' } }], 'variables'],
    [
      'operator object with two keys',
      [{ $project: { x: { $add: [1, 2], $multiply: [1, 2] } } }],
      'exactly one key',
    ],
    ['$in with object values', [{ $match: { airline: { $in: [{ $gt: '' }] } } }], 'literal values'],
    ['$in not an array', [{ $match: { airline: { $in: 'AA' } } }], 'literal values'],
    ['$in too many values', [{ $match: { airline: { $in: Array(201).fill('AA') } } }], 'at most'],
    ['$exists non-boolean', [{ $match: { airline: { $exists: 1 } } }], 'true or false'],
    ['$gt with object', [{ $match: { flights: { $gt: { $function: {} } } } }], 'literal value'],
    ['embedded document equality', [{ $match: { airline: { code: 'AA' } } }], 'not allowed'],
    ['$or not an array', [{ $match: { $or: { airline: 'AA' } } }], 'non-empty array'],
    ['$or empty', [{ $match: { $or: [] } }], 'non-empty array'],
    ['$match not an object', [{ $match: 'airline' }], 'must be an object'],
  ])('operator: %s', (_name, pipeline, fragment) => expectRejected(C, pipeline, fragment));

  test.each([
    ['unknown field in $match', [{ $match: { password: 'x' } }], 'unknown field "password"'],
    ['unknown field reference', [{ $project: { x: '$passwordHash' } }], 'unknown field'],
    ['field from another collection', [{ $match: { route: 'JFK-LAX' } }], 'unknown field "route"'],
    [
      'field removed by $group',
      [{ $group: { _id: '$airline' } }, { $sort: { flights: -1 } }],
      'unknown field "flights"',
    ],
    [
      'field removed by $project',
      [{ $project: { airline: 1 } }, { $match: { month: '2026-06' } }],
      'unknown field "month"',
    ],
    ['field after $count', [{ $count: 'n' }, { $sort: { airline: 1 } }], 'unknown field'],
    ['invalid field path', [{ $match: { 'airline..x': 'AA' } }], 'invalid field path'],
    ['field path with $ segment', [{ $sort: { 'airline.$x': 1 } }], 'invalid field path'],
    [
      '__proto__ key in $match',
      [JSON.parse('{"$match":{"__proto__":{"polluted":true}}}')],
      '__proto__',
    ],
    ['__proto__ output name', [JSON.parse('{"$addFields":{"__proto__":1}}')], '__proto__'],
    [
      'constructor output name',
      [{ $group: { _id: null, constructor: { $sum: 1 } } }],
      'constructor',
    ],
    ['dotted output name', [{ $addFields: { 'a.b': 1 } }], 'invalid output field name'],
    [
      '$-prefixed output name',
      [{ $group: { _id: null, $bad: { $sum: 1 } } }],
      'invalid output field name',
    ],
  ])('fields: %s', (_name, pipeline, fragment) => expectRejected(C, pipeline, fragment));

  test.each([
    ['$limit above maximum', [{ $limit: 10_000 }], `at most ${MAX_LIMIT}`],
    ['$limit zero', [{ $limit: 0 }], 'positive integer'],
    ['$limit as string', [{ $limit: '5' }], 'positive integer'],
    ['$limit fractional', [{ $limit: 2.5 }], 'positive integer'],
    ['$sort with $meta', [{ $sort: { airline: { $meta: 'textScore' } } }], '1 or -1'],
    ['$sort empty', [{ $sort: {} }], 'non-empty'],
    ['$group without _id', [{ $group: { total: { $sum: '$flights' } } }], '_id'],
    ['$group non-accumulator', [{ $group: { _id: null, total: '$flights' } }], 'accumulator'],
    [
      '$group expression op as accumulator',
      [{ $group: { _id: null, total: { $add: [1] } } }],
      'not allowed',
    ],
    [
      '$count accumulator with args',
      [{ $group: { _id: null, n: { $count: { x: 1 } } } }],
      'empty object',
    ],
    ['$project mixing modes', [{ $project: { airline: 1, month: 0 } }], 'cannot mix'],
    ['$project empty', [{ $project: {} }], 'non-empty'],
    ['$count non-string', [{ $count: { n: 1 } }], 'field name string'],
    [
      '$unwind includeArrayIndex',
      [{ $unwind: { path: '$airline', includeArrayIndex: 'i' } }],
      'unsupported option',
    ],
    ['$unwind without $', [{ $unwind: 'airline' }], '"$field" path'],
    ['long string literal', [{ $match: { airline: 'x'.repeat(201) } }], 'literal'],
    ['too deeply nested', [{ $project: { x: nest(20) } }], 'too deeply'],
    ['too many nodes', [{ $project: { x: { $add: Array(1600).fill(1) } } }], 'too large'],
  ])('shape: %s', (_name, pipeline, fragment) => expectRejected(C, pipeline, fragment));
});

function nest(depth) {
  let value = 1;
  for (let i = 0; i < depth; i += 1) value = { $abs: value };
  return value;
}
