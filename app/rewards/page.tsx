"use client"

import { useEffect, useState } from "react"
import { Flame, Gift, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { AppScreen } from "@/components/app-screen"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useCurrency } from "@/contexts/CurrencyContext"

export default function RewardsPage() {
  const { formatMoney } = useCurrency()
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch("/api/rewards", {
        headers: {
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
        }
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load rewards")
      setStatus(result)
    } catch (error: any) {
      toast.error(error.message || "Unable to load rewards")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const runAction = async (action: "claim_daily" | "spin") => {
    setActionLoading(action)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch("/api/rewards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
        },
        body: JSON.stringify({ action })
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Reward action failed")
      toast.success(action === "spin" ? `${result.prize?.label || "Spin complete"}: ${formatMoney(Number(result.amount || 0))}` : result.message)
      await loadStatus()
    } catch (error: any) {
      toast.error(error.message || "Reward action failed")
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <AppScreen title="Rewards" description="Daily streaks, controlled spin rewards, and your bonus wallet.">
      {loading ? (
        <section className="cr-glass flex min-h-40 items-center justify-center rounded-2xl p-5">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-200" />
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <section className="cr-glass rounded-2xl p-5">
            <Flame className="mb-3 h-6 w-6 text-orange-300" />
            <h2 className="text-base font-bold text-white">Daily Streak</h2>
            <p className="mt-2 text-sm text-slate-400">Current streak: {status?.daily?.streak || 0} day(s)</p>
            <p className="mt-1 text-sm text-emerald-300">Next reward: {formatMoney(Number(status?.daily?.nextReward || 0))}</p>
            <Button
              className="cr-button mt-4 w-full text-slate-950"
              disabled={status?.daily?.claimedToday || actionLoading === "claim_daily"}
              onClick={() => runAction("claim_daily")}
            >
              {actionLoading === "claim_daily" ? <Loader2 className="h-4 w-4 animate-spin" /> : status?.daily?.claimedToday ? "Claimed Today" : "Claim Streak"}
            </Button>
          </section>

          <section className="cr-glass rounded-2xl p-5">
            <RotateCcw className="mb-3 h-6 w-6 text-cyan-200" />
            <h2 className="text-base font-bold text-white">Lucky Spin</h2>
            <p className="mt-2 text-sm text-slate-400">One free spin per day with small controlled rewards.</p>
            <Button
              className="cr-button mt-4 w-full text-slate-950"
              disabled={status?.spin?.claimedToday || actionLoading === "spin"}
              onClick={() => runAction("spin")}
            >
              {actionLoading === "spin" ? <Loader2 className="h-4 w-4 animate-spin" /> : status?.spin?.claimedToday ? "Spun Today" : "Spin"}
            </Button>
          </section>

          <section className="cr-glass rounded-2xl p-5">
            <Gift className="mb-3 h-6 w-6 text-emerald-300" />
            <h2 className="text-base font-bold text-white">Bonus Wallet</h2>
            <p className="mt-2 text-sm text-slate-400">Lifetime rewards credited from missions, streaks, and spin.</p>
            <p className="mt-4 text-2xl font-bold text-emerald-300">{formatMoney(Number(status?.bonusWallet || 0))}</p>
          </section>
        </div>
      )}
    </AppScreen>
  )
}
