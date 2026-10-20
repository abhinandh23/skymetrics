import { useState } from 'react';
import { errorMessage } from '../api/client.js';
import { askApi } from '../api/endpoints.js';
import { Card } from '../components/Card.jsx';
import { ResultChart } from '../components/charts/ResultChart.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { PageHeader } from '../components/Layout.jsx';
import { Empty, ErrorMessage, Loading } from '../components/States.jsx';
import { EXAMPLE_QUESTIONS } from '../lib/examples.js';

export function AskPage() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (q = question) => {
    const text = q.trim();
    if (text.length < 5 || loading) return;
    setQuestion(text);
    setLoading(true);
    setError(null);
    try {
      setResult(await askApi.ask(text));
    } catch (err) {
      setResult(null);
      setError({ message: errorMessage(err), details: err?.response?.data?.error?.details });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Ask your data"
        description="Ask a question in plain English. It is translated into a MongoDB query, checked by a safety validator and run read-only."
      />
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="question" className="text-sm font-medium">
            Your question
          </label>
          <textarea
            id="question"
            rows={3}
            maxLength={500}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder="e.g. Which 5 routes had the worst average arrival delay in July 2026?"
            className="mt-2 w-full resize-y rounded-lg border border-line bg-surface p-3 text-sm focus:outline-2 focus:outline-accent"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-ink-muted">
              {question.length}/500 · Ctrl+Enter to submit
            </span>
            <button
              type="submit"
              disabled={loading || question.trim().length < 5}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
            >
              {loading ? 'Thinking…' : 'Ask'}
            </button>
          </div>
        </form>
        <div className="mt-4">
          <p className="text-xs text-ink-muted">Try an example</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => submit(q)}
                  className="rounded-full border border-line px-3 py-1 text-left text-xs text-ink-2 hover:bg-surface-2 disabled:opacity-50"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="mt-6 space-y-4" aria-live="polite">
        {loading && <Loading label="Generating and validating a query" />}
        {error && (
          <ErrorMessage message={error.message}>
            {error.details?.errors?.length > 0 && (
              <details className="mt-2 text-ink-2">
                <summary className="cursor-pointer">Validator details</summary>
                <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                  {error.details.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </ErrorMessage>
        )}
        {result && !loading && <AskResult result={result} />}
      </div>
    </>
  );
}

function AskResult({ result }) {
  return (
    <>
      <Card
        title="Answer"
        subtitle={`${result.rowCount} row${result.rowCount === 1 ? '' : 's'} from ${result.collection} · ${result.durationMs} ms${result.attempts > 1 ? ' · corrected after validation' : ''}`}
      >
        {result.explanation && <p className="mb-4 text-sm text-ink-2">{result.explanation}</p>}
        {result.rows.length === 0 ? (
          <Empty message="The query ran but returned no rows." />
        ) : (
          <ResultChart
            rows={result.rows}
            chartType={result.chartType}
            xField={result.xField}
            yFields={result.yFields}
          />
        )}
      </Card>
      {result.rows.length > 0 && (
        <Card title="Result table">
          <DataTable rows={result.rows} caption="Query result" />
        </Card>
      )}
      <details className="rounded-xl border border-line bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Generated pipeline ({result.pipeline.length} stages)
        </summary>
        <pre
          className="mt-3 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs"
          data-testid="pipeline-json"
        >
          {`db.${result.collection}.aggregate(${JSON.stringify(result.pipeline, null, 2)})`}
        </pre>
      </details>
    </>
  );
}
