import Link from "next/link";

const TABS = [
  { href: "/admin/rsvps", label: "RSVPs" },
  { href: "/admin/photos", label: "Photos" },
  { href: "/admin/trivia", label: "Trivia" },
];

export default function AdminNav({ active }: { active: "rsvps" | "photos" | "trivia" }) {
  return (
    <nav className="mb-6 flex justify-center gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
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
