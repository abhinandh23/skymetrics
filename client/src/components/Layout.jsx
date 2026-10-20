import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFilters } from '../hooks/useFilters.js';

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/airlines', label: 'Airlines' },
  { to: '/airports', label: 'Airports' },
  { to: '/routes', label: 'Routes' },
  { to: '/delay-causes', label: 'Delay causes' },
  { to: '/ask', label: 'Ask your data', role: 'analyst' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { search } = useFilters();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((item) => !item.role || item.role === user?.role);

  const link = ({ isActive }) =>
    `block rounded-lg px-3 py-2 text-sm ${
      isActive
        ? 'bg-accent/10 font-medium text-accent'
        : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
    }`;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="border-b border-line bg-surface lg:min-h-screen lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-lg font-semibold tracking-tight">
            Sky<span className="text-accent">Metrics</span>
          </span>
          <button
            type="button"
            className="rounded-lg border border-line px-2 py-1 text-sm lg:hidden"
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen((o) => !o)}
          >
            Menu
          </button>
        </div>
        <nav
          id="main-nav"
          aria-label="Main"
          className={`${open ? 'block' : 'hidden'} px-2 pb-4 lg:block`}
        >
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={{ pathname: item.to, search }}
                  end={item.end}
                  className={link}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-line px-3 pt-4 text-sm">
            <p className="truncate font-medium">{user?.name}</p>
            <p className="text-xs text-ink-muted">
              {user?.email} · <span className="capitalize">{user?.role}</span>
            </p>
            <button
              type="button"
              onClick={logout}
              className="mt-2 text-sm text-accent hover:underline"
            >
              Sign out
            </button>
          </div>
        </nav>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, description, children }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      {children}
    </header>
  );
}
