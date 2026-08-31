import { insforge } from "./insforge";

let signingIn: Promise<void> | null = null;

/**
 * Insforge blocks storage writes for the public anon key entirely — only a
 * real signed-in user can upload. Guests never see a login, so the app
 * signs in as one shared, hidden account behind the scenes before any
 * upload. This has no bearing on guest identity, which stays purely in
 * localStorage (see identity.ts).
 */
export async function ensureUploadSession(): Promise<void> {
  const { data } = await insforge.auth.getCurrentUser();
  if (data?.user) return;

  if (!signingIn) {
    signingIn = insforge.auth
      .signInWithPassword({
        email: process.env.NEXT_PUBLIC_UPLOAD_ACCOUNT_EMAIL!,
        password: process.env.NEXT_PUBLIC_UPLOAD_ACCOUNT_PASSWORD!,
      })
      .then(({ error }) => {
        if (error) throw error;
      })
      .finally(() => {
        signingIn = null;
      });
  }

  await signingIn;
}
