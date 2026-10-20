import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { ProtectedRoute } from './auth/ProtectedRoute.jsx';
import { Layout } from './components/Layout.jsx';
import { Loading } from './components/States.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

// Chart-heavy pages are split into their own chunks so the login screen loads fast.
const named = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })));
const OverviewPage = named(() => import('./pages/OverviewPage.jsx'), 'OverviewPage');
const AirlinesPage = named(() => import('./pages/AirlinesPage.jsx'), 'AirlinesPage');
const AirportsPage = named(() => import('./pages/AirportsPage.jsx'), 'AirportsPage');
const RoutesPage = named(() => import('./pages/RoutesPage.jsx'), 'RoutesPage');
const DelayCausesPage = named(() => import('./pages/DelayCausesPage.jsx'), 'DelayCausesPage');
const AskPage = named(() => import('./pages/AskPage.jsx'), 'AskPage');

const page = (Component) => (
  <Suspense fallback={<Loading />}>
    <Component />
  </Suspense>
);

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={page(OverviewPage)} />
          <Route path="airlines" element={page(AirlinesPage)} />
          <Route path="airports" element={page(AirportsPage)} />
          <Route path="routes" element={page(RoutesPage)} />
          <Route path="delay-causes" element={page(DelayCausesPage)} />
          <Route
            path="ask"
            element={<ProtectedRoute role="analyst">{page(AskPage)}</ProtectedRoute>}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
