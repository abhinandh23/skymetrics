import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { kpiApi } from '../api/endpoints.js';
import { resetFilterOptionsCache } from '../hooks/useFilterOptions.js';
import { AirlinesPage } from '../pages/AirlinesPage.jsx';
import { AirportsPage } from '../pages/AirportsPage.jsx';
import { DelayCausesPage } from '../pages/DelayCausesPage.jsx';
import { RoutesPage } from '../pages/RoutesPage.jsx';

vi.mock('../api/endpoints.js', () => ({
  kpiApi: {
    filters: vi.fn(),
    carriers: vi.fn(),
    airports: vi.fn(),
    routes: vi.fn(),
    delayCauses: vi.fn(),
  },
}));

function LocationProbe() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const renderAt = (ui, url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      {ui}
      <LocationProbe />
    </MemoryRouter>,
  );

const page = (data) => ({ data, page: 1, limit: 25, total: data.length, totalPages: 2 });

beforeEach(() => {
  vi.clearAllMocks();
  resetFilterOptionsCache();
  kpiApi.filters.mockResolvedValue({
    months: ['2026-06', '2026-07'],
    airlines: [{ code: 'DL', name: 'Delta Air Lines' }],
    airports: ['ATL'],
  });
});

describe('AirlinesPage', () => {
  const row = (month, airline, airlineName, flights, onTimePct) => ({
    month,
    airline,
    airlineName,
    flights,
    completed: flights,
    cancelled: 0,
    diverted: 0,
    onTimePct,
    avgArrDelay: 5,
    avgDepDelay: 6,
  });

  test('rolls months up per airline and highlights the selected airline', async () => {
    kpiApi.carriers.mockResolvedValue(
      page([
        row('2026-06', 'DL', 'Delta Air Lines', 100, 80),
        row('2026-07', 'DL', 'Delta Air Lines', 300, 90),
        row('2026-06', 'AA', 'American Airlines', 100, 70),
      ]),
    );
    renderAt(<AirlinesPage />, '/airlines?airline=DL');
    const cell = await screen.findByRole('cell', { name: 'Delta Air Lines (DL)' });
    const tr = cell.closest('tr');
    expect(within(tr).getByText('87.5%')).toBeInTheDocument(); // (80*100 + 90*300) / 400
    expect(tr).toHaveClass('bg-accent/10');
    expect(kpiApi.carriers).toHaveBeenCalledWith({ month: '', limit: 100 }, expect.anything());
  });

  test('switches the chart metric', async () => {
    kpiApi.carriers.mockResolvedValue(page([row('2026-06', 'DL', 'Delta Air Lines', 100, 80)]));
    renderAt(<AirlinesPage />, '/airlines');
    await screen.findByText('On-time % by airline');
    await userEvent.click(screen.getByRole('radio', { name: 'Cancelled %' }));
    expect(screen.getByText('Cancelled % by airline')).toBeInTheDocument();
    expect(screen.getByText('Lower is better')).toBeInTheDocument();
  });
});

describe('AirportsPage', () => {
  test('defaults to the latest month and sorts on the server', async () => {
    kpiApi.airports.mockResolvedValue(
      page([{ airport: 'ATL', flights: 30000, onTimeDepPct: 80, avgDepDelay: 10, cancelPct: 1 }]),
    );
    renderAt(<AirportsPage />, '/airports');
    await screen.findByRole('cell', { name: 'ATL' });
    expect(kpiApi.airports).toHaveBeenLastCalledWith(
      { month: '2026-07', sort: '-flights', page: 1, limit: 20, minFlights: '1000' },
      expect.anything(),
    );
    expect(screen.getByLabelText('Month')).toHaveValue('2026-07');
    await userEvent.click(screen.getByRole('button', { name: /avg dep\. delay/i }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?sort=avgDepDelay'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('search').textContent).toBe('?sort=avgDepDelay&page=2');
  });
});

describe('RoutesPage', () => {
  test('filters by airport and minimum flights', async () => {
    kpiApi.routes.mockResolvedValue(
      page([
        {
          route: 'JFK-LAX',
          flights: 300,
          onTimePct: 70,
          avgArrDelay: 25,
          cancelPct: 2,
          distance: 2475,
        },
      ]),
    );
    const user = userEvent.setup();
    renderAt(<RoutesPage />, '/routes?month=2026-06');
    await screen.findByRole('cell', { name: 'JFK-LAX' });
    expect(screen.getByRole('cell', { name: '2,475 mi' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Airport'), 'jfk');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await user.selectOptions(screen.getByLabelText('Min. flights'), '500');
    await waitFor(() =>
      expect(kpiApi.routes).toHaveBeenLastCalledWith(
        {
          month: '2026-06',
          sort: '-avgArrDelay',
          page: 1,
          limit: 25,
          airport: 'JFK',
          minFlights: '500',
        },
        expect.anything(),
      ),
    );
  });
});

describe('DelayCausesPage', () => {
  test('shows cause shares and toggles between minutes and share', async () => {
    kpiApi.delayCauses.mockResolvedValue({
      data: [
        {
          month: '2026-06',
          airline: 'DL',
          airlineName: 'Delta Air Lines',
          flights: 10,
          carrierMin: 60,
          lateAircraftMin: 20,
          nasMin: 10,
          weatherMin: 10,
          securityMin: 0,
          totalDelayMin: 100,
        },
      ],
    });
    renderAt(<DelayCausesPage />, '/delay-causes?airline=DL');
    const carrier = await screen.findByRole('region', { name: 'Carrier' });
    expect(within(carrier).getByText('60.0%')).toBeInTheDocument();
    expect(kpiApi.delayCauses).toHaveBeenCalledWith(
      { month: '', airline: 'DL' },
      expect.anything(),
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Share %' }));
    expect(screen.getByRole('radio', { name: 'Share %' })).toHaveAttribute('aria-checked', 'true');
  });
});
