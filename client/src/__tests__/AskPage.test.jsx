import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { askApi } from '../api/endpoints.js';
import { EXAMPLE_QUESTIONS } from '../lib/examples.js';
import { AskPage } from '../pages/AskPage.jsx';

vi.mock('../api/endpoints.js', () => ({ askApi: { ask: vi.fn() } }));

const result = {
  question: 'Worst routes?',
  collection: 'route_monthly',
  pipeline: [{ $match: { month: '2026-07' } }, { $sort: { avgArrDelay: -1 } }, { $limit: 2 }],
  chartType: 'bar',
  xField: 'route',
  yFields: ['avgArrDelay'],
  explanation: 'Routes sorted by average arrival delay.',
  rows: [
    { route: 'JFK-LAX', avgArrDelay: 25.5 },
    { route: 'ATL-JFK', avgArrDelay: 5.25 },
  ],
  rowCount: 2,
  attempts: 1,
  durationMs: 812,
};

beforeEach(() => vi.clearAllMocks());

describe('AskPage', () => {
  test('submits a question and renders explanation, chart, table and pipeline', async () => {
    askApi.ask.mockResolvedValue(result);
    const user = userEvent.setup();
    render(<AskPage />);

    await user.type(screen.getByLabelText('Your question'), 'Worst routes?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(askApi.ask).toHaveBeenCalledWith('Worst routes?');
    expect(await screen.findByText('Routes sorted by average arrival delay.')).toBeInTheDocument();
    expect(screen.getByText(/2 rows from route_monthly/)).toBeInTheDocument();
    expect(screen.getByTestId('chart-bar')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'JFK-LAX' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '25.50' })).toBeInTheDocument();

    const pipeline = screen.getByTestId('pipeline-json');
    expect(pipeline).not.toBeVisible();
    await user.click(screen.getByText(/Generated pipeline \(3 stages\)/));
    expect(pipeline).toBeVisible();
    expect(pipeline).toHaveTextContent('db.route_monthly.aggregate');
    expect(pipeline).toHaveTextContent('"$sort"');
  });

  test('example questions submit directly', async () => {
    askApi.ask.mockResolvedValue({ ...result, rows: [], rowCount: 0 });
    render(<AskPage />);
    await userEvent.click(screen.getByRole('button', { name: EXAMPLE_QUESTIONS[0] }));
    expect(askApi.ask).toHaveBeenCalledWith(EXAMPLE_QUESTIONS[0]);
    expect(await screen.findByText('The query ran but returned no rows.')).toBeInTheDocument();
    expect(screen.getByLabelText('Your question')).toHaveValue(EXAMPLE_QUESTIONS[0]);
  });

  test('shows a loading state while waiting', async () => {
    let resolve;
    askApi.ask.mockReturnValue(new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<AskPage />);
    await user.type(screen.getByLabelText('Your question'), 'Worst routes?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByRole('status')).toHaveTextContent('Generating and validating a query');
    expect(screen.getByRole('button', { name: 'Thinking…' })).toBeDisabled();
    resolve(result);
    expect(await screen.findByText('Answer')).toBeInTheDocument();
  });

  test('shows validator errors from the API', async () => {
    askApi.ask.mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Could not build a safe query for this question. Try rephrasing it.',
            details: {
              reason: 'validation_failed',
              errors: ['pipeline[0]: stage $out is forbidden'],
            },
          },
        },
      },
    });
    const user = userEvent.setup();
    render(<AskPage />);
    await user.type(screen.getByLabelText('Your question'), 'Delete everything');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not build a safe query');
    await user.click(screen.getByText('Validator details'));
    expect(screen.getByText('pipeline[0]: stage $out is forbidden')).toBeVisible();
  });

  test('the Ask button stays disabled for very short questions', async () => {
    render(<AskPage />);
    await userEvent.type(screen.getByLabelText('Your question'), 'hi');
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
  });
});
