export default function QuizConnection({ error, loading, refresh }: { error: string | null; loading: boolean; refresh: () => void }) {
  if (error) return <div role="alert" className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>{error} Reconnecting…</p><button type="button" onClick={refresh} className="font-semibold underline underline-offset-4">Try again now</button></div>;
  if (loading) return <p role="status" className="py-10 text-center text-sm text-gray-500">Joining the quiz…</p>;
  return null;
}
