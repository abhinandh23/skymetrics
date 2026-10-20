import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { kpiApi } from '../api/endpoints.js';
import { FilterBar } from '../components/FilterBar.jsx';
import { resetFilterOptionsCache } from '../hooks/useFilterOptions.js';

vi.mock('../api/endpoints.js', () => ({ kpiApi: { filters: vi.fn() } }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="search">{location.search}</output>;
}

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <FilterBar />
      <LocationProbe />
    </MemoryRouter>,
  );

beforeEach(() => {
  resetFilterOptionsCache();
  kpiApi.filters.mockResolvedValue({
    months: ['2026-06', '2026-07'],
    airlines: [
      { code: 'AA', name: 'American Airlines' },
      { code: 'DL', name: 'Delta Air Lines' },
    ],
    airports: [],
  });
});

describe('FilterBar', () => {
  test('reads its initial state from the URL', async () => {
    renderAt('/airlines?month=2026-07&airline=DL');
    await screen.findByRole('option', { name: 'Jul 2026' });
    expect(screen.getByLabelText('Month')).toHaveValue('2026-07');
    expect(screen.getByLabelText('Airline')).toHaveValue('DL');
  });

  test('writes changes back to the URL and resets the page', async () => {
    const user = userEvent.setup();
    renderAt('/routes?page=3&sort=-flights');
    await screen.findByRole('option', { name: 'Jun 2026' });
    await user.selectOptions(screen.getByLabelText('Month'), '2026-06');
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe('?sort=-flights&month=2026-06'),
    );
    await user.selectOptions(screen.getByLabelText('Airline'), 'AA');
    expect(screen.getByTestId('search').textContent).toContain('airline=AA');
  });

  test('clear removes both filters', async () => {
    const user = userEvent.setup();
    renderAt('/?month=2026-06&airline=AA');
    await screen.findByRole('option', { name: 'Jun 2026' });
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByTestId('search').textContent).toBe('');
  });
});
