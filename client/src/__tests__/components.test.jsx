import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { DataTable } from '../components/DataTable.jsx';
import { KpiCard } from '../components/KpiCard.jsx';

describe('KpiCard', () => {
  test('renders label, value and hint', () => {
    render(<KpiCard label="On-time arrivals" value="81.2%" hint="Arrived < 15 min late" />);
    const card = screen.getByRole('region', { name: 'On-time arrivals' });
    expect(within(card).getByText('81.2%')).toBeInTheDocument();
    expect(within(card).getByText('Arrived < 15 min late')).toBeInTheDocument();
  });
});

describe('DataTable', () => {
  const rows = [
    { route: 'B-C', delay: 5 },
    { route: 'A-B', delay: 25 },
    { route: 'C-D', delay: null },
  ];
  const firstColumn = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getAllByRole('cell')[0].textContent);

  test('infers columns and formats missing values', () => {
    render(<DataTable rows={rows} />);
    expect(screen.getByRole('columnheader', { name: /route/i })).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('sorts client-side, toggling direction and keeping nulls last', async () => {
    const user = userEvent.setup();
    render(<DataTable rows={rows} />);
    const header = screen.getByRole('button', { name: /delay/i });
    await user.click(header);
    expect(firstColumn()).toEqual(['B-C', 'A-B', 'C-D']);
    expect(screen.getByRole('columnheader', { name: /delay/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(header);
    expect(firstColumn()).toEqual(['A-B', 'B-C', 'C-D']);
    await user.click(screen.getByRole('button', { name: /route/i }));
    expect(firstColumn()).toEqual(['A-B', 'B-C', 'C-D']);
  });

  test('delegates sorting to the server when onSort is provided', async () => {
    const calls = [];
    render(<DataTable rows={rows} sort="-delay" onSort={(s) => calls.push(s)} />);
    expect(firstColumn()).toEqual(['B-C', 'A-B', 'C-D']); // order untouched
    await userEvent.click(screen.getByRole('button', { name: /delay/i }));
    expect(calls).toEqual(['delay']);
  });

  test('renders nothing without rows', () => {
    const { container } = render(<DataTable rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
