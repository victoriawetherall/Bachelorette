"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useGuest } from "@/lib/useGuest";
import {
  insforge,
  photoUrl,
  ZIP_WEEKEND_PHOTOS_URL,
  type Photo,
} from "@/lib/insforge";
import { resizeImage } from "@/lib/imageResize";
import { ensureUploadSession } from "@/lib/uploadAuth";

function sanitizeName(name: string): string {
  return name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .slice(0, 40);
}

export default function PhotosPage() {
  const guest = useGuest();

  const [weekendPhotos, setWeekendPhotos] = useState<Photo[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  const [throwbackPreviews, setThrowbackPreviews] = useState<string[]>([]);

  const [uploadingThrowbacks, setUploadingThrowbacks] = useState(false);
  const [uploadingWeekend, setUploadingWeekend] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    loadGallery();
  }, []);

  async function loadGallery() {
    setGalleryLoading(true);
    setGalleryError(null);

    const { data, error } = await insforge.database
      .from("photos")
      .select("*, guests(name)")
      .eq("category", "weekend")
      .order("uploaded_at", { ascending: false });

    if (error) {
      setGalleryError(error.message);
      setGalleryLoading(false);
      return;
    }

    setWeekendPhotos((data as Photo[]) ?? []);
    setGalleryLoading(false);
  }

  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>,
    category: "pre_weekend" | "weekend"
  ) {
    const files = event.target.files;
    if (!files || files.length === 0 || !guest) return;

    const setUploading =
      category === "pre_weekend" ? setUploadingThrowbacks : setUploadingWeekend;

    setUploading(true);
    setUploadError(null);

    try {
      await ensureUploadSession();
    } catch {
      setUploadError("Couldn't connect to upload photos right now. Try again in a moment.");
      setUploading(false);
      return;
    }

    for (const file of Array.from(files)) {
      const resized = await resizeImage(file);
      const path = `${category}/${guest.id}-${Date.now()}-${sanitizeName(
        file.name
      )}.jpg`;

      const { error: uploadErr } = await insforge.storage
        .from("photos")
        .upload(path, resized);

      if (uploadErr) {
        setUploadError(uploadErr.message);
        continue;
      }

      const { error: insertErr } = await insforge.database
        .from("photos")
        .insert({ guest_id: guest.id, category, storage_path: path });

      if (insertErr) {
        setUploadError(insertErr.message);
        continue;
      }

      if (category === "pre_weekend") {
        setThrowbackPreviews((prev) => [URL.createObjectURL(resized), ...prev]);
      }
    }

    setUploading(false);
    event.target.value = "";

    if (category === "weekend") {
      void loadGallery();
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-8 px-4 py-8">
      <header className="space-y-1 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">
          Photos
        </p>
        <h1 className="text-2xl font-bold text-rose-700">
          {guest ? `Say cheese, ${guest.name} 📸` : "Photos"}
        </h1>
      </header>

      {uploadError && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {uploadError}
        </p>
      )}

      <section className="space-y-3 rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">
            Throwback photos 🕰️
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Got an old photo of Liv? Send it our way — we&rsquo;re putting
            together something fun for the weekend. Only the organizers can
            see these.
          </p>
        </div>
        <label className="block w-full cursor-pointer rounded-xl border border-dashed border-rose-300 px-3 py-3 text-center text-sm font-medium text-rose-600">
          {uploadingThrowbacks ? "Uploading…" : "Choose photos"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploadingThrowbacks}
            onChange={(event) => handleUpload(event, "pre_weekend")}
          />
        </label>
        {throwbackPreviews.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {throwbackPreviews.map((src, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={index}
                src={src}
                alt="Uploaded throwback"
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">
            Weekend photos 🎉
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Snapping pics all weekend? Drop them here so everyone leaves with
            a copy.
          </p>
        </div>
        <label className="block w-full cursor-pointer rounded-xl border border-dashed border-rose-300 px-3 py-3 text-center text-sm font-medium text-rose-600">
          {uploadingWeekend ? "Uploading…" : "Choose photos"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploadingWeekend}
            onChange={(event) => handleUpload(event, "weekend")}
          />
        </label>

        {weekendPhotos.length > 0 && (
          <a
            href={ZIP_WEEKEND_PHOTOS_URL}
            className="block w-full rounded-xl bg-rose-500 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            Download all as ZIP
          </a>
        )}

        {galleryLoading && (
          <p className="text-sm text-gray-400">Loading gallery…</p>
        )}
        {galleryError && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            {galleryError}
          </p>
        )}
        {!galleryLoading && weekendPhotos.length === 0 && (
          <p className="text-sm text-gray-400">No photos yet — be the first!</p>
        )}

        {weekendPhotos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {weekendPhotos.map((photo) => (
              <a
                key={photo.id}
                href={photoUrl(photo.storage_path)}
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-square overflow-hidden rounded-lg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(photo.storage_path)}
                  alt={`Photo by ${photo.guests?.name ?? "a guest"}`}
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
