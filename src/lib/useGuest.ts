"use client";

import { useEffect, useState } from "react";
import { getStoredGuest, type GuestIdentity } from "./identity";

export function useGuest(): GuestIdentity | null {
  const [guest, setGuest] = useState<GuestIdentity | null>(null);

  useEffect(() => {
    setGuest(getStoredGuest());
  }, []);

  return guest;
}
