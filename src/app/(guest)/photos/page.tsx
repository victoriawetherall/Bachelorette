"use client";

import { useGuest } from "@/lib/useGuest";

export default function PhotosPage() {
  const guest = useGuest();

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      <p className="text-5xl">📸</p>
      <h1 className="text-2xl font-bold text-rose-700">
        {guest ? `Coming soon, ${guest.name}!` : "Coming soon!"}
      </h1>
      <p className="text-sm text-gray-600">
        Photo uploads and the gallery aren&rsquo;t live yet — check back
        soon.
      </p>
    </main>
  );
}
