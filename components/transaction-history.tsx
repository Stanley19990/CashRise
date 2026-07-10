// components/transaction-history.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { History, ArrowUpRight, ArrowDownLeft, Coins, CreditCard, Plus, Users, Zap, Gift, Share2 } from "lucide-react"
import { formatDate, formatDateTime, formatNumber, toNumber } from "@/lib/safe-data"
import { useCurrency } from "@/contexts/CurrencyContext"

interface TransactionHistoryProps {
  transactions: {
    id: string
    type: string
    description: string
    amount: number
    currency: string
    status: string
    created_at: string
    metadata?: any
  }[]
}

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const { formatMoney } = useCurrency()
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "earning":
      case "mining_earnings":
        return <Coins className="h-4 w-4 text-green-400" />
      case "withdrawal":
        return <ArrowUpRight className="h-4 w-4 text-red-400" />
      case "conversion":
        return <ArrowDownLeft className="h-4 w-4 text-purple-400" />
      case "purchase":
        return <CreditCard className="h-4 w-4 text-blue-400" />
      case "deposit":
        return <Plus className="h-4 w-4 text-cyan-400" />
      case "referral_bonus":
        return <Users className="h-4 w-4 text-pink-400" />
      case "social_bonus":
        return <Share2 className="h-4 w-4 text-orange-400" />
      case "daily_earnings":
        return <Zap className="h-4 w-4 text-yellow-400" />
      case "bonus":
        return <Gift className="h-4 w-4 text-emerald-400" />
      default:
        return <History className="h-4 w-4 text-slate-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 text-green-300 border-green-500/20"
      case "pending":
        return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20"
      case "failed":
        return "bg-red-500/10 text-red-300 border-red-500/20"
      default:
        return "bg-slate-500/10 text-slate-300 border-slate-500/20"
    }
  }

  const getAmountColor = (type: string) => {
    const positiveTypes = [
      "earning", 
      "mining_earnings", 
      "deposit", 
      "referral_bonus", 
      "social_bonus", 
      "daily_earnings",
      "bonus",
      "conversion"
    ]
    
    return positiveTypes.includes(type) ? "text-green-400" : "text-red-400"
  }

  const getAmountPrefix = (type: string) => {
    const positiveTypes = [
      "earning", 
      "mining_earnings", 
      "deposit", 
      "referral_bonus", 
      "social_bonus", 
      "daily_earnings",
      "bonus",
      "conversion"
    ]
    
    return positiveTypes.includes(type) ? "+" : "-"
  }

  const formatDescription = (transaction: any) => {
    if (transaction.metadata?.machine_name) {
      return `${transaction.description} - ${transaction.metadata.machine_name}`
    }
    if (transaction.metadata?.referral_user) {
      return `${transaction.description} - ${transaction.metadata.referral_user}`
    }
    if (transaction.metadata?.bonus_type === 'social_media_completion') {
      return "Social media completion bonus"
    }
    return transaction.description
  }

  const formatTransactionAmount = (transaction: any) => {
    const amount = Math.abs(toNumber(transaction.amount))
    if (transaction.currency === "ED" || transaction.currency === "CR") {
      return `${formatNumber(amount)} CR`
    }
    return formatMoney(amount)
  }

  // Sort transactions by date (newest first)
  const sortedTransactions = [...transactions].sort((a, b) => 
    toNumber(new Date(b.created_at).getTime()) - toNumber(new Date(a.created_at).getTime())
  )

  // Group transactions by date
  const groupedTransactions = sortedTransactions.reduce((groups: any, transaction) => {
    const date = formatDate(transaction.created_at)
    
    if (!groups[date]) {
      groups[date] = []
    }
    
    groups[date].push(transaction)
    return groups
  }, {})

  return (
    <Card className="cr-glass">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <History className="h-5 w-5 text-cyan-200" />
          <span className="text-white">Transaction History</span>
        </CardTitle>
        <p className="text-slate-300 text-sm">
          All your earnings, bonuses, purchases, and withdrawals
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.keys(groupedTransactions).length > 0 ? (
            Object.entries(groupedTransactions).map(([date, dayTransactions]: [string, any]) => (
              <div key={date} className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="h-px flex-1 bg-slate-700"></div>
                  <span className="text-xs font-medium text-slate-400 px-2">{date}</span>
                  <div className="h-px flex-1 bg-slate-700"></div>
                </div>
                
                {dayTransactions.map((transaction: any) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 bg-slate-900/60 rounded-2xl border border-cyan-400/10 hover:border-cyan-400/30 transition-colors"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="p-2 bg-slate-800 rounded-xl flex-shrink-0 border border-cyan-400/10">
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-white truncate">
                          {formatDescription(transaction)}
                        </div>
                        <div className="text-sm text-slate-300 flex items-center space-x-2 mt-1">
                          <span>{formatDateTime(transaction.created_at)}</span>
                          {transaction.metadata && (
                            <>
                              <span className="text-slate-500">•</span>
                              <Badge 
                                variant="secondary" 
                                className="bg-slate-800/60 text-slate-300 border-slate-700 text-xs"
                              >
                                {transaction.type.replace('_', ' ')}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 ml-4">
                      <div className="flex items-center space-x-2 justify-end">
                        <span className={`font-semibold ${getAmountColor(transaction.type)}`}>
                          {getAmountPrefix(transaction.type)}
                          {formatTransactionAmount(transaction)}
                        </span>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`${getStatusColor(transaction.status)} mt-1 text-xs`}
                      >
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-400">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-slate-300">No transactions yet</p>
              <p className="text-sm text-slate-400">
                Your transaction history will appear here when you start earning
              </p>
            </div>
          )}
        </div>

        {/* Transaction Types Legend */}
        {sortedTransactions.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-800/80">
            <div className="flex flex-wrap gap-3 justify-center">
              <div className="flex items-center space-x-1 text-xs text-slate-400">
                <Coins className="h-3 w-3 text-green-400" />
                <span>Mining</span>
              </div>
              <div className="flex items-center space-x-1 text-xs text-slate-400">
                <Users className="h-3 w-3 text-pink-400" />
                <span>Referrals</span>
              </div>
              <div className="flex items-center space-x-1 text-xs text-slate-400">
                <Share2 className="h-3 w-3 text-orange-400" />
                <span>Social</span>
              </div>
              <div className="flex items-center space-x-1 text-xs text-slate-400">
                <Gift className="h-3 w-3 text-emerald-400" />
                <span>Bonus</span>
              </div>
              <div className="flex items-center space-x-1 text-xs text-slate-400">
                <CreditCard className="h-3 w-3 text-blue-400" />
                <span>Purchase</span>
              </div>
              <div className="flex items-center space-x-1 text-xs text-slate-400">
                <ArrowUpRight className="h-3 w-3 text-red-400" />
                <span>Withdrawal</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
