"use client"

import { useEffect, useState } from "react"
import { useCurrency } from "@/contexts/CurrencyContext"
import { supabase } from "@/lib/supabase"

interface Withdrawal {
  id: string
  amount: number
  created_at?: string
  processed_at?: string
  users?: {
    username?: string
    full_name?: string
  } | Array<{
    username?: string
    full_name?: string
  }>
}

export default function LiveWithdrawals() {
  const { formatMoney } = useCurrency()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    supabase
      .from("withdrawals")
      .select("id, amount, created_at, processed_at, users(username, full_name)")
      .in("status", ["approved", "completed"])
      .order("processed_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) {
          console.error("Live withdrawals load error:", error)
          setWithdrawals([])
          return
        }

        setWithdrawals(data || [])
      })
  }, [])

  useEffect(() => {
    if (withdrawals.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev < withdrawals.length - 1 ? prev + 1 : 0))
    }, 4000)

    return () => clearInterval(interval)
  }, [withdrawals.length])

  if (withdrawals.length === 0) return null

  const current = withdrawals[currentIndex]
  const user = Array.isArray(current.users) ? current.users[0] : current.users

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 text-white shadow-lg">
      <div className="flex items-center space-x-2">
        <div className="flex flex-col">
          <span className="text-sm font-bold">
            {user?.username || user?.full_name || "A verified user"} withdrew
          </span>
          <span className="text-lg font-black">{formatMoney(current.amount)}</span>
        </div>
      </div>
    </div>
  )
}
