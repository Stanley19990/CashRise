"use client"

import { useEffect, useState } from "react"
import { Award, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"
import { AppScreen } from "@/components/app-screen"
import { supabase } from "@/lib/supabase"

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAchievements = async () => {
      setLoading(true)
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const response = await fetch("/api/rewards", {
          headers: {
            ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
          }
        })
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.error || "Unable to load achievements")
        setAchievements(result.achievements || [])
      } catch (error: any) {
        toast.error(error.message || "Unable to load achievements")
      } finally {
        setLoading(false)
      }
    }

    loadAchievements()
  }, [])

  return (
    <AppScreen title="Achievements" description="Badges unlock automatically from real account activity.">
      {loading ? (
        <section className="cr-glass flex min-h-40 items-center justify-center rounded-2xl p-5">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-200" />
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {achievements.map((badge) => (
            <section key={badge.key} className="cr-glass rounded-2xl p-4 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/70">
                {badge.unlocked ? <Award className="h-5 w-5 text-amber-300" /> : <Lock className="h-5 w-5 text-slate-500" />}
              </div>
              <h2 className="text-sm font-bold text-white">{badge.title}</h2>
              <p className="mt-1 text-xs text-slate-500">{badge.description}</p>
              <p className={`mt-2 text-xs font-semibold ${badge.unlocked ? "text-emerald-300" : "text-slate-500"}`}>
                {badge.unlocked ? "Unlocked" : "Locked"}
              </p>
            </section>
          ))}
        </div>
      )}
    </AppScreen>
  )
}
