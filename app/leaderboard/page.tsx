"use client"

import { useEffect, useState } from "react"
import { AppScreen } from "@/components/app-screen"
import { supabase } from "@/lib/supabase"
import { getSeededLeaderboardEntries } from "@/lib/leaderboard-seeds"
import { toNumber } from "@/lib/safe-data"
import { useCurrency } from "@/contexts/CurrencyContext"

export default function LeaderboardPage() {
  const { formatMoney } = useCurrency()
  const [leaders, setLeaders] = useState<any[]>([])

  useEffect(() => {
    supabase
      .from("users")
      .select("id, username, full_name, total_earned, machines_owned")
      .order("total_earned", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        const seededLeaders = getSeededLeaderboardEntries()
        if (error) {
          console.error("Leaderboard load error:", error)
          setLeaders(seededLeaders)
          return
        }
        const realLeaders = (data || []).map((leader) => ({
          ...leader,
          total_earned: toNumber(leader.total_earned),
          machines_owned: toNumber(leader.machines_owned),
          seeded: false
        }))
        setLeaders([...seededLeaders, ...realLeaders]
          .sort((a, b) => toNumber(b.total_earned) - toNumber(a.total_earned))
          .slice(0, 100))
      })
  }, [])

  return (
    <AppScreen title="All-Time Winners" description="Top CashRise earners ranked by lifetime earnings.">
      <section className="cr-glass rounded-2xl p-4">
        {leaders.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No leaderboard data yet.</p>
        ) : (
          <div className="space-y-2">
            {leaders.map((leader, index) => (
              <div key={leader.id} className="flex min-h-12 items-center justify-between rounded-xl bg-slate-900/50 px-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    #{index + 1} {leader.username || leader.full_name || "CashRise user"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {leader.seeded ? "All-time top earner" : `${toNumber(leader.machines_owned)} machines`}
                  </p>
                </div>
                <p className="text-sm font-bold text-emerald-300">{formatMoney(toNumber(leader.total_earned))}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppScreen>
  )
}
