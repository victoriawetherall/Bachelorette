import { createClient } from "@insforge/sdk";

export const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
});

export type Guest = {
  id: string;
  name: string;
  created_at: string;
};

export type Session = {
  id: string;
  label: string;
  active: boolean;
  sort_order: number;
};

export type PaymentStatus = "unpaid" | "paid";

export type Rsvp = {
  id: string;
  guest_id: string;
  dietary_vegetarian: boolean;
  dietary_vegan: boolean;
  dietary_gluten_free: boolean;
  dietary_other: boolean;
  dietary_notes: string | null;
  drinks_alcohol: boolean;
  payment_status: PaymentStatus;
  submitted_at: string;
  rsvp_sessions?: { session_id: string }[];
};

export type PhotoCategory = "pre_weekend" | "weekend";

export type Photo = {
  id: string;
  guest_id: string;
  category: PhotoCategory;
  storage_path: string;
  uploaded_at: string;
  guests?: { name: string } | null;
};

export function photoUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_INSFORGE_BASE_URL}/api/storage/buckets/photos/objects/${encodeURIComponent(
    storagePath
  )}`;
}

export const ZIP_WEEKEND_PHOTOS_URL = `${process.env.NEXT_PUBLIC_INSFORGE_BASE_URL}/functions/zip-weekend-photos`;
