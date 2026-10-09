export default function TeamsStatus({
  loading,
  error,
  empty,
  retry,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  retry: () => void;
}) {
  if (loading) {
    return <p role="status" className="py-10 text-center text-sm text-gray-500">Finding your quiz crew…</p>;
  }

  if (error) {
    return (
      <div role="alert" className="space-y-3 rounded-2xl border border-red-200 bg-white p-5 text-center">
        <p className="text-sm text-red-800">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
        >
          Try again
        </button>
      </div>
    );
  }

  if (empty) {
    return (
      <p className="rounded-2xl border border-rose-200 bg-white p-6 text-center text-sm text-gray-600">
        The team draw is on its way. Check back soon!
      </p>
    );
  }

  return null;
}
