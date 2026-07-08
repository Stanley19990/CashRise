"use client"

import { CheckCircle2, Circle } from "lucide-react"
import { AppScreen } from "@/components/app-screen"

const missions = [
  "Claim earnings from any machine",
  "Purchase any machine",
  "Share your referral link",
  "Visit the app today",
  "Keep 3 or more machines running"
]

export default function MissionsPage() {
  return (
    <AppScreen title="Daily Missions" description="Mission rewards will be tracked through completed wallet transactions.">
      <section className="cr-glass rounded-2xl p-5">
        <div className="space-y-3">
          {missions.map((mission, index) => {
            const Icon = index === 3 ? CheckCircle2 : Circle
            return (
              <div key={mission} className="flex min-h-12 items-center justify-between rounded-xl bg-slate-900/50 px-3">
                <span className="text-sm text-slate-100">{mission}</span>
                <Icon className={`h-5 w-5 ${index === 3 ? "text-emerald-300" : "text-slate-500"}`} />
              </div>
            )
          })}
        </div>
      </section>
    </AppScreen>
  )
}
