import axios from 'axios';

const TOKEN_KEY = 'skymetrics.token';

/**
 * Demo trade-off: the JWT lives in localStorage so the SPA can attach it as a Bearer header.
 * A production build would prefer an httpOnly, SameSite cookie to keep it out of reach of XSS.
 */
export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable (private mode): the session lasts until reload */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 30_000,
});

let onUnauthorized = () => {};

/** Register what happens when the API rejects the token (set by AuthProvider). */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLogin) {
      tokenStore.clear();
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

/** Human-readable message from an API error. */
export function errorMessage(error) {
  if (error?.response?.data?.error?.message) return error.response.data.error.message;
  if (error?.code === 'ECONNABORTED') return 'The request timed out.';
  if (error?.request && !error?.response) return 'Cannot reach the server.';
  return error?.message ?? 'Something went wrong.';
}
