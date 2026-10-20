import { ASK_COLLECTIONS, fieldsOf } from './schema.js';

/**
 * Allow-list validator for LLM-generated aggregation pipelines.
 *
 * Everything is rejected unless explicitly allowed: stages, operators, field references,
 * output field names and literal types. The validator also tracks which fields exist after
 * each stage, so a `$sort` on a field created by `$group` is accepted while a reference to
 * a field that does not exist is rejected before anything reaches the database.
 */

export const MAX_LIMIT = 500;
export const MAX_STAGES = 15;
const MAX_DEPTH = 12;
const MAX_NODES = 1500;
const MAX_STRING = 200;
const MAX_IN_VALUES = 200;

export const ALLOWED_STAGES = new Set([
  '$match',
  '$group',
  '$sort',
  '$limit',
  '$project',
  '$addFields',
  '$count',
  '$unwind',
]);

/** Named here only to produce clearer error messages; anything not allowed is rejected anyway. */
export const FORBIDDEN_OPERATORS = new Set([
  '$out',
  '$merge',
  '$lookup',
  '$graphLookup',
  '$unionWith',
  '$function',
  '$accumulator',
  '$where',
  '$facet',
  '$documents',
  '$currentOp',
  '$collStats',
  '$indexStats',
  '$planCacheStats',
  '$listSessions',
  '$changeStream',
]);

const QUERY_COMPARISON = new Set([
  '$eq',
  '$ne',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$in',
  '$nin',
  '$exists',
  '$not',
]);
const QUERY_LOGICAL = new Set(['$and', '$or', '$nor']);

export const ACCUMULATORS = new Set([
  '$sum',
  '$avg',
  '$min',
  '$max',
  '$first',
  '$last',
  '$push',
  '$addToSet',
  '$count',
  '$stdDevPop',
]);

export const EXPRESSION_OPERATORS = new Set([
  // arithmetic
  '$add',
  '$subtract',
  '$multiply',
  '$divide',
  '$mod',
  '$abs',
  '$ceil',
  '$floor',
  '$round',
  '$trunc',
  '$sqrt',
  '$pow',
  // comparison / boolean
  '$eq',
  '$ne',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$cmp',
  '$and',
  '$or',
  '$not',
  // conditional
  '$cond',
  '$ifNull',
  '$switch',
  // string
  '$concat',
  '$toUpper',
  '$toLower',
  '$substrCP',
  '$strLenCP',
  // array
  '$size',
  '$slice',
  '$arrayElemAt',
  '$in',
  // type conversion
  '$toString',
  '$toInt',
  '$toDouble',
  '$toLong',
  // accumulators are also valid expressions over arrays
  '$sum',
  '$avg',
  '$min',
  '$max',
]);

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FIELD_PATH = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export class PipelineValidationError extends Error {
  /** @param {string[]} errors */
  constructor(errors) {
    super(errors.join('; '));
    this.name = 'PipelineValidationError';
    this.errors = errors;
  }
}

const isPlainObject = (v) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(v));

const isPrimitive = (v) =>
  v === null ||
  ['number', 'boolean'].includes(typeof v) ||
  (typeof v === 'string' && v.length <= MAX_STRING);

class Walker {
  /** @param {Set<string>} available */
  constructor(available) {
    this.available = available;
    this.nodes = 0;
  }

  fail(path, message) {
    throw new PipelineValidationError([`${path}: ${message}`]);
  }

  tick(path, depth) {
    this.nodes += 1;
    if (this.nodes > MAX_NODES) this.fail(path, 'pipeline is too large');
    if (depth > MAX_DEPTH) this.fail(path, 'pipeline is nested too deeply');
  }

  checkKey(path, key) {
    if (DANGEROUS_KEYS.has(key)) this.fail(path, `key "${key}" is not allowed`);
  }

  /** A `"$field.sub"` reference inside an expression. */
  checkFieldRef(path, ref) {
    if (ref.startsWith('$$')) this.fail(path, `variables like "${ref}" are not allowed`);
    this.checkFieldPath(path, ref.slice(1));
  }

  checkFieldPath(path, fieldPath) {
    if (!FIELD_PATH.test(fieldPath)) this.fail(path, `invalid field path "${fieldPath}"`);
    const root = fieldPath.split('.')[0];
    this.checkKey(path, root);
    if (!this.available.has(root)) {
      this.fail(path, `unknown field "${root}" (available: ${[...this.available].join(', ')})`);
    }
  }

  checkOutputName(path, name) {
    this.checkKey(path, name);
    if (!IDENTIFIER.test(name)) this.fail(path, `invalid output field name "${name}"`);
  }

  operatorError(path, op) {
    return FORBIDDEN_OPERATORS.has(op)
      ? `operator ${op} is forbidden`
      : `operator ${op} is not allowed`;
  }

