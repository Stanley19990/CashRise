"use client"

import { useEffect, useState } from "react"
import { Star } from "lucide-react"
import { AppScreen } from "@/components/app-screen"
import { supabase } from "@/lib/supabase"
import { formatDate, toNumber } from "@/lib/safe-data"
import { useCurrency } from "@/contexts/CurrencyContext"

export default function ReviewsPage() {
  const { formatMoney } = useCurrency()
  const [withdrawals, setWithdrawals] = useState<any[]>([])

  useEffect(() => {
    supabase
      .from("withdrawals")
      .select("id, amount, processed_at, requested_at, users(username, full_name)")
      .in("status", ["approved", "completed"])
      .order("processed_at", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (error) {
          console.error("Reviews load error:", error)
          setWithdrawals([])
          return
        }
        setWithdrawals(data || [])
      })
  }, [])

  return (
    <AppScreen title="Reviews" description="Verified withdrawal activity from existing withdrawal records.">
      <section className="cr-glass rounded-2xl p-4">
        {withdrawals.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No verified withdrawals to show yet.</p>
        ) : (
          <div className="space-y-3">
            {withdrawals.map((item) => {
              const user = Array.isArray(item.users) ? item.users[0] : item.users
              return (
                <div key={item.id} className="rounded-xl bg-slate-900/50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold text-white">{user?.username || user?.full_name || "Verified user"}</p>
                    <div className="flex text-amber-300">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star key={index} className="h-3.5 w-3.5 fill-current" />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-300">Withdrew {formatMoney(toNumber(item.amount))} successfully.</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(item.processed_at || item.requested_at)}</p>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </AppScreen>
  )
}
