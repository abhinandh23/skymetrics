import { Navigate, Outlet, useLocation } from 'react-router';
import { Loading } from '../components/States.jsx';
import { useAuth } from './AuthContext.jsx';

/**
 * Gate a route subtree on authentication and (optionally) a role.
 * @param {{ role?: 'analyst' | 'viewer', children?: import('react').ReactNode }} props
 */
export function ProtectedRoute({ role, children }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Loading label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (role && user.role !== role) {
    return (
      <div role="alert" className="mx-auto max-w-lg rounded-xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold">Analyst access required</h2>
        <p className="mt-2 text-sm text-ink-2">
          Your account has the <strong>{user.role}</strong> role. Ask your data is available to
          analysts only.
        </p>
      </div>
    );
  }
  return children ?? <Outlet />;
}
