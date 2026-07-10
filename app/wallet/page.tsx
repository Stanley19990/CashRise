"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Toaster, toast } from "sonner"
import { DashboardHeader } from "@/components/dashboard-header"
import { EarningsConverter } from "@/components/earnings-converter"
import { FloatingParticles } from "@/components/floating-particles"
import { PaymentSelector } from "@/components/PaymentSelector"
import { TransactionHistory } from "@/components/transaction-history"
import { WalletBalance } from "@/components/wallet-balance"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { convertToXAF } from "@/lib/currency"
import { firstRelation, formatDate, toNumber } from "@/lib/safe-data"
import { supabase } from "@/lib/supabase"
import { useCurrency } from "@/contexts/CurrencyContext"

const paymentMethods = [
  { value: "bank", label: "Bank Transfer" },
  { value: "mobile_money_mtn", label: "MTN Mobile Money" },
  { value: "mobile_money_orange", label: "Orange Money" },
  { value: "paypal", label: "PayPal" }
]

export default function WalletPage() {
  const { user, loading } = useAuth()
  const { currency, convertXAF, formatMoney } = useCurrency()
  const router = useRouter()
  const [walletData, setWalletData] = useState<{ wallet_balance: number; created_at?: string } | null>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [referrals, setReferrals] = useState<any[]>([])
  const [canWithdraw, setCanWithdraw] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [showDepositMethods, setShowDepositMethods] = useState(false)
  const [withdrawMethod, setWithdrawMethod] = useState("")
  const [accountDetails, setAccountDetails] = useState("")
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push("/")
  }, [user, loading, router])

  const fetchWalletData = async () => {
    if (!user) return

    try {
      const { data: wallet, error: walletError } = await supabase
        .from("users")
        .select("wallet_balance, created_at")
        .eq("id", user.id)
        .single()

      if (walletError) throw walletError
      setWalletData(wallet)

      if (wallet?.created_at) {
        const createdAt = new Date(wallet.created_at)
        const oneMonthLater = new Date(createdAt)
        oneMonthLater.setMonth(createdAt.getMonth() + 1)
        setCanWithdraw(new Date() >= oneMonthLater)
      }

      const { data: txs, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

      if (txError) throw txError
      setTransactions(txs || [])

      const { data: refs, error: refError } = await supabase
        .from("referrals")
        .select(`
          id, referred_id, bonus, referral_date,
          referred_user:users!referrals_referred_id_fkey(username, email)
        `)
        .eq("referrer_id", user.id)
        .order("referral_date", { ascending: false })

      if (refError) throw refError
      setReferrals(refs ?? [])
    } catch (error) {
      console.error("Wallet fetch error:", error)
      toast.error("Failed to load wallet data")
    }
  }

  useEffect(() => {
    fetchWalletData()
  }, [user])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`wallet-updates-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          const newData = payload.new as any
          setWalletData({
            wallet_balance: toNumber(newData.wallet_balance),
            created_at: newData.created_at
          })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${user.id}`
        },
        () => fetchWalletData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const handleWithdrawalRequest = async () => {
    if (!user || !walletData) return

    const amountLocal = Number.parseFloat(withdrawAmount)
    if (!Number.isFinite(amountLocal) || amountLocal <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    const amountXAF = convertToXAF(amountLocal, currency)

    if (amountXAF < 3000) {
      toast.error(`Minimum withdrawal amount is ${formatMoney(3000)}`)
      return
    }

    if (amountXAF > walletData.wallet_balance) {
      toast.error("Insufficient balance")
      return
    }

    if (!withdrawMethod || !accountDetails.trim()) {
      toast.error("Please select payment method and enter account details")
      return
    }

    if (!canWithdraw) {
      toast.error("As a new user you need to make at least one month in the app before your first withdrawal request.")
      return
    }

    setIsWithdrawing(true)

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
          method: withdrawMethod,
          accountDetails: accountDetails.trim()
        })
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to submit withdrawal request.")
      }

      toast.success(`Withdrawal request submitted for ${formatMoney(amountXAF)}.`)
      setWithdrawAmount("")
      setWithdrawMethod("")
      setAccountDetails("")
      await fetchWalletData()
    } catch (error: any) {
      console.error("Withdrawal error:", error)
      toast.error(error.message || "Failed to submit withdrawal request.")
    } finally {
      setIsWithdrawing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-400"></div>
      </div>
    )
  }

  if (!user) return null

  const currentBalance = walletData?.wallet_balance || 0
  const depositAmountXAF = depositAmount ? convertToXAF(Number.parseFloat(depositAmount) || 0, currency) : 0
  const withdrawAmountXAF = withdrawAmount ? convertToXAF(Number.parseFloat(withdrawAmount) || 0, currency) : 0

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="cr-backdrop cr-grid"></div>
      <FloatingParticles />
      <div className="relative z-10">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-6 lg:py-8 space-y-6 lg:space-y-8">
          <div className="text-center mb-6 lg:mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold cr-title cr-hero-text mb-2">My Wallet</h1>
            <p className="text-slate-400 text-sm lg:text-base">
              View your earnings, referrals, convert CR to money, and request withdrawals
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
            <div className="xl:col-span-2 space-y-6 lg:space-y-8">
              <WalletBalance wallet={currentBalance} />
              <EarningsConverter />
              <TransactionHistory transactions={transactions} />
            </div>

            <div className="space-y-6 lg:space-y-8">
              <div className="p-6 cr-glass rounded-2xl">
                <h3 className="font-bold text-cyan-200 text-lg mb-2">Deposit</h3>
                <p className="text-slate-400 text-sm mb-4">
                  Add funds using the payment methods available in your country.
                </p>
                <label className="block text-slate-300 text-sm mb-2">Deposit Amount ({currency})</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(event) => {
                    setDepositAmount(event.target.value)
                    setShowDepositMethods(false)
                  }}
                  placeholder="Enter amount"
                  min="1"
                  className="w-full px-4 py-3 bg-slate-900/70 border border-slate-700 rounded-2xl text-white focus:outline-none focus:border-cyan-500"
                />
                <Button
                  className="mt-4 w-full cr-button text-slate-950"
                  disabled={!depositAmount || depositAmountXAF <= 0}
                  onClick={() => setShowDepositMethods(true)}
                >
                  Continue to Payment
                </Button>

                {showDepositMethods && depositAmountXAF > 0 && (
                  <div className="mt-4">
                    <PaymentSelector
                      amountXAF={depositAmountXAF}
                      description="Wallet deposit"
                      purpose="wallet_deposit"
                      onSuccess={() => {
                        setDepositAmount("")
                        setShowDepositMethods(false)
                        fetchWalletData()
                        toast.success("Deposit confirmed")
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="p-6 cr-glass rounded-2xl">
                <h3 className="font-bold text-cyan-200 text-lg mb-2">Withdrawals</h3>
                <p className="text-slate-400 text-sm mb-4">
                  Withdrawals are available once you have completed 1 month on the platform. Requests are reviewed by admin.
                </p>

                <div className="bg-slate-900/60 rounded-2xl p-4 mb-4 border border-cyan-400/10">
                  <p className="text-slate-300 text-sm">Available Balance</p>
                  <p className="text-2xl font-bold text-emerald-300">{formatMoney(currentBalance)}</p>
                </div>

                <div className="mb-4">
                  <label className="block text-slate-300 text-sm mb-2">Withdrawal Amount ({currency})</label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(event) => setWithdrawAmount(event.target.value)}
                    placeholder="Enter amount"
                    min={convertXAF(3000)}
                    max={convertXAF(currentBalance)}
                    className="w-full px-4 py-3 bg-slate-900/70 border border-slate-700 rounded-2xl text-white focus:outline-none focus:border-cyan-500"
                  />
                  <div className="text-xs text-slate-400 mt-1">
                    Minimum: {formatMoney(3000)} - Maximum: {formatMoney(currentBalance)}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-slate-300 text-sm mb-2">Payment Method</label>
                  <select
                    value={withdrawMethod}
                    onChange={(event) => setWithdrawMethod(event.target.value)}
                    className="w-full px-4 py-3 bg-slate-900/70 border border-slate-700 rounded-2xl text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select payment method</option>
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-slate-300 text-sm mb-2">Account Details</label>
                  <textarea
                    value={accountDetails}
                    onChange={(event) => setAccountDetails(event.target.value)}
                    placeholder="Enter your account details"
                    className="w-full px-4 py-3 bg-slate-900/70 border border-slate-700 rounded-2xl text-white focus:outline-none focus:border-cyan-500 min-h-[80px]"
                  />
                </div>

                <button
                  className={`w-full px-4 py-3 rounded-lg font-semibold ${
                    canWithdraw ? "cr-button text-slate-950" : "bg-slate-600 text-slate-400 cursor-not-allowed"
                  }`}
                  onClick={handleWithdrawalRequest}
                  disabled={
                    isWithdrawing ||
                    !canWithdraw ||
                    !withdrawAmount ||
                    withdrawAmountXAF < 3000 ||
                    withdrawAmountXAF > currentBalance ||
                    !withdrawMethod ||
                    !accountDetails.trim()
                  }
                >
                  {isWithdrawing ? "Processing..." : canWithdraw ? "Request Withdrawal" : "Withdrawal Locked"}
                </button>

                {!canWithdraw && (
                  <p className="text-xs text-red-400 mt-2">
                    New users must wait 1 month before submitting the first withdrawal request.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 p-6 cr-glass rounded-2xl">
            <h3 className="font-bold text-cyan-200 text-lg mb-4">Your Referrals & Bonuses</h3>
            {referrals.length === 0 ? (
              <p className="text-slate-400">You have no referrals yet.</p>
            ) : (
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs uppercase bg-slate-900/70">
                  <tr>
                    <th className="px-4 py-2">Username</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Bonus</th>
                    <th className="px-4 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((ref) => {
                    const referredUser = firstRelation<any>(ref.referred_user)

                    return (
                      <tr key={ref.id} className="border-b border-slate-800">
                        <td className="px-4 py-2">{referredUser?.username ?? "N/A"}</td>
                        <td className="px-4 py-2">{referredUser?.email ?? "N/A"}</td>
                        <td className="px-4 py-2 font-bold text-emerald-300">{formatMoney(toNumber(ref.bonus))}</td>
                        <td className="px-4 py-2">{formatDate(ref.referral_date)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  )
}
