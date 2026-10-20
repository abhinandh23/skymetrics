import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { kpiApi } from '../api/endpoints.js';
import { resetFilterOptionsCache } from '../hooks/useFilterOptions.js';
import { OverviewPage } from '../pages/OverviewPage.jsx';

vi.mock('../api/endpoints.js', () => ({ kpiApi: { overview: vi.fn(), filters: vi.fn() } }));

const summary = {
  flights: 1_850_000,
  completed: 1_800_000,
  cancelled: 25_000,
  onTimePct: 78.456,
  avgArrDelay: 9.87,
  cancelPct: 1.351,
  divertPct: 0.2,
};

beforeEach(() => {
  resetFilterOptionsCache();
  kpiApi.filters.mockResolvedValue({ months: ['2026-06'], airlines: [], airports: [] });
});

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <OverviewPage />
    </MemoryRouter>,
  );

describe('OverviewPage', () => {
  test('requests the overview with URL filters and shows KPI cards', async () => {
    kpiApi.overview.mockResolvedValue({
      summary,
      monthly: [{ month: '2026-06', ...summary }],
      daily: [],
      lastRun: { months: ['2026-06'], rowsAfterCleaning: 607577 },
    });
    renderAt('/?month=2026-06&airline=DL');
    const card = await screen.findByRole('region', { name: 'On-time arrivals' });
    expect(kpiApi.overview).toHaveBeenCalledWith(
      { month: '2026-06', airline: 'DL' },
      expect.anything(),
    );
    expect(within(card).getByText('78.5%')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cancelled' })).toHaveTextContent('1.35%');
    expect(screen.getByText(/607,577 flight records processed/)).toBeInTheDocument();
  });

  test('shows an empty state and errors', async () => {
    kpiApi.overview.mockResolvedValueOnce({ summary: null, monthly: [], daily: [], lastRun: null });
    renderAt('/');
    expect(await screen.findByText('No data for the selected filters.')).toBeInTheDocument();
  });

  test('shows API errors', async () => {
    kpiApi.overview.mockRejectedValueOnce({
      response: { data: { error: { message: 'Database unavailable' } } },
    });
    renderAt('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
  });
});
