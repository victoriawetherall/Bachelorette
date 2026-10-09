"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStoredGuest } from "@/lib/identity";
import BottomNav from "@/components/BottomNav";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredGuest()) {
      router.replace(`/?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setReady(true);
  }, [router, pathname]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </main>
    );
  }

  return (
    <div className="pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
