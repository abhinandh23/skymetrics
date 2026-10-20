/**
 * Validate request parts with zod schemas. Parsed values are stored on `req.valid`
 * (Express 5 makes `req.query` read-only, so the originals are left untouched).
 * @param {{ query?: import('zod').ZodType, body?: import('zod').ZodType, params?: import('zod').ZodType }} schemas
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = req.valid ?? {};
    for (const part of /** @type {const} */ (['params', 'query', 'body'])) {
      if (schemas[part]) req.valid[part] = schemas[part].parse(req[part] ?? {});
    }
    next();
  };
}
