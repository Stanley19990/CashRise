"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Cpu, Wallet, Gift, MoreHorizontal } from "lucide-react"

const tabs = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/machines", label: "Machines", icon: Cpu },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/profile", label: "More", icon: MoreHorizontal }
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      data-mobile-app-nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-cyan-400/15 bg-slate-950/88 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl md:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active =
            pathname === tab.href ||
            (tab.href === "/machines" && pathname.startsWith("/machines")) ||
            (tab.href === "/rewards" && (pathname.startsWith("/rewards") || pathname.startsWith("/missions"))) ||
            (tab.href === "/profile" &&
              ["/profile", "/referrals", "/transactions", "/achievements", "/leaderboard", "/reviews"].some((path) =>
                pathname.startsWith(path)
              ))

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-11 flex-col items-center justify-center rounded-lg text-[11px] font-medium transition ${
                active ? "bg-cyan-400/12 text-cyan-200" : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
              }`}
            >
              <Icon className="mb-0.5 h-5 w-5" aria-hidden="true" />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
