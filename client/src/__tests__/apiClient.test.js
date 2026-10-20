import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api, errorMessage, setUnauthorizedHandler, tokenStore } from '../api/client.js';

let lastConfig;
const respond = (status, data = {}) => {
  api.defaults.adapter = async (config) => {
    lastConfig = config;
    if (status >= 400) {
      const error = new Error(`HTTP ${status}`);
      Object.assign(error, { config, response: { status, data, config } });
      throw error;
    }
    return { status, data, headers: {}, config, statusText: 'OK' };
  };
};

beforeEach(() => setUnauthorizedHandler(() => {}));
afterEach(() => tokenStore.clear());

describe('api client', () => {
  test('attaches the bearer token', async () => {
    tokenStore.set('abc.def.ghi');
    respond(200, { ok: true });
    await api.get('/kpi/filters');
    expect(lastConfig.headers.Authorization).toBe('Bearer abc.def.ghi');
  });

  test('sends no auth header without a token', async () => {
    respond(200);
    await api.get('/health');
    expect(lastConfig.headers.Authorization).toBeUndefined();
  });

  test('a 401 clears the token and notifies the app', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    tokenStore.set('expired');
    respond(401, { error: { message: 'Invalid or expired token' } });
    await expect(api.get('/kpi/carriers')).rejects.toThrow();
    expect(handler).toHaveBeenCalled();
    expect(tokenStore.get()).toBeNull();
  });

  test('a failed login does not trigger a logout', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    respond(401);
    await expect(api.post('/auth/login', {})).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  test('errorMessage prefers the API message', () => {
    expect(errorMessage({ response: { data: { error: { message: 'Nope' } } } })).toBe('Nope');
    expect(errorMessage({ code: 'ECONNABORTED' })).toBe('The request timed out.');
    expect(errorMessage({ request: {} })).toBe('Cannot reach the server.');
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });
});
