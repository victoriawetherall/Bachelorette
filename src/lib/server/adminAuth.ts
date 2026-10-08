import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { TriviaError } from "@/lib/trivia/server";

export const ADMIN_COOKIE = "bacparty-organiser";

export function adminToken(expires = Date.now() + 12 * 60 * 60 * 1000) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password)
    throw new TriviaError("The organiser password isn't configured.", 503);
  return `${expires}.${createHmac("sha256", password).update(`organiser:${expires}`).digest("hex")}`;
}

export async function requireAdmin() {
  const supplied = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  const expires = Number(supplied.split(".")[0]);
  if (!Number.isSafeInteger(expires) || expires <= Date.now())
    throw new TriviaError("Please unlock the organiser view.", 401);
  const expected = adminToken(expires);
  if (
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    throw new TriviaError("Please unlock the organiser view.", 401);
}
