"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Check, X, RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { formatDate, formatNumber, toNumber } from "@/lib/safe-data"

interface Withdrawal {
  id: string
  user_id: string
  amount: number
  amount_usd: number
  method: string
  payment_method?: string
  payment_details?: { account_details?: string } | null
  status: 'pending' | 'approved' | 'completed' | 'rejected'
  account_details: string
  created_at: string
  users: {
    username: string
    email: string
  }
}

export function WithdrawalManagement() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select(`
          *,
          users (
            username,
            email
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setWithdrawals(data || [])
    } catch (error) {
      console.error('Error fetching withdrawals:', error)
      toast.error('Failed to load withdrawal requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWithdrawals()
  }, [])

  const updateWithdrawalStatus = async (withdrawalId: string, status: 'approved' | 'rejected') => {
    setProcessing(withdrawalId)
    
    try {
      const updatePayload: Record<string, any> = {
        status,
        processed_at: new Date().toISOString()
      }

      if (status === 'approved') {
        const withdrawal = withdrawals.find(w => w.id === withdrawalId)
        if (withdrawal) {
          const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('wallet_balance')
            .eq('id', withdrawal.user_id)
            .single()

          if (fetchError) throw fetchError

          const currentBalance = toNumber(userData?.wallet_balance)
          const withdrawalAmount = toNumber(withdrawal.amount)

          if (currentBalance < withdrawalAmount) {
            throw new Error('User balance is lower than the requested withdrawal amount')
          }

          const { error: userError } = await supabase
            .from('users')
            .update({ 
              wallet_balance: currentBalance - withdrawalAmount
            })
            .eq('id', withdrawal.user_id)

          if (userError) throw userError
        }
      }

      const { error } = await supabase
        .from('withdrawals')
        .update(updatePayload)
        .eq('id', withdrawalId)

      if (error) throw error

      toast.success(`Withdrawal ${status === 'approved' ? 'approved' : 'rejected'} successfully!`)
      await fetchWithdrawals()
    } catch (error) {
      console.error('Error updating withdrawal status:', error)
      toast.error('Failed to update withdrawal status')
    } finally {
      setProcessing(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "approved":
        return "bg-green-500/10 text-green-400 border-green-500/20"
      case "pending":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
      case "rejected":
        return "bg-red-500/10 text-red-400 border-red-500/20"
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20"
    }
  }

  const getMethodDisplay = (method: string) => {
    const methods: Record<string, string> = {
      'bank': 'Bank Transfer',
      'mobile_money_mtn': 'MTN Mobile Money',
      'mobile_money_orange': 'Orange Money',
      'paypal': 'PayPal',
      'crypto': 'Cryptocurrency'
    }
    return methods[method] || method
  }

  if (loading) {
    return (
      <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-green-400" />
            <span>Withdrawal Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-green-400" />
            <span>Withdrawal Management</span>
          </CardTitle>
          <RefreshCw 
            className="h-4 w-4 text-cyan-400 cursor-pointer"
            onClick={fetchWithdrawals}
          />
        </div>
        <p className="text-slate-300 text-sm">
          Manage withdrawal requests from users
        </p>
      </CardHeader>
      <CardContent>
        {withdrawals.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No withdrawal requests found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {withdrawals.map((withdrawal) => (
              <div
                key={withdrawal.id}
                className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700"
              >
                <div className="flex-1">
                  <div className="font-medium text-white">
                    {withdrawal.users?.username || withdrawal.users?.email || 'Unknown User'}
                  </div>
                  <div className="text-sm text-slate-400">
                    {getMethodDisplay(withdrawal.method || withdrawal.payment_method || "Not provided")}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Requested {formatDate(withdrawal.created_at)}
                  </div>
                  {(withdrawal.account_details || withdrawal.payment_details?.account_details) && (
                    <div className="text-xs text-slate-400 mt-1">
                      Account: {withdrawal.account_details || withdrawal.payment_details?.account_details}
                    </div>
                  )}
                </div>

                <div className="text-right mr-4">
                  <div className="text-lg font-bold text-green-400">
                    {formatNumber(withdrawal.amount)} XAF
                  </div>
                  <div className="text-sm text-slate-400">
                    ${toNumber(withdrawal.amount_usd, toNumber(withdrawal.amount) / 600).toFixed(2)} USD
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className={getStatusColor(withdrawal.status)}>
                    {withdrawal.status}
                  </Badge>
                  {withdrawal.status === "pending" && (
                    <div className="flex space-x-1">
                      <Button 
                        size="icon" 
                        className="h-8 w-8 bg-green-500 hover:bg-green-600"
                        onClick={() => updateWithdrawalStatus(withdrawal.id, 'approved')}
                        disabled={processing === withdrawal.id}
                      >
                        {processing === withdrawal.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button 
                        size="icon" 
                        variant="destructive" 
                        className="h-8 w-8"
                        onClick={() => updateWithdrawalStatus(withdrawal.id, 'rejected')}
                        disabled={processing === withdrawal.id}
                      >
                        {processing === withdrawal.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {withdrawals.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-800/30 rounded-lg p-3">
              <div className="text-lg font-bold text-yellow-400">
                {withdrawals.filter(w => w.status === 'pending').length}
              </div>
              <div className="text-xs text-slate-400">Pending</div>
            </div>
            <div className="bg-slate-800/30 rounded-lg p-3">
              <div className="text-lg font-bold text-green-400">
                {withdrawals.filter(w => w.status === 'approved' || w.status === 'completed').length}
              </div>
              <div className="text-xs text-slate-400">Completed</div>
            </div>
            <div className="bg-slate-800/30 rounded-lg p-3">
              <div className="text-lg font-bold text-red-400">
                {withdrawals.filter(w => w.status === 'rejected').length}
              </div>
              <div className="text-xs text-slate-400">Rejected</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
