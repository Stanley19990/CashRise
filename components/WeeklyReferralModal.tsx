"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { safeStorageGet, safeStorageSet } from "@/lib/safe-data"
import { useCurrency } from "@/contexts/CurrencyContext"

export default function WeeklyReferralModal() {
  const { formatMoney } = useCurrency()
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if user has seen this modal in this session
    const seen = safeStorageGet(window.sessionStorage, "weeklyReferralSeen")
    if (!seen) {
      // Show after 2 seconds
      const timer = setTimeout(() => {
        setOpen(true)
        safeStorageSet(window.sessionStorage, "weeklyReferralSeen", "true")
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md cr-glass cr-card-3d rounded-3xl p-6 sm:p-7 text-center relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-44 w-44 rounded-full bg-amber-500/20 blur-2xl" />
        <div className="absolute -bottom-24 -left-24 h-44 w-44 rounded-full bg-indigo-500/20 blur-2xl" />

        <div className="relative z-10">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/30 to-emerald-400/30 border border-amber-400/30 shadow-[0_0_24px_rgba(255,180,84,0.35)]">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="text-2xl font-bold mb-2 text-white">
            Weekly Referral Contest!
          </h2>
          
          <div className="space-y-4 mb-6">
            <p className="text-slate-300">
              Invite your friends and win big every week:
            </p>
            
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-cyan-400/10">
              <div className="space-y-2 text-sm sm:text-base">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-200">🥇 1st Prize:</span>
                  <span className="text-2xl text-emerald-300">{formatMoney(500000)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">🥈 2nd Prize:</span>
                  <span className="text-xl text-cyan-300">{formatMoney(300000)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">🥉 3rd Prize:</span>
                  <span className="text-xl text-indigo-300">{formatMoney(200000)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">4th Prize:</span>
                  <span className="text-lg text-amber-300">{formatMoney(100000)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">5th Prize:</span>
                  <span className="text-lg text-rose-300">{formatMoney(50000)}</span>
                </div>
              </div>
            </div>
            
            <p className="text-xs sm:text-sm text-slate-400">
              Contest resets every Monday at 00:00 GMT
            </p>
          </div>

          <button
            onClick={() => {
              setOpen(false)
              router.push("/referrals")
            }}
            className="w-full cr-button text-slate-950 px-5 py-3 rounded-2xl mb-3 transition hover:scale-[1.02] font-bold text-lg"
          >
            Participate Now 🚀
          </button>

          <button
            onClick={() => setOpen(false)}
            className="text-rose-300 font-semibold hover:text-rose-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
