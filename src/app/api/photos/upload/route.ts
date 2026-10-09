import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@insforge/sdk";
import {
  apiError,
  checkDb,
  requireGuest,
  sameOrigin,
  triviaQuery,
  TriviaError,
} from "@/lib/trivia/server";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const form = await request.formData();
    const guestId = await requireGuest(form.get("guest_id"));
    const category = form.get("category");
    const file = form.get("file");
    if (category !== "pre_weekend" && category !== "weekend")
      throw new TriviaError("Choose a photo category.");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 4 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      throw new TriviaError(
        "Choose a JPEG, PNG or WebP photo smaller than 4 MB.",
      );
    const email = process.env.UPLOAD_ACCOUNT_EMAIL;
    const password = process.env.UPLOAD_ACCOUNT_PASSWORD;
    if (!email || !password)
      throw new TriviaError("Photo uploads aren't configured yet.", 503);
    const sdk = createClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
      retryCount: 1,
    });
    const { error: authError } = await sdk.auth.signInWithPassword({
      email,
      password,
    });
    if (authError)
      throw new TriviaError(
        "Couldn't connect to photo uploads. Please try again.",
        503,
      );
    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    const path = `${category}/${guestId}-${randomUUID()}.${extension}`;
    const { error: uploadError } = await sdk.storage
      .from("photos")
      .upload(path, file);
    if (uploadError)
      throw new TriviaError(
        "Couldn't upload that photo. Please try again.",
        503,
      );
    const { data: created, error } = await triviaQuery(
      "INSERT INTO public.photos (guest_id,category,storage_path) VALUES ($1,$2,$3) RETURNING id",
      [guestId, category, path],
    );
    if (error) {
      await sdk.storage.from("photos").remove(path);
      checkDb(error);
    }
    return NextResponse.json({
      uploaded: true,
      photo_id: created?.[0]?.id,
      storage_path: path,
    });
  } catch (error) {
    return apiError(error);
  }
}
