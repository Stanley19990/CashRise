"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Circle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { AppScreen } from "@/components/app-screen"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useCurrency } from "@/contexts/CurrencyContext"

export default function MissionsPage() {
  const { formatMoney } = useCurrency()
  const [missions, setMissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)

  const loadRewards = async () => {
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch("/api/rewards", {
        headers: {
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
        }
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load missions")
      setMissions(result.missions || [])
    } catch (error: any) {
      toast.error(error.message || "Unable to load missions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRewards()
  }, [])

  const claimMission = async (missionId: string) => {
    setClaiming(missionId)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch("/api/rewards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
        },
        body: JSON.stringify({ action: "claim_mission", missionId })
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to claim mission")
      toast.success(result.message || "Mission reward claimed")
      await loadRewards()
    } catch (error: any) {
      toast.error(error.message || "Unable to claim mission")
    } finally {
      setClaiming(null)
    }
  }

  return (
    <AppScreen title="Daily Missions" description="Complete real app actions and claim once per day.">
      <section className="cr-glass rounded-2xl p-5">
        {loading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-200" />
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((mission) => {
              const Icon = mission.completed ? CheckCircle2 : Circle
              return (
                <div key={mission.id} className="flex min-h-16 items-center justify-between gap-3 rounded-xl bg-slate-900/50 px-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className={`h-5 w-5 shrink-0 ${mission.completed ? "text-emerald-300" : "text-slate-500"}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">{mission.title}</p>
                      <p className="text-xs text-emerald-300">{formatMoney(Number(mission.reward || 0))}</p>
                    </div>
                  </div>
                  <Button
                    className="cr-button min-w-20 text-slate-950"
                    disabled={!mission.completed || mission.claimed || claiming === mission.id}
                    onClick={() => claimMission(mission.id)}
                  >
                    {claiming === mission.id ? <Loader2 className="h-4 w-4 animate-spin" /> : mission.claimed ? "Claimed" : "Claim"}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </AppScreen>
  )
}
