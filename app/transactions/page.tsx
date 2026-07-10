// app/transactions/page.tsx
"use client"

import { useState, useEffect } from "react"
import { TransactionHistory } from "@/components/transaction-history"
import { DashboardHeader } from "@/components/dashboard-header"
import { FloatingParticles } from "@/components/floating-particles"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent } from "@/components/ui/card"
import { Coins, Users, Share2, ArrowUpRight, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toNumber } from "@/lib/safe-data"
import { useCurrency } from "@/contexts/CurrencyContext"

export default function TransactionsPage() {
  const { user } = useAuth()
  const { formatMoney } = useCurrency()
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalEarned: 0,
    totalWithdrawn: 0,
    referralBonus: 0,
    socialBonus: 0
  })

  useEffect(() => {
    // Redirect if not logged in
    if (!user) {
      router.push("/")
      return
    }
    
    loadTransactions()
  }, [user, router])

  const loadTransactions = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const transactionsData = data || []
      setTransactions(transactionsData)
      
      // Calculate stats after transactions are loaded
      calculateStats(transactionsData)
    } catch (error) {
      console.error('Error loading transactions:', error)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (txs: any[]) => {
    try {
      const earned = txs
        .filter(tx => 
          tx.type === 'mining_earnings' || 
          tx.type === 'referral_bonus' || 
          tx.type === 'social_bonus' ||
          tx.type === 'daily_earnings' ||
          tx.type === 'bonus'
        )
        .reduce((sum, tx) => sum + toNumber(tx.amount), 0)

      const withdrawn = txs
        .filter(tx => tx.type === 'withdrawal')
        .reduce((sum, tx) => sum + toNumber(tx.amount), 0)

      const referralBonus = txs
        .filter(tx => tx.type === 'referral_bonus')
        .reduce((sum, tx) => sum + toNumber(tx.amount), 0)

      const socialBonus = txs
        .filter(tx => tx.type === 'social_bonus')
        .reduce((sum, tx) => sum + toNumber(tx.amount), 0)

      setStats({
        totalEarned: earned,
        totalWithdrawn: withdrawn,
        referralBonus,
        socialBonus
      })
    } catch (error) {
      console.error('Error calculating stats:', error)
    }
  }

  // Show loading while checking auth
  if (!user) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-16 w-16 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-16 w-16 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading transactions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="cr-backdrop cr-grid"></div>
      <FloatingParticles />
      
      <div className="relative z-10">
        <DashboardHeader />
        
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Page Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold cr-title cr-hero-text mb-2">
                Transaction History
              </h1>
              <p className="text-slate-400">
                Track all your earnings, bonuses, and withdrawals
              </p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="cr-glass">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl">
                      <Coins className="h-6 w-6 text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Total Earned</p>
                      <p className="text-2xl font-bold text-white">
                        {formatMoney(stats.totalEarned)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cr-glass">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-red-500/10 rounded-2xl">
                      <ArrowUpRight className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Total Withdrawn</p>
                      <p className="text-2xl font-bold text-white">
                        {formatMoney(stats.totalWithdrawn)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cr-glass">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-pink-500/10 rounded-2xl">
                      <Users className="h-6 w-6 text-pink-400" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Referral Bonus</p>
                      <p className="text-2xl font-bold text-white">
                        {formatMoney(stats.referralBonus)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cr-glass">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-orange-500/10 rounded-2xl">
                      <Share2 className="h-6 w-6 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Social Bonus</p>
                      <p className="text-2xl font-bold text-white">
                        {formatMoney(stats.socialBonus)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Transaction History */}
            <TransactionHistory transactions={transactions} />

            {/* No Transactions Message */}
            {transactions.length === 0 && (
              <Card className="cr-glass">
                <CardContent className="p-12 text-center">
                  <Coins className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-300 mb-2">
                    No Transactions Yet
                  </h3>
                  <p className="text-slate-400 mb-4">
                    Your transaction history will appear here when you:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-400">
                    <div className="flex items-center justify-center space-x-2">
                      <Coins className="h-4 w-4 text-green-400" />
                      <span>Claim machine earnings</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                      <Users className="h-4 w-4 text-pink-400" />
                      <span>Earn referral bonuses</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                      <Share2 className="h-4 w-4 text-orange-400" />
                      <span>Complete social tasks</span>
                    </div>
                  </div>
                  
                  {/* Debug Info - Remove in production */}
                  <div className="mt-6 p-4 bg-slate-900/60 rounded-2xl border border-cyan-400/10">
                    <p className="text-sm text-slate-400 mb-2">Debug Info:</p>
                    <p className="text-xs text-slate-500">
                      User ID: {user?.id}<br />
                      Transactions in DB: {transactions.length}<br />
                      Check if transactions exist for this user in Supabase
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
