import Link from "next/link";

const TABS = [
  { href: "/admin/rsvps", label: "RSVPs" },
  { href: "/admin/photos", label: "Photos" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/control", label: "Quiz" },
];

export default function AdminNav({ active }: { active: "rsvps" | "photos" | "teams" | "trivia" }) {
  return (
    <nav className="mb-6 flex justify-center gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === `/admin/${active}` ? "page" : undefined}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            tab.href === `/admin/${active}`
              ? "bg-rose-500 text-white"
              : "border border-rose-200 text-gray-600 hover:border-rose-300"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
