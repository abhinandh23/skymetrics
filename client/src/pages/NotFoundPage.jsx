import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-2 inline-block text-sm text-accent hover:underline">
        Back to the overview
      </Link>
    </div>
  );
}
