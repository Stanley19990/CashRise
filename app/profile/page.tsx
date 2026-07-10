"use client"

import Link from "next/link"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Award, BarChart3, ClipboardList, Gift, LogOut, ReceiptText, Settings, Star, UserRound, Users } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { FloatingParticles } from "@/components/floating-particles"
import { Button } from "@/components/ui/button"

const links = [
  { href: "/profile/edit", label: "Edit Profile", icon: Settings },
  { href: "/referrals", label: "Referrals", icon: Users },
  { href: "/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/missions", label: "Missions", icon: ClipboardList },
  { href: "/achievements", label: "Achievements", icon: Award },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/reviews", label: "Reviews", icon: Star }
]

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push("/")
  }, [loading, router, user])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-400" />
      </div>
    )
  }

  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "CashRise user"

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="cr-backdrop cr-grid" />
      <FloatingParticles />
      <div className="relative z-10">
        <DashboardHeader />
        <main className="container mx-auto max-w-md px-4 py-6 space-y-5">
          <section className="cr-glass rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-200">
                <UserRound className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-white">{displayName}</h1>
                <p className="truncate text-sm text-slate-400">{user.email}</p>
              </div>
            </div>
          </section>

          <section className="grid gap-3">
            {links.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="cr-glass flex min-h-14 items-center justify-between rounded-xl px-4 text-slate-100 transition hover:border-cyan-400/40"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-cyan-200" />
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </section>

          <Button
            variant="outline"
            className="w-full border-red-400/30 text-red-300 hover:bg-red-500/10"
            onClick={async () => {
              await signOut()
              router.push("/")
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </main>
      </div>
    </div>
  )
}