  /** Aggregation expression: literal, field reference, operator object, object or array. */
  expression(value, path, depth = 0) {
    this.tick(path, depth);
    if (typeof value === 'string') {
      if (value.length > MAX_STRING) this.fail(path, 'string literal is too long');
      if (value.startsWith('$')) this.checkFieldRef(path, value);
      return;
    }
    if (isPrimitive(value)) return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => this.expression(item, `${path}[${i}]`, depth + 1));
      return;
    }
    if (!isPlainObject(value)) this.fail(path, 'unsupported value type');

    const keys = Object.keys(value);
    const operatorKeys = keys.filter((k) => k.startsWith('$'));
    if (operatorKeys.length > 0) {
      if (keys.length !== 1) this.fail(path, 'an operator object must have exactly one key');
      const [op] = keys;
      if (!EXPRESSION_OPERATORS.has(op)) this.fail(`${path}.${op}`, this.operatorError(path, op));
      this.expression(value[op], `${path}.${op}`, depth + 1);
      return;
    }
    // Plain object literal, e.g. `_id: { airline: "$airline", month: "$month" }`
    // or the `if/then/else`, `branches/case/then/default` arguments of $cond/$switch.
    for (const key of keys) {
      this.checkOutputName(`${path}.${key}`, key);
      this.expression(value[key], `${path}.${key}`, depth + 1);
    }
  }

  /** `$match` query document. */
  query(doc, path, depth = 0) {
    this.tick(path, depth);
    if (!isPlainObject(doc)) this.fail(path, 'must be an object');
    for (const [key, value] of Object.entries(doc)) {
      const here = `${path}.${key}`;
      this.checkKey(here, key);
      if (QUERY_LOGICAL.has(key)) {
        if (!Array.isArray(value) || value.length === 0)
          this.fail(here, 'must be a non-empty array');
        value.forEach((clause, i) => this.query(clause, `${here}[${i}]`, depth + 1));
      } else if (key === '$expr') {
        this.expression(value, here, depth + 1);
      } else if (key.startsWith('$')) {
        this.fail(here, this.operatorError(here, key));
      } else {
        this.checkFieldPath(here, key);
        this.fieldCondition(value, here, depth + 1);
      }
    }
  }

  fieldCondition(value, path, depth) {
    this.tick(path, depth);
    if (isPrimitive(value)) return;
    if (!isPlainObject(value)) this.fail(path, 'condition must be a literal or an operator object');
    const entries = Object.entries(value);
    if (entries.length === 0) this.fail(path, 'empty condition');
    for (const [op, arg] of entries) {
      const here = `${path}.${op}`;
      this.checkKey(here, op);
      if (!QUERY_COMPARISON.has(op)) this.fail(here, this.operatorError(here, op));
      if (op === '$in' || op === '$nin') {
        if (!Array.isArray(arg) || arg.length > MAX_IN_VALUES || !arg.every(isPrimitive)) {
          this.fail(here, `must be an array of at most ${MAX_IN_VALUES} literal values`);
        }
      } else if (op === '$exists') {
        if (typeof arg !== 'boolean') this.fail(here, 'must be true or false');
      } else if (op === '$not') {
        if (!isPlainObject(arg)) this.fail(here, 'must be an operator object');
        this.fieldCondition(arg, here, depth + 1);
      } else if (!isPrimitive(arg)) {
        this.fail(here, 'must be a literal value');
      }
    }
  }
}

