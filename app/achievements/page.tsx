"use client"

import { Award, Lock } from "lucide-react"
import { AppScreen } from "@/components/app-screen"

const badges = [
  "First Steps",
  "First Deposit",
  "Machine Collector",
  "Steady Earner",
  "Inviter",
  "Lucky Player"
]

export default function AchievementsPage() {
  return (
    <AppScreen title="Achievements" description="Badges are being prepared to use existing transactions as proof.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {badges.map((badge, index) => (
          <section key={badge} className="cr-glass rounded-2xl p-4 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/70">
              {index < 2 ? <Award className="h-5 w-5 text-amber-300" /> : <Lock className="h-5 w-5 text-slate-500" />}
            </div>
            <h2 className="text-sm font-bold text-white">{badge}</h2>
            <p className="mt-1 text-xs text-slate-500">{index < 2 ? "Available" : "Locked"}</p>
          </section>
        ))}
      </div>
    </AppScreen>
  )
}
