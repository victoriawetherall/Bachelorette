const STORAGE_KEY = "bacparty:admin";

export function isAdminUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

export function unlockAdmin() {
  window.localStorage.setItem(STORAGE_KEY, "true");
}
