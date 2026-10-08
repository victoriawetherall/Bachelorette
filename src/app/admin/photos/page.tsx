"use client";

import { FormEvent, useEffect, useState } from "react";
import { photoUrl, type Photo } from "@/lib/insforge";
import { isAdminUnlocked, unlockAdmin } from "@/lib/adminAuth";
import AdminNav from "@/components/AdminNav";

export default function AdminPhotosPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void isAdminUnlocked().then(setUnlocked);
  }, []);

  useEffect(() => {
    if (!unlocked) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/admin/photos", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Couldn't load photos.");
        setPhotos(data.photos ?? []);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Couldn't load photos.",
        );
      }
      setLoading(false);
    }

    void load();
  }, [unlocked]);

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await unlockAdmin(passwordInput);
      setPasswordInput("");
      setUnlocked(true);
      setAuthError(null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Couldn't unlock.");
    }
  }

  if (!unlocked) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
        <h1 className="text-center text-2xl font-bold text-rose-700">
          Organiser login
        </h1>
        <form
          onSubmit={handleUnlock}
          className="space-y-4 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm"
        >
          <input
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            Unlock
          </button>
          {authError && (
            <p className="text-center text-sm text-red-600">{authError}</p>
          )}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <AdminNav active="photos" />
      <header className="mb-6 space-y-1 text-center">
        <h1 className="text-2xl font-bold text-rose-700">Throwback photos</h1>
        <p className="text-sm text-gray-500">
          {photos.length} photo{photos.length === 1 ? "" : "s"} submitted for
          the weekend
        </p>
      </header>

      {loading && <p className="text-center text-sm text-gray-400">Loading…</p>}
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {!loading && !error && photos.length === 0 && (
        <p className="text-center text-sm text-gray-400">
          No throwback photos yet.
        </p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(photo.storage_path)}
                alt={`Throwback from ${photo.guests?.name ?? "a guest"}`}
                className="aspect-square w-full rounded-lg object-cover"
              />
              <p className="truncate text-center text-xs text-gray-500">
                {photo.guests?.name ?? "Unknown"}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
