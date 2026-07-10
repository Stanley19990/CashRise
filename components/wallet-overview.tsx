// components/wallet-overview.tsx - FIXED
"use client"

import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, DollarSign, Coins, TrendingUp, RefreshCw, Cpu } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { firstRelation, formatNumber, toNumber } from "@/lib/safe-data"
import { useCurrency } from "@/contexts/CurrencyContext"

// Extended user type to include database fields
interface DatabaseUser {
  id: string
  created_at: string
  email?: string
  username?: string
  full_name?: string
  avatar_url?: string
  country?: string
  phone?: string
  referral_code?: string
  referred_by?: string
  wallet_balance: number
  ed_balance: number
  total_earned: number
  machines_owned: number
  last_earning_date?: string
  social_media_completed: boolean
  completed_social_links?: string[]
  social_media_bonus_paid: boolean
}

export function WalletOverview() {
  const { user: authUser, refreshUser } = useAuth()
  const { formatMoney } = useCurrency()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    ownedMachines: 0,
    activeMachines: 0,
    totalDailyEarnings: 0,
    totalEarnedXAF: 0
  })
  
  // FIXED: Add state for real-time balance tracking
  const [walletBalance, setWalletBalance] = useState(0)
  const [totalEarned, setTotalEarned] = useState(0)

  // Type assertion to handle the user type mismatch
  const user = authUser as unknown as DatabaseUser

  useEffect(() => {
    if (user) {
      // FIXED: Initialize balances from user object
      setWalletBalance(toNumber(user.wallet_balance))
      setTotalEarned(toNumber(user.total_earned))
      fetchStats()
      
      // FIXED: Set up real-time subscription for balance updates
      const channel = supabase
        .channel('wallet-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            console.log('💰 Wallet balance updated:', payload)
            const newData = payload.new as DatabaseUser
            setWalletBalance(toNumber(newData.wallet_balance))
            setTotalEarned(toNumber(newData.total_earned))
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user])

  const fetchStats = async () => {
    if (!user) return

    try {
      // Get owned machines count
      const { count: ownedMachines, error: countError } = await supabase
        .from('user_machines')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (countError) throw countError

      // Get active machines count
      const { count: activeMachines, error: activeError } = await supabase
        .from('user_machines')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (activeError) throw activeError

      // Calculate total daily earnings from ALL owned machines
      const { data: userMachines, error: machinesError } = await supabase
        .from('user_machines')
        .select(`
          machine_types (
            daily_earnings
          )
        `)
        .eq('user_id', user.id)

      if (machinesError) throw machinesError

      let totalDailyEarnings = 0
      userMachines?.forEach(machine => {
        const machineData = firstRelation<any>(machine.machine_types)
        totalDailyEarnings += toNumber(machineData?.daily_earnings)
      })

      setStats({
        ownedMachines: ownedMachines || 0,
        activeMachines: activeMachines || 0,
        totalDailyEarnings,
        totalEarnedXAF: totalEarned // Use state value instead
      })

    } catch (error) {
      console.error('Error fetching wallet stats:', error)
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    await refreshUser()
    await fetchStats()
    
    // FIXED: Manually fetch latest balance from database
    try {
      const { data, error } = await supabase
        .from('users')
        .select('wallet_balance, total_earned')
        .eq('id', user.id)
        .single()
      
      if (!error && data) {
        setWalletBalance(toNumber(data.wallet_balance))
        setTotalEarned(toNumber(data.total_earned))
      }
    } catch (error) {
      console.error('Error refreshing balance:', error)
    }
    
    setLoading(false)
  }

  if (!user) return null

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Available Balance - FIXED: Use state value */}
      <Card className="cr-glass cr-card-3d">
        <CardHeader className="flex items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Available Balance</CardTitle>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-300" />
            <RefreshCw 
              className={`h-4 w-4 text-slate-400 cursor-pointer hover:text-emerald-300 transition-colors ${loading ? 'animate-spin' : ''}`} 
              onClick={handleRefresh} 
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-300">
            {formatMoney(walletBalance)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Available for withdrawal</p>
        </CardContent>
      </Card>

      {/* CR Balance */}
      <Card className="cr-glass cr-card-3d">
        <CardHeader className="flex items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">CR Balance</CardTitle>
          <Coins className="h-4 w-4 text-cyan-300" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-cyan-300">{toNumber(user.ed_balance).toFixed(2)} CR</div>
          <p className="text-xs text-slate-500 mt-1">CashRise (CR) tokens</p>
        </CardContent>
      </Card>

      {/* Daily Earnings Potential */}
      <Card className="cr-glass cr-card-3d">
        <CardHeader className="flex items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Daily Potential</CardTitle>
          <DollarSign className="h-4 w-4 text-amber-300" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-300">
            {formatMoney(stats.totalDailyEarnings)}
          </div>
          <p className="text-xs text-slate-500 mt-1">From {stats.ownedMachines} machines</p>
        </CardContent>
      </Card>

      {/* Total Earned - FIXED: Use state value */}
      <Card className="cr-glass cr-card-3d">
        <CardHeader className="flex items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Total Earned</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-300" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-300">
            {formatMoney(totalEarned)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Lifetime earnings</p>
        </CardContent>
      </Card>
    </div>
  )
}
