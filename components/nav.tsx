"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Flame, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Adventures", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/review", label: "Review", icon: Repeat },
];

export function Nav() {
  const path = usePathname();
  if (path.startsWith("/adventure/")) return null; // the adventure screen has its own header
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
      <Link href="/" className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-primary" aria-hidden />
        <span className="font-display text-2xl font-semibold tracking-wide">StoryLingo</span>
      </Link>
      <nav className="flex items-center gap-1" aria-label="Main">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-muted text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
