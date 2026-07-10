"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, DollarSign, Zap, TrendingUp } from "lucide-react"
import { supabase } from "@/lib/supabase"

type AdminStatsData = {
  totalUsers: number
  totalRevenue: number
  activeMachines: number
  pendingWithdrawals: number
  pendingWithdrawalCount: number
}

const emptyStats: AdminStatsData = {
  totalUsers: 0,
  totalRevenue: 0,
  activeMachines: 0,
  pendingWithdrawals: 0,
  pendingWithdrawalCount: 0
}

export function AdminStats() {
  const [stats, setStats] = useState<AdminStatsData>(emptyStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true)
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const response = await fetch("/api/admin/stats", {
          headers: {
            ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
          }
        })
        const result = await response.json()
        if (response.ok && result.success) {
          setStats(result.stats || emptyStats)
        }
      } catch (error) {
        console.error("Admin stats fetch error:", error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  const displayStats = [
    {
      label: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      caption: loading ? "Loading..." : "Registered accounts",
      icon: Users,
      color: "text-purple-400"
    },
    {
      label: "Machine Revenue",
      value: `${stats.totalRevenue.toLocaleString()} XAF`,
      caption: loading ? "Loading..." : "Completed purchases",
      icon: DollarSign,
      color: "text-green-400"
    },
    {
      label: "Active Machines",
      value: stats.activeMachines.toLocaleString(),
      caption: loading ? "Loading..." : "Currently mining",
      icon: Zap,
      color: "text-cyan-400"
    },
    {
      label: "Pending Withdrawals",
      value: `${stats.pendingWithdrawals.toLocaleString()} XAF`,
      caption: loading ? "Loading..." : `${stats.pendingWithdrawalCount} requests pending`,
      icon: TrendingUp,
      color: "text-amber-400"
    }
  ]

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {displayStats.map((item) => {
        const Icon = item.icon
        return (
          <Card key={item.label} className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">{item.label}</CardTitle>
              <Icon className={`h-4 w-4 ${item.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              <p className="text-xs text-slate-500 mt-1">{item.caption}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
