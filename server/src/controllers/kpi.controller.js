import { z } from 'zod';
import * as kpi from '../services/kpi.service.js';

const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM')
  .optional();
const airline = z
  .string()
  .regex(/^[A-Za-z0-9]{2}$/, 'airline must be a 2-character carrier code')
  .transform((s) => s.toUpperCase())
  .optional();
const airport = z
  .string()
  .regex(/^[A-Za-z]{3}$/, 'airport must be a 3-letter IATA code')
  .transform((s) => s.toUpperCase())
  .optional();
const page = z.coerce.number().int().min(1).max(10_000).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(25);
const minFlights = z.coerce.number().int().min(0).max(1_000_000).optional();

/** @param {string[]} fields */
const sortOf = (fields) =>
  z
    .string()
    .refine((s) => fields.includes(s.replace(/^-/, '')), {
      message: `sort must be one of: ${fields.join(', ')} (prefix with - for descending)`,
    })
    .optional();

export const schemas = {
  carriers: z.strictObject({
    month,
    airline,
    page,
    limit,
    sort: sortOf(kpi.SORTABLE.carrier_monthly),
  }),
  airports: z.strictObject({
    month,
    airport,
    minFlights,
    page,
    limit,
    sort: sortOf(kpi.SORTABLE.airport_monthly),
  }),
  routes: z.strictObject({
    month,
    origin: airport,
    dest: airport,
    airport,
    minFlights,
    page,
    limit,
    sort: sortOf(kpi.SORTABLE.route_monthly),
  }),
  delayCauses: z.strictObject({ month, airline }),
  overview: z.strictObject({ month, airline }),
};

export const carriers = async (req, res) => res.json(await kpi.listCarriers(req.valid.query));
export const airports = async (req, res) => res.json(await kpi.listAirports(req.valid.query));
export const routes = async (req, res) => res.json(await kpi.listRoutes(req.valid.query));
export const delayCauses = async (req, res) => res.json(await kpi.listDelayCauses(req.valid.query));
export const overview = async (req, res) => res.json(await kpi.overview(req.valid.query));
export const filters = async (_req, res) => res.json(await kpi.filterOptions());
