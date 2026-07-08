"use client"

import { Gift, RotateCcw, Flame } from "lucide-react"
import { AppScreen } from "@/components/app-screen"

export default function RewardsPage() {
  return (
    <AppScreen
      title="Rewards"
      description="Daily streaks, spin rewards, and bonus activities will use your existing transaction history."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Daily Streak", body: "Claim machine earnings daily to build your streak.", icon: Flame },
          { title: "Lucky Spin", body: "Spin rewards will be credited through wallet transactions.", icon: RotateCcw },
          { title: "Bonus Wallet", body: "Rewards appear in your wallet history after they are claimed.", icon: Gift }
        ].map((item) => {
          const Icon = item.icon
          return (
            <section key={item.title} className="cr-glass rounded-2xl p-5">
              <Icon className="mb-3 h-6 w-6 text-cyan-200" />
              <h2 className="text-base font-bold text-white">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{item.body}</p>
            </section>
          )
        })}
      </div>
    </AppScreen>
  )
}
