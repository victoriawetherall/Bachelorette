"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/info", label: "Info", emoji: "📍" },
  { href: "/rsvp", label: "RSVP", emoji: "💌" },
  { href: "/photos", label: "Photos", emoji: "📸" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-rose-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition ${
                  active ? "text-rose-600" : "text-gray-400 hover:text-rose-400"
                }`}
              >
                <span className="text-lg">{tab.emoji}</span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
