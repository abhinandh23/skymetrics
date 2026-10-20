import { api } from './client.js';

/** Drop empty values so they are not sent as `?month=`. */
const clean = (params) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );

const get = (url, params = {}, config = {}) =>
  api.get(url, { params: clean(params), ...config }).then((r) => r.data);

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data.user),
};

export const kpiApi = {
  filters: (config) => get('/kpi/filters', {}, config),
  overview: (params, config) => get('/kpi/overview', params, config),
  carriers: (params, config) => get('/kpi/carriers', params, config),
  airports: (params, config) => get('/kpi/airports', params, config),
  routes: (params, config) => get('/kpi/routes', params, config),
  delayCauses: (params, config) => get('/kpi/delay-causes', params, config),
};

export const askApi = {
  ask: (question) => api.post('/ask', { question }).then((r) => r.data),
};
