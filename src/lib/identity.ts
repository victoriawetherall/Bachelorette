const STORAGE_KEY = "bacparty:guest";

export type GuestIdentity = {
  id: string;
  name: string;
};

export function getStoredGuest(): GuestIdentity | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as GuestIdentity;
  } catch {
    return null;
  }
}

export function setStoredGuest(guest: GuestIdentity) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(guest));
}

export function clearStoredGuest() {
  window.localStorage.removeItem(STORAGE_KEY);
}
