"use client"

import { useState } from "react"
import { Banknote, CreditCard, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { convertToXAF } from "@/lib/currency"
import { toNumber } from "@/lib/safe-data"
import { supabase } from "@/lib/supabase"
import { useCurrency } from "@/contexts/CurrencyContext"

const paymentMethods = [
  { value: "bank", label: "Bank Transfer", icon: CreditCard },
  { value: "mobile_money_mtn", label: "MTN Mobile Money", icon: Smartphone },
  { value: "mobile_money_orange", label: "Orange Money", icon: Smartphone },
  { value: "paypal", label: "PayPal", icon: Banknote }
]

export function WithdrawalSection() {
  const { user, refreshUser } = useAuth()
  const { currency, convertXAF, formatMoney } = useCurrency()
  const [form, setForm] = useState({ amount: "", method: "", accountDetails: "" })
  const [processing, setProcessing] = useState(false)
  const minWithdrawalXAF = 3000

  if (!user) return null

  const walletBalanceXAF = toNumber((user as any).wallet_balance)
  const amountXAF = form.amount ? convertToXAF(Number.parseFloat(form.amount) || 0, currency) : 0

  const handleWithdrawal = async () => {
    if (!form.amount || !form.method || !form.accountDetails.trim()) {
      toast.error("Please fill in all required fields")
      return
    }

    if (amountXAF < minWithdrawalXAF) {
      toast.error(`Minimum withdrawal amount is ${formatMoney(minWithdrawalXAF)}`)
      return
    }

    if (amountXAF > walletBalanceXAF) {
      toast.error("Insufficient balance")
      return
    }

    setProcessing(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Authentication required")
      }

      const response = await fetch("/api/withdrawals/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amountXAF,
          method: form.method,
          accountDetails: form.accountDetails.trim()
        })
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Withdrawal request failed. Please try again.")
      }

      toast.success(`Withdrawal request of ${formatMoney(amountXAF)} submitted successfully.`)
      setForm({ amount: "", method: "", accountDetails: "" })
      await refreshUser()
    } catch (error: any) {
      console.error("Withdrawal error:", error)
      toast.error(error.message || "Withdrawal request failed. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CreditCard className="h-5 w-5 text-green-400" />
          <span>Withdraw Funds</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <h4 className="text-amber-400 font-semibold mb-2">Withdrawal Rules</h4>
            <div className="text-sm text-amber-200/80 space-y-1">
              <p>New users must wait 1 month before the first withdrawal request.</p>
              <p>Regular users can submit reviewed withdrawal requests.</p>
              <p>Minimum amount: {formatMoney(minWithdrawalXAF)}</p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Available Balance</div>
            <div className="text-2xl font-bold text-green-400">{formatMoney(walletBalanceXAF)}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Withdrawal Amount ({currency})</Label>
            <Input
              id="amount"
              type="number"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="0"
              min={convertXAF(minWithdrawalXAF)}
              max={convertXAF(walletBalanceXAF)}
              className="bg-slate-800 border-slate-700 focus:border-green-500"
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={form.method} onValueChange={(value: string) => setForm({ ...form, method: value })}>
              <SelectTrigger className="bg-slate-800 border-slate-700 focus:border-green-500">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {paymentMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    <div className="flex items-center space-x-2">
                      <method.icon className="h-4 w-4" />
                      <span>{method.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountDetails">Account Details</Label>
            <Textarea
              id="accountDetails"
              value={form.accountDetails}
              onChange={(event) => setForm({ ...form, accountDetails: event.target.value })}
              placeholder="Enter your account details"
              className="bg-slate-800 border-slate-700 focus:border-green-500 min-h-[80px]"
            />
          </div>

          <Button
            onClick={handleWithdrawal}
            disabled={
              processing ||
              !form.amount ||
              !form.method ||
              !form.accountDetails.trim() ||
              amountXAF < minWithdrawalXAF ||
              amountXAF > walletBalanceXAF
            }
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
          >
            {processing ? "Processing..." : "Request Withdrawal"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
