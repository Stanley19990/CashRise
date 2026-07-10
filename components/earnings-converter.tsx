"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowRightLeft, Coins, DollarSign, Zap, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { toNumber } from "@/lib/safe-data"
import { useCurrency } from "@/contexts/CurrencyContext"

export function EarningsConverter() {
  const { user, refreshUser } = useAuth()
  const { formatMoney } = useCurrency()
  const [edAmount, setEdAmount] = useState("")
  const [converting, setConverting] = useState(false)
  const [balances, setBalances] = useState({ ed_balance: 0, wallet_balance: 0 })

  // Conversion rates based on our system:
  // 1 CR = $0.10 USD
  // $1 USD = 600 XAF
  // Therefore: 1 CR = 60 XAF
  const edToUsdRate = 0.1
  const usdToXafRate = 600
  const edToXafRate = 60 // 1 CR = 60 XAF

  const usdAmount = Number.parseFloat(edAmount) * edToUsdRate || 0
  const xafAmount = Number.parseFloat(edAmount) * edToXafRate || 0

  const fetchBalances = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from("users")
      .select("ed_balance, wallet_balance")
      .eq("id", user.id)
      .maybeSingle()

    if (!error && data) {
      setBalances({
        ed_balance: toNumber(data.ed_balance),
        wallet_balance: toNumber(data.wallet_balance)
      })
    }
  }

  useEffect(() => {
    fetchBalances()
  }, [user])

  const handleConvert = async () => {
    if (!user || !edAmount) return

    const edToConvert = Number.parseFloat(edAmount)
    const userEdBalance = balances.ed_balance

    // Validation
    if (edToConvert <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    if (edToConvert > userEdBalance) {
      toast.error("Insufficient CR balance")
      return
    }

    if (edToConvert < 10) {
      toast.error("Minimum conversion amount is 10 CR")
      return
    }

    setConverting(true)

    try {
      console.log('🔄 Starting conversion:', { edToConvert, usdAmount, xafAmount })

      // Get current user data from database
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('ed_balance, wallet_balance, total_earned')
        .eq('id', user.id)
        .single()

      if (fetchError) {
        console.error('❌ Error fetching user data:', fetchError)
        throw new Error('Failed to fetch user data')
      }

      const currentEdBalance = currentUser.ed_balance || 0
      const currentWalletBalance = currentUser.wallet_balance || 0

      // Double-check balance
      if (edToConvert > currentEdBalance) {
      toast.error("Insufficient CR balance")
        return
      }

      // Calculate new balances
      const newEdBalance = currentEdBalance - edToConvert
      const newWalletBalance = currentWalletBalance + xafAmount

      console.log('📊 Balance update:', {
        currentEdBalance,
        currentWalletBalance,
        newEdBalance,
        newWalletBalance
      })

      // Update user balances in database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          ed_balance: newEdBalance,
          wallet_balance: newWalletBalance
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('❌ Error updating user balance:', updateError)
        throw new Error('Failed to update balance')
      }

      // Record conversion transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'conversion',
          description: `Converted ${edToConvert} CR to ${formatMoney(xafAmount)} ($${usdAmount.toFixed(2)} USD)`,
          amount: -edToConvert, // Negative for CR deduction
          currency: 'ED',
          status: 'completed',
          external_id: `conv_${user.id}_${Date.now()}`,
          metadata: {
            conversion_rate: edToUsdRate,
            usd_amount: usdAmount,
            xaf_amount: xafAmount,
            ed_amount: edToConvert
          }
        })

      if (transactionError) {
        console.error('❌ Error recording transaction:', transactionError)
        // Don't fail the conversion if transaction recording fails
        console.log('⚠️ Transaction recording failed, but conversion was successful')
      }

      // Record wallet credit transaction
      const { error: usdTransactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'conversion_credit',
          description: `Received ${formatMoney(xafAmount)} from CR conversion`,
          amount: xafAmount,
          currency: 'XAF',
          status: 'completed',
          external_id: `conv_usd_${user.id}_${Date.now()}`,
          metadata: {
            conversion_rate: edToUsdRate,
            ed_amount: edToConvert,
            xaf_amount: xafAmount,
            source: 'cr_conversion'
          }
        })

      if (usdTransactionError) {
        console.error('❌ Error recording USD transaction:', usdTransactionError)
        // Don't fail the conversion if USD transaction recording fails
      }

      console.log('✅ Conversion successful')

      // Refresh user data
      await refreshUser()

      setBalances({ ed_balance: newEdBalance, wallet_balance: newWalletBalance })
      await fetchBalances()

      toast.success(`Successfully converted ${edToConvert} CR to ${formatMoney(xafAmount)}!`)
      setEdAmount("")

    } catch (error) {
      console.error('❌ Conversion error:', error)
      toast.error("Conversion failed. Please try again.")
    } finally {
      setConverting(false)
    }
  }

  // Quick conversion buttons
  const quickConvert = (percentage: number) => {
    const userEdBalance = balances.ed_balance
    if (userEdBalance <= 0) {
      toast.error("No CR balance available")
      return
    }

    const amount = Math.floor(userEdBalance * percentage)
    if (amount < 10) {
      toast.error("Minimum conversion amount is 10 CR")
      return
    }

    setEdAmount(amount.toString())
  }

  if (!user) return null

  return (
    <Card className="cr-glass">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ArrowRightLeft className="h-5 w-5 text-amber-300" />
          <span>Convert CR to Money</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current Balances */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-900/60 rounded-2xl p-3 text-center border border-cyan-400/10">
              <div className="flex items-center justify-center space-x-2 mb-1">
                <Zap className="h-4 w-4 text-cyan-300" />
                <span className="text-sm text-slate-400">CR Balance</span>
              </div>
              <div className="text-lg font-bold text-cyan-300">
                {balances.ed_balance.toFixed(2)} CR
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-2xl p-3 text-center border border-cyan-400/10">
              <div className="flex items-center justify-center space-x-2 mb-1">
                <TrendingUp className="h-4 w-4 text-emerald-300" />
                <span className="text-sm text-slate-400">Available Balance</span>
              </div>
              <div className="text-lg font-bold text-emerald-300">
                {formatMoney(balances.wallet_balance)}
              </div>
              <div className="text-xs text-slate-400">
                Available money balance
              </div>
            </div>
          </div>

          {/* Conversion Rate */}
          <div className="bg-slate-900/60 rounded-2xl p-4 border border-cyan-400/10">
            <div className="text-center mb-2">
              <div className="text-sm text-slate-400 mb-1">Current Exchange Rate</div>
              <div className="text-lg font-semibold text-amber-300">1 CR = {formatMoney(60)}</div>
              <div className="text-sm text-slate-300">($0.10 USD base rate)</div>
            </div>
            <div className="text-xs text-slate-400 text-center">
              Fixed rate • Minimum conversion: 10 CR
            </div>
          </div>

          {/* Quick Conversion Buttons */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-300">Quick Convert</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => quickConvert(0.25)}
                className="text-xs py-1 h-auto bg-slate-900/70 hover:bg-slate-800 border-slate-700"
              >
                25%
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => quickConvert(0.5)}
                className="text-xs py-1 h-auto bg-slate-900/70 hover:bg-slate-800 border-slate-700"
              >
                50%
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => quickConvert(1)}
                className="text-xs py-1 h-auto bg-slate-900/70 hover:bg-slate-800 border-slate-700"
              >
                100%
              </Button>
            </div>
          </div>

          {/* Conversion Inputs */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edAmount" className="flex items-center space-x-2">
                <Coins className="h-4 w-4 text-cyan-300" />
                <span>CR Amount</span>
              </Label>
              <Input
                id="edAmount"
                type="number"
                value={edAmount}
                onChange={(e) => setEdAmount(e.target.value)}
                placeholder="0"
                min="10"
                max={balances.ed_balance}
                step="1"
                className="bg-slate-900/70 border-slate-700 focus:border-cyan-500 text-cyan-200 text-center text-lg font-semibold"
              />
              <div className="text-xs text-slate-400 text-center">
                Available: {balances.ed_balance.toFixed(2)} CR
              </div>
            </div>

            {/* Conversion Arrow */}
            <div className="flex justify-center">
              <ArrowRightLeft className="h-6 w-6 text-amber-300" />
            </div>

            {/* Money Amount Display */}
            <div className="space-y-2">
              <Label className="flex items-center justify-center space-x-2">
                <TrendingUp className="h-4 w-4 text-emerald-300" />
                <span>You Will Receive</span>
              </Label>
              <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-300 mb-1">
                  {formatMoney(xafAmount)}
                </div>
                <div className="text-sm text-slate-400">
                  ${usdAmount.toFixed(2)} USD
                </div>
              </div>
            </div>
          </div>

          {/* Convert Button */}
          <Button
            onClick={handleConvert}
            disabled={
              converting ||
              !edAmount ||
              Number.parseFloat(edAmount) < 10 ||
              Number.parseFloat(edAmount) > balances.ed_balance
            }
            className="w-full cr-button text-slate-950 font-semibold py-3"
          >
            {converting ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Converting...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="h-4 w-4" />
                <span>Convert to Money</span>
              </div>
            )}
          </Button>

          {/* Info */}
          <div className="text-xs text-slate-400 text-center space-y-1">
            <div>Converted money will be added to your available balance</div>
            <div>Use your balance for withdrawals or purchases</div>
            <div>1 CR = {formatMoney(60)} • $1 USD = 600 XAF</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
