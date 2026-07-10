"use client"

import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { WalletOverview } from "@/components/wallet-overview"
import { MachineMarketplace } from "@/components/machine-marketplace"
import { MyMachines } from "@/components/my-machines"
import { EarningsChart } from "@/components/earnings-chart"
import { FloatingParticles } from "@/components/floating-particles"
import { Toaster, toast } from "sonner"
import { supabase } from "@/lib/supabase"
import PromoModal from "@/components/PromoModal"
import WeeklyReferralModal from "@/components/WeeklyReferralModal"
import { firstRelation, formatDate, formatNumber, toNumber } from "@/lib/safe-data"
import { useCurrency } from "@/contexts/CurrencyContext"

// Define types
interface ReferredUser {
  username: string;
  email: string;
}

interface Referral {
  id: number;
  referred_id: string;
  bonus: number;
  referral_date: string;
  referred_user: ReferredUser[] | ReferredUser | null;
}

interface MachineEstimate {
  name: string;
  earnings: number;
}

export default function DashboardPage() {
  const { user, loading, refreshUser } = useAuth()
  const { formatMoney } = useCurrency()
  const router = useRouter()
  const [repairTriggered, setRepairTriggered] = useState(false)

  const [referrals, setReferrals] = useState<Referral[]>([])
  const [todaysEarnings, setTodaysEarnings] = useState({
    totalEstimated: 0, 
    machineEstimates: [] as MachineEstimate[],
    machinesCount: 0
  })  
  const [earningsHistory, setEarningsHistory] = useState<any[]>([])

  // Refresh function for child components
  const refreshDashboard = () => {
    fetchReferrals()
    calculateTodaysEarnings()
    fetchEarningsHistory()
    refreshUser()
  }

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.push("/")
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return

    const params = new URLSearchParams(window.location.search)
    const paymentStatus = params.get("payment") || params.get("status")
    const transactionId = params.get("transactionId") || params.get("customer_transaction_id")

    if (!paymentStatus && !transactionId) return

    const normalizedStatus = String(paymentStatus || "").toLowerCase()
    const isSuccess = ["success", "successful", "completed"].includes(normalizedStatus)
    const isFailure = ["failed", "fail", "cancelled", "canceled", "expired"].includes(normalizedStatus)

    const finishRedirect = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const authHeaders: Record<string, string> = {}
      if (sessionData.session?.access_token) {
        authHeaders.Authorization = `Bearer ${sessionData.session.access_token}`
      }

      if (transactionId) {
        await fetch("/api/payments/futurapay/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({ transactionId })
        }).catch(() => null)
      }

      if (isSuccess || transactionId) {
        await fetch("/api/machines/repair", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({ userId: user.id })
        }).catch(() => null)

        refreshDashboard()
      }
    }

    if (isSuccess) {
      toast.success("Payment successful. Your account is being updated.")
      finishRedirect()
    } else if (isFailure) {
      toast.error("Payment was not completed. Please try again.")
    } else if (transactionId) {
      toast.info("Checking your payment status...")
      finishRedirect()
    }

    params.delete("payment")
    params.delete("status")
    params.delete("transactionId")
    params.delete("customer_transaction_id")
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`
    window.history.replaceState({}, "", cleanUrl)
  }, [user])

  useEffect(() => {
    if (user) {
      // Load data in parallel
      Promise.all([
        fetchReferrals(),
        calculateTodaysEarnings(),
        fetchEarningsHistory()
      ])
    }
  }, [user])

  useEffect(() => {
    if (!user || repairTriggered) return
    setRepairTriggered(true)
    supabase.auth.getSession().then(({ data: sessionData }) => fetch("/api/machines/repair", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
      },
      body: JSON.stringify({ userId: user.id })
    })).catch(() => null)
  }, [user, repairTriggered])

  // Fetch referrals
  const fetchReferrals = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from("referrals")
        .select(`
          id,
          referred_id,
          bonus,
          referral_date,
          referred_user:users!referrals_referred_id_fkey(username,email)
        `)
        .eq("referrer_id", user.id)
        .order("referral_date", { ascending: false })

      if (error) throw error
      setReferrals(data as Referral[] ?? [])
    } catch (err: any) {
      console.error("Referrals fetch error:", err)
    }
  }

  // Calculate today's earnings
  const calculateTodaysEarnings = async () => {
    if (!user) return

    try {
      const { data: userMachines, error } = await supabase
        .from('user_machines')
        .select(`
          machine_type_id,
          machine_types (
            daily_earnings,
            monthly_earnings,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (error) throw error

      let totalEstimated = 0
      const machineEstimates: MachineEstimate[] = []

      userMachines?.forEach((um: any) => {
        const machineData = firstRelation<any>(um.machine_types)
        const dailyEarning = toNumber(machineData?.daily_earnings)
        totalEstimated += dailyEarning
        machineEstimates.push({
          name: machineData?.name || 'Unknown Machine',
          earnings: dailyEarning
        })
      })

      setTodaysEarnings({
        totalEstimated,
        machineEstimates,
        machinesCount: machineEstimates.length
      })
    } catch (error: any) {
      console.error('Earnings calculation error:', error)
      setTodaysEarnings({
        totalEstimated: 0,
        machineEstimates: [],
        machinesCount: 0
      })
    }
  }

  const fetchEarningsHistory = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, amount, description, created_at, metadata")
        .eq("user_id", user.id)
        .eq("type", "mining_earnings")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(5)

      if (error) throw error
      setEarningsHistory(data || [])
    } catch (error) {
      console.error("Earnings history fetch error:", error)
      setEarningsHistory([])
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="cr-backdrop cr-grid"></div>
      <FloatingParticles />
      {/* 🔥 Weekly Referral Modal - Shows first */}
      <WeeklyReferralModal />
      
      {/* 🔥 DISCOUNT POPUP */}
      <PromoModal
        title="🔥 5% Discount Available!"
        message="50K, 100K and 150K machines are now discounted. Limited time offer."
        type="discount"
      />


      <div className="relative z-10">
        <DashboardHeader />

        <main className="container mx-auto px-4 py-6 lg:py-8 space-y-6 lg:space-y-8">
          {/* Wallet Section with ID for scrolling */}
          <div id="wallet-section">
            <WalletOverview />
          </div>

          <div className="space-y-6 lg:space-y-8">
            <MachineMarketplace onPurchaseSuccess={refreshDashboard} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
              <div className="xl:col-span-2 space-y-6">
                <EarningsChart />
                
                <div className="cr-glass rounded-2xl p-6">
                  <h3 className="font-bold text-cyan-200 text-lg mb-4">Recent Earnings</h3>
                  {earningsHistory.length === 0 ? (
                    <p className="text-slate-400">No earnings recorded yet. Claim from an active machine once its 24-hour cycle is complete.</p>
                  ) : (
                    <div className="space-y-3">
                      {earningsHistory.map((earning) => (
                        <div key={earning.id} className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-cyan-400/10">
                          <div>
                            <p className="text-white font-medium">{earning.metadata?.machine_name || earning.description || 'Machine claim'}</p>
                            <p className="text-slate-400 text-sm">{formatDate(earning.created_at)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-green-400 font-bold">+{formatMoney(toNumber(earning.amount))}</p>
                            <p className="text-slate-400 text-sm">Daily earnings</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-6">
                <MyMachines onRefresh={refreshDashboard} />
                
                {todaysEarnings?.machineEstimates && todaysEarnings.machineEstimates.length > 0 && (
                  <div className="cr-glass rounded-2xl p-6">
                    <h3 className="font-bold text-cyan-200 text-lg mb-4">Today's Machine Earnings</h3>
                    <div className="space-y-3">
                      {todaysEarnings.machineEstimates.map((machine, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-slate-300 text-sm">{machine.name}</span>
                          <span className="text-green-400 font-bold">+{formatMoney(machine.earnings)}</span>
                        </div>
                      ))}
                      <div className="border-t border-slate-700/70 pt-2 mt-2">
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-cyan-300">Total</span>
                          <span className="text-green-400">+{formatMoney(todaysEarnings.totalEstimated)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Referrals Table */}
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
                    <th className="px-4 py-2">Bonus (CR)</th>
                    <th className="px-4 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((ref) => (
                    <tr key={ref.id} className="border-b border-slate-700">
                      <td className="px-4 py-2">{firstRelation<ReferredUser>(ref.referred_user)?.username ?? "N/A"}</td>
                      <td className="px-4 py-2">{firstRelation<ReferredUser>(ref.referred_user)?.email ?? "N/A"}</td>
                      <td className="px-4 py-2 font-bold">{formatNumber(ref.bonus)}</td>
                      <td className="px-4 py-2">{formatDate(ref.referral_date)}</td>
                    </tr>
                  ))}
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
