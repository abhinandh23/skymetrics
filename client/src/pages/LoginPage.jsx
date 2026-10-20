import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

const DEMO = [
  { label: 'Analyst demo', email: 'analyst@example.com', password: 'Analyst123!' },
  { label: 'Viewer demo', email: 'viewer@example.com', password: 'Viewer123!' },
];

const inputClass =
  'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-2 focus:outline-accent';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      const from = location.state?.from;
      navigate(from ? `${from.pathname}${from.search ?? ''}` : '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sky<span className="text-accent">Metrics</span>
        </h1>
        <p className="mt-1 text-sm text-ink-2">US airline on-time performance analytics</p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <label className="block text-sm">
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-critical">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !email || !password}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 border-t border-line pt-4">
          <p className="text-xs text-ink-muted">Demo accounts</p>
          <div className="mt-2 flex gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                className="flex-1 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-surface-2"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
