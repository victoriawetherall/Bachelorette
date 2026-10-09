export async function isAdminUnlocked(): Promise<boolean> {
  try {
    return (await fetch("/api/admin/auth", { cache: "no-store" })).ok;
  } catch {
    return false;
  }
}

export async function unlockAdmin(password: string) {
  const response = await fetch("/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error ?? "Couldn't unlock the organiser view.");
  }
}