const STAGES = {
  $match(spec, walker, path) {
    walker.query(spec, path);
  },

  $group(spec, walker, path) {
    if (!isPlainObject(spec)) walker.fail(path, 'must be an object');
    if (!Object.hasOwn(spec, '_id')) walker.fail(path, 'must include an _id');
    const outputs = new Set(['_id']);
    for (const [name, value] of Object.entries(spec)) {
      const here = `${path}.${name}`;
      if (name === '_id') {
        walker.expression(value, here);
        continue;
      }
      walker.checkOutputName(here, name);
      if (!isPlainObject(value) || Object.keys(value).length !== 1) {
        walker.fail(here, 'must be an accumulator object like { "$sum": "$flights" }');
      }
      const [acc] = Object.keys(value);
      if (!ACCUMULATORS.has(acc)) walker.fail(`${here}.${acc}`, walker.operatorError(here, acc));
      if (acc === '$count') {
        if (!isPlainObject(value[acc]) || Object.keys(value[acc]).length) {
          walker.fail(`${here}.$count`, 'must be an empty object');
        }
      } else {
        walker.expression(value[acc], `${here}.${acc}`);
      }
      outputs.add(name);
    }
    walker.available = outputs;
  },

  $sort(spec, walker, path) {
    if (!isPlainObject(spec) || Object.keys(spec).length === 0) {
      walker.fail(path, 'must be a non-empty object');
    }
    for (const [field, direction] of Object.entries(spec)) {
      walker.checkFieldPath(`${path}.${field}`, field);
      if (direction !== 1 && direction !== -1) walker.fail(`${path}.${field}`, 'must be 1 or -1');
    }
  },

  $limit(spec, walker, path) {
    if (!Number.isInteger(spec) || spec < 1) walker.fail(path, 'must be a positive integer');
    if (spec > MAX_LIMIT) walker.fail(path, `must be at most ${MAX_LIMIT}`);
  },

  $project(spec, walker, path) {
    if (!isPlainObject(spec) || Object.keys(spec).length === 0) {
      walker.fail(path, 'must be a non-empty object');
    }
    const included = new Set();
    const excluded = new Set();
    let keepId = true;
    for (const [name, value] of Object.entries(spec)) {
      const here = `${path}.${name}`;
      const flag = value === 0 || value === false ? 0 : value === 1 || value === true ? 1 : null;
      if (name === '_id' && flag === 0) {
        keepId = false;
        continue;
      }
      if (flag === 0) {
        walker.checkFieldPath(here, name);
        excluded.add(name.split('.')[0]);
      } else if (flag === 1) {
        walker.checkFieldPath(here, name);
        included.add(name.split('.')[0]);
      } else {
        walker.checkOutputName(here, name);
        walker.expression(value, here);
        included.add(name);
      }
    }
    if (included.size && excluded.size) {
      walker.fail(path, 'cannot mix inclusion and exclusion (except for _id)');
    }
    if (excluded.size || (!included.size && !keepId)) {
      walker.available = new Set([...walker.available].filter((f) => !excluded.has(f)));
      if (!keepId) walker.available.delete('_id');
    } else {
      walker.available = new Set([...included, ...(keepId ? ['_id'] : [])]);
    }
  },

  $addFields(spec, walker, path) {
    if (!isPlainObject(spec) || Object.keys(spec).length === 0) {
      walker.fail(path, 'must be a non-empty object');
    }
    const added = [];
    for (const [name, value] of Object.entries(spec)) {
      walker.checkOutputName(`${path}.${name}`, name);
      walker.expression(value, `${path}.${name}`);
      added.push(name);
    }
    walker.available = new Set([...walker.available, ...added]);
  },

  $count(spec, walker, path) {
    if (typeof spec !== 'string') walker.fail(path, 'must be a field name string');
    walker.checkOutputName(path, spec);
    walker.available = new Set([spec]);
  },

  $unwind(spec, walker, path) {
    let ref = spec;
    if (isPlainObject(spec)) {
      const extra = Object.keys(spec).filter(
        (k) => !['path', 'preserveNullAndEmptyArrays'].includes(k),
      );
      if (extra.length) walker.fail(path, `unsupported option(s): ${extra.join(', ')}`);
      if (
        spec.preserveNullAndEmptyArrays !== undefined &&
        typeof spec.preserveNullAndEmptyArrays !== 'boolean'
      ) {
        walker.fail(path, 'preserveNullAndEmptyArrays must be a boolean');
      }
      ref = spec.path;
    }
    if (typeof ref !== 'string' || !ref.startsWith('$')) {
      walker.fail(path, 'must be a "$field" path');
    }
    walker.checkFieldRef(path, ref);
  },
};

/**
 * Validate a generated pipeline against the allow-lists.
 * @param {unknown} collection
 * @param {unknown} pipeline
 * @returns {{ ok: true, pipeline: object[] } | { ok: false, errors: string[] }}
 */
export function validatePipeline(collection, pipeline) {
  try {
    if (typeof collection !== 'string' || !Object.hasOwn(ASK_COLLECTIONS, collection)) {
      throw new PipelineValidationError([
        `collection "${String(collection)}" is not allowed (allowed: ${Object.keys(ASK_COLLECTIONS).join(', ')})`,
      ]);
    }
    if (!Array.isArray(pipeline) || pipeline.length === 0) {
      throw new PipelineValidationError(['pipeline must be a non-empty array of stages']);
    }
    if (pipeline.length > MAX_STAGES) {
      throw new PipelineValidationError([`pipeline must have at most ${MAX_STAGES} stages`]);
    }

    const walker = new Walker(fieldsOf(collection));
    pipeline.forEach((stage, i) => {
      const path = `pipeline[${i}]`;
      if (!isPlainObject(stage)) walker.fail(path, 'each stage must be an object');
      const keys = Object.keys(stage);
      if (keys.length !== 1) walker.fail(path, 'each stage must have exactly one key');
      const [name] = keys;
      walker.checkKey(path, name);
      if (!ALLOWED_STAGES.has(name)) {
        walker.fail(
          path,
          FORBIDDEN_OPERATORS.has(name)
            ? `stage ${name} is forbidden`
            : `stage ${name} is not allowed`,
        );
      }
      STAGES[name](stage[name], walker, `${path}.${name}`);
    });

    // Deep copy so later mutation of the input cannot change what was validated.
    const safe = JSON.parse(JSON.stringify(pipeline));
    const last = Object.keys(safe.at(-1))[0];
    if (last !== '$limit' && last !== '$count') safe.push({ $limit: MAX_LIMIT });
    return { ok: true, pipeline: safe };
  } catch (err) {
    if (err instanceof PipelineValidationError) return { ok: false, errors: err.errors };
    throw err;
  }
}
