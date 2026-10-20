import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useAuth } from '../auth/AuthContext.jsx';
import { ProtectedRoute } from '../auth/ProtectedRoute.jsx';
import { Layout } from '../components/Layout.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';

vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

const analyst = { name: 'Ann', email: 'analyst@example.com', role: 'analyst' };
const viewer = { name: 'Vic', email: 'viewer@example.com', role: 'viewer' };

const asUser = (user, extra = {}) =>
  useAuth.mockReturnValue({
    user,
    status: user ? 'authenticated' : 'anonymous',
    login: vi.fn(),
    logout: vi.fn(),
    isAnalyst: user?.role === 'analyst',
    ...extra,
  });

function renderRoutes(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/login" element={<p>Login screen</p>} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<p>Overview content</p>} />
            <Route
              path="ask"
              element={
                <ProtectedRoute role="analyst">
                  <p>Ask content</p>
                </ProtectedRoute>
              }
            />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ProtectedRoute', () => {
  test('redirects anonymous users to login', () => {
    asUser(null);
    renderRoutes('/');
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });

  test('shows a loading state while the session is checked', () => {
    asUser(null, { status: 'loading' });
    renderRoutes('/');
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
  });

  test('lets analysts open Ask your data', () => {
    asUser(analyst);
    renderRoutes('/ask');
    expect(screen.getByText('Ask content')).toBeInTheDocument();
  });

  test('blocks viewers from Ask your data', () => {
    asUser(viewer);
    renderRoutes('/ask');
    expect(screen.queryByText('Ask content')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Analyst access required');
  });
});

describe('Layout navigation', () => {
  test('analysts see the Ask your data link', () => {
    asUser(analyst);
    renderRoutes('/?month=2026-07');
    const link = screen.getByRole('link', { name: 'Ask your data' });
    expect(link).toHaveAttribute('href', '/ask?month=2026-07');
  });

  test('viewers do not', () => {
    asUser(viewer);
    renderRoutes('/');
    expect(screen.queryByRole('link', { name: 'Ask your data' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Airlines' })).toBeInTheDocument();
  });

  test('sign out calls logout', async () => {
    const logout = vi.fn();
    asUser(viewer, { logout });
    renderRoutes('/');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalled();
  });
});

describe('LoginPage', () => {
  const renderLogin = () =>
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Home</p>} />
        </Routes>
      </MemoryRouter>,
    );

  test('demo buttons fill the form and submit logs in', async () => {
    const login = vi.fn().mockResolvedValue(analyst);
    asUser(null, { login });
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: 'Analyst demo' }));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(login).toHaveBeenCalledWith('analyst@example.com', 'Analyst123!');
    expect(await screen.findByText('Home')).toBeInTheDocument();
  });

  test('shows the API error message', async () => {
    const login = vi.fn().mockRejectedValue({
      response: { data: { error: { message: 'Invalid email or password' } } },
    });
    asUser(null, { login });
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});
