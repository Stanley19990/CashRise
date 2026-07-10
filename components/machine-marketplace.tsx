// components/machine-marketplace.tsx - UPDATED WITH REFERRAL BONUS TRIGGER
"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Zap, TrendingUp, Star, Clock, DollarSign, Cpu, BarChart3, Calendar, CircuitBoard } from "lucide-react"
import { toast } from "sonner"
import { PaymentModal } from "@/components/payment-modal"
import { supabase } from "@/lib/supabase"
import { asArray, safeStorageGet, safeStorageSet, toNumber } from "@/lib/safe-data"
import { useCurrency } from "@/contexts/CurrencyContext"

interface MachineType {
  id: string
  name: string
  price: number
  daily_earnings: number
  monthly_earnings: number
  description: string
  features: string[]
  image_query: string
  is_available: boolean
  gradient: string
  image_url?: string
}

interface MachineMarketplaceProps {
  onPurchaseSuccess?: () => void;
}

export function MachineMarketplace({ onPurchaseSuccess }: MachineMarketplaceProps) {
  const { user, refreshUser } = useAuth()
  const { formatMoney } = useCurrency()
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedMachine, setSelectedMachine] = useState<MachineType | null>(null)
  const [databaseMachines, setDatabaseMachines] = useState<MachineType[]>([])
  const [imagesLoaded, setImagesLoaded] = useState<Record<string, boolean>>({})
  const [imagesFailed, setImagesFailed] = useState<Record<string, boolean>>({})
  const [userMachines, setUserMachines] = useState<string[]>([])

  // ✅ FIX: Track active payment for status polling
  const [activePaymentTransId, setActivePaymentTransId] = useState<string | null>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const repairRanRef = useRef(false)
  const pendingStorageKey = user ? `pending_payment_${user.id}` : null

  // Fetch machines from database
  const fetchMachinesFromDatabase = async () => {
    try {
      const { data, error } = await supabase
        .from('machine_types')
        .select('*')
        .order('id')

      if (error) throw error

      if (data && data.length > 0) {
        setDatabaseMachines(data)
        // Preload images
        data.forEach(machine => {
          if (isUsableMachineImage(machine.image_url)) {
            const img = new Image()
            img.src = machine.image_url
            img.onload = () => {
              setImagesLoaded(prev => ({ ...prev, [machine.id]: true }))
            }
            img.onerror = () => {
              setImagesFailed(prev => ({ ...prev, [machine.id]: true }))
            }
          }
        })
      }
    } catch (error) {
      console.error('Error fetching machines:', error)
    }
  }

  // Fetch user's owned machines
  const fetchUserMachines = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('user_machines')
        .select('machine_type_id')
        .eq('user_id', user.id)

      if (error) throw error
      const ownedMachineIds = data?.map(m => m.machine_type_id) || []
      setUserMachines(ownedMachineIds)
    } catch (error) {
      console.error('Error fetching user machines:', error)
    }
  }

  useEffect(() => {
    fetchMachinesFromDatabase()
    if (user) {
      fetchUserMachines()
      try {
        const stored = pendingStorageKey ? safeStorageGet(window.localStorage, pendingStorageKey) : null
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed?.transId) {
            setActivePaymentTransId(parsed.transId)
          }
        }
      } catch {
        // ignore storage errors
      }
      if (!repairRanRef.current) {
        repairRanRef.current = true
        supabase.auth.getSession().then(({ data: sessionData }) => fetch("/api/machines/repair", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
          },
          body: JSON.stringify({ userId: user.id })
        }))
          .then(() => fetchUserMachines())
          .catch(() => null)
      }
    }
  }, [user])

  useEffect(() => {
    if (!user || !activePaymentTransId) return
    const handleVisibility = async () => {
      if (document.visibilityState === "visible") {
        const { data: sessionData } = await supabase.auth.getSession()
        fetch('/api/payments/reconcile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
          },
          body: JSON.stringify({ transId: activePaymentTransId })
        }).catch(() => null)
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [user, activePaymentTransId])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`user-machines-market-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_machines",
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchUserMachines()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // ✅ FIX: Poll for payment status when there's an active payment
  useEffect(() => {
    if (!activePaymentTransId || !user) {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }
      return
    }

    console.log('🔄 Starting payment status polling for:', activePaymentTransId)
    const interval = setInterval(async () => {
      await checkPaymentStatus(activePaymentTransId)
    }, 3000) // Poll every 3 seconds

    setPollingInterval(interval)

    // Stop polling after 10 minutes to allow user to confirm payment
    const timeout = setTimeout(() => {
      if (interval) clearInterval(interval)
      setActivePaymentTransId(null)
      setPurchasing(null)
      if (pendingStorageKey) localStorage.removeItem(pendingStorageKey)
      toast.info("Payment verification timed out. We'll keep checking when you return.")
    }, 10 * 60 * 1000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [activePaymentTransId, user])

  // ✅ UPDATED: Check payment status via transaction lookup with referral bonus trigger
  const checkPaymentStatus = async (transId: string) => {
    if (!user) return

    try {
      const { data: transaction, error } = await supabase
        .from('transactions')
        .select('status, metadata, user_id')
        .eq('fapshi_trans_id', transId)
        .maybeSingle()

      if (error) {
        console.error('Error checking payment status:', error)
      }

      let paymentStatus = transaction?.status
      let paymentUserId = transaction?.user_id || user.id

      if (!paymentStatus || paymentStatus === 'pending' || paymentStatus === 'created') {
        const { data: sessionData } = await supabase.auth.getSession()
        const reconcileResponse = await fetch('/api/payments/reconcile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
          },
          body: JSON.stringify({ transId })
        }).catch(() => null)

        if (reconcileResponse?.ok) {
          const reconcileResult = await reconcileResponse.json()
          paymentStatus = reconcileResult.status || paymentStatus
        }
      }

      console.log('📊 Payment status:', paymentStatus)

      if (paymentStatus === 'successful') {
        // Payment successful - stop polling and refresh
        console.log('✅ Payment confirmed successful!')
        
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }
        setActivePaymentTransId(null)
        setPurchasing(null)
        if (pendingStorageKey) localStorage.removeItem(pendingStorageKey)

        // Ensure machine is present even if webhook is delayed
        const { data: sessionData } = await supabase.auth.getSession()
        await fetch("/api/machines/repair", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
          },
          body: JSON.stringify({ userId: paymentUserId })
        }).catch(() => null)

        // Refresh user machines
        await fetchUserMachines()
        await refreshUser()
        
        toast.success("🎉 Purchase successful! Your machine has been activated.")
        
        if (onPurchaseSuccess) {
          onPurchaseSuccess()
        }
      } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled' || paymentStatus === 'expired') {
        // Payment failed
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }
        setActivePaymentTransId(null)
        setPurchasing(null)
        if (pendingStorageKey) localStorage.removeItem(pendingStorageKey)
        toast.error("❌ Payment failed. Please try again.")
      }
      // If still pending, continue polling
    } catch (error) {
      console.error('Error in checkPaymentStatus:', error)
    }
  }

  // Check if user owns a machine
  const userOwnsMachine = (machineId: string) => {
    return userMachines.includes(machineId)
  }

  // Get gradient classes
  const getGradientClasses = (gradientType: string) => {
    const gradients: Record<string, { bg: string; border: string; button: string }> = {
      "blue-cyan": {
        bg: "from-cyan-500 to-emerald-500",
        border: "border-cyan-400/30",
        button: "from-cyan-400 to-emerald-400"
      },
      "purple-pink": {
        bg: "from-indigo-500 to-fuchsia-500",
        border: "border-fuchsia-400/30",
        button: "from-indigo-400 to-fuchsia-400"
      },
      "green-emerald": {
        bg: "from-emerald-500 to-teal-500",
        border: "border-emerald-400/30",
        button: "from-emerald-400 to-teal-400"
      },
      "orange-red": {
        bg: "from-amber-500 to-orange-500",
        border: "border-amber-400/30",
        button: "from-amber-400 to-orange-400"
      }
    }
    return gradients[gradientType] || gradients["blue-cyan"]
  }

  // Handle purchase click
  const handlePurchaseClick = (machineId: string) => {
    if (!user) {
      toast.error("Please log in to purchase machines")
      return
    }

    // ✅ FIX: Prevent multiple simultaneous purchases
    if (purchasing) {
      toast.info("Please wait for your current purchase to complete")
      return
    }

    const machine = databaseMachines.find((m) => m.id === machineId)
    if (!machine) {
      toast.error("Machine not found. Please try again.")
      return
    }

    // Check if already owned
    if (userOwnsMachine(machineId)) {
      toast.info("You already own this machine")
      return
    }

    setSelectedMachine(machine)
    setPaymentModalOpen(true)
  }

  // ✅ FIX: Handle payment success with polling
  const handlePaymentSuccess = async (transId: string, externalId: string, provider: "fapshi" | "futurapay" = "fapshi") => {
    console.log('Payment initiated:', { transId, externalId })
    
    setPaymentModalOpen(false)
    setSelectedMachine(null)

    if (provider === "futurapay") {
      setPurchasing(null)
      await fetchUserMachines()
      await refreshUser()
      if (onPurchaseSuccess) {
        onPurchaseSuccess()
      }
      toast.success("Purchase confirmed! Your machine will appear once payment processing finishes.")
      return
    }

    if (pendingStorageKey) {
      safeStorageSet(
        window.localStorage,
        pendingStorageKey,
        JSON.stringify({ transId, externalId, mode: "direct-pay", createdAt: Date.now() })
      )
    }

    toast.success("Payment request sent! Please complete on your phone.")
    toast.info("We'll automatically update when payment is confirmed")
    
    // Start polling for payment status
    setActivePaymentTransId(transId)
    setPurchasing(selectedMachine?.id || null)
  }

  const getMachineIcon = (index: number) => {
    const icons = [Zap, Cpu, Star, TrendingUp, DollarSign, BarChart3]
    const IconComponent = icons[index % icons.length]
    return <IconComponent className="h-8 w-8 text-white" />
  }

  const isUsableMachineImage = (imageUrl?: string) => {
    return Boolean(imageUrl && !imageUrl.includes("/placeholder.svg"))
  }

  // Calculate ROI period in days
  const calculateROI = (price: number, dailyEarnings: number) => {
    if (dailyEarnings === 0) return "N/A"
    return Math.ceil(price / dailyEarnings)
  }

  if (!user) return null
// ✅ 5% DISCOUNT LOGIC
const getDiscountedPrice = (price: number) => {
  const discountMachines = [50000, 100000, 150000]
  if (discountMachines.includes(price)) {
    return Math.round(price * 0.95)
  }
  return price
}

const isDiscounted = (price: number) => {
  return [50000, 100000, 150000].includes(price)
}

  return (
    <>
      <Card className="cr-glass border border-cyan-400/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ShoppingCart className="h-6 w-6 text-emerald-300" />
            <span className="text-2xl text-white">CashRise Machine Marketplace</span>
          </CardTitle>
          <p className="text-slate-400 text-base mt-2">
            Purchase AI-powered gaming machines with ultra-realistic 4K animations that automatically watch ads and grow your earnings 24/7.
          </p>
          
          {/* ✅ FIX: Show polling indicator */}
          {activePaymentTransId && (
            <div className="mt-2 flex items-center space-x-2 text-sm text-cyan-200">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-400"></div>
              <span>Waiting for payment confirmation...</span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {databaseMachines.map((machine, index) => {
              const isImageLoaded = imagesLoaded[machine.id]
              const hasDatabaseImage = isUsableMachineImage(machine.image_url) && !imagesFailed[machine.id]
              const gradient = getGradientClasses(machine.gradient || "blue-cyan")
              const owned = userOwnsMachine(machine.id)
              const machinePrice = toNumber(machine.price)
              const dailyEarnings = toNumber(machine.daily_earnings)
              const monthlyEarnings = toNumber(machine.monthly_earnings)
              const machineFeatures = asArray<string>(machine.features)
              const roiDays = calculateROI(machinePrice, dailyEarnings)
              const isProcessing = purchasing === machine.id

              return (
                <Card
                  key={machine.id}
                  className={`cr-glass cr-card-3d transition-all duration-300 ${
                    !machine.is_available ? "opacity-90" : ""
                  } ${isProcessing ? "border-cyan-400/60 shadow-[0_0_30px_rgba(55,199,255,0.35)]" : ""}`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <CardTitle className="text-xl text-white font-bold">{machine.name}</CardTitle>
                      {!machine.is_available ? (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/20 text-amber-300 border-0 font-bold text-sm px-3 py-1"
                        >
                          Coming Soon
                        </Badge>
                      ) : owned ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/20 text-emerald-300 border-0 font-bold text-sm px-3 py-1"
                        >
                          Owned
                        </Badge>
                      ) : isProcessing ? (
                        <Badge
                          variant="secondary"
                          className="bg-cyan-500/20 text-cyan-200 border-0 font-bold text-sm px-3 py-1 animate-pulse"
                        >
                          Processing...
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className={`bg-gradient-to-r ${gradient.button} text-white border-0 font-bold text-sm px-3 py-1`}
                        >
                          {roiDays} days ROI
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Machine Image */}
                    <div
                      className={`aspect-square bg-gradient-to-br ${gradient.bg} rounded-2xl flex items-center justify-center relative overflow-hidden shadow-[0_18px_40px_rgba(0,0,0,0.4)] transform transition-transform duration-500 hover:scale-105 hover:rotate-1`}
                    >
                      <div className="absolute inset-0 bg-black/10"></div>
                      {hasDatabaseImage ? (
                        <>
                          {!isImageLoaded && (
                            <div className="absolute inset-0 bg-slate-800 animate-pulse flex items-center justify-center">
                              <CircuitBoard className="h-12 w-12 text-slate-600" />
                            </div>
                          )}
                          <img
                            src={machine.image_url}
                            alt={machine.name}
                            className={`w-full h-full object-cover rounded-xl transition-all duration-500 ${
                              isImageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                            } hover:scale-110 hover:rotate-1`}
                            onLoad={() => setImagesLoaded(prev => ({ ...prev, [machine.id]: true }))}
                            onError={() => setImagesFailed(prev => ({ ...prev, [machine.id]: true }))}
                          />
                        </>
                      ) : (
                        <div className="relative flex h-full w-full items-center justify-center">
                          <div className="absolute h-[72%] w-[72%] rounded-full border border-white/20"></div>
                          <div className="absolute h-[54%] w-[54%] rounded-full border border-white/15"></div>
                          <div className="absolute inset-x-8 top-8 h-1 rounded-full bg-white/30 blur-sm"></div>
                          <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl border border-white/25 bg-slate-950/45 shadow-[0_0_45px_rgba(255,255,255,0.22)]">
                            <CircuitBoard className="h-16 w-16 text-white" />
                          </div>
                          <div className="absolute bottom-8 left-1/2 h-10 w-32 -translate-x-1/2 rounded-full bg-black/30 blur-xl"></div>
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <div
                          className={`w-3 h-3 ${
                            !machine.is_available
                              ? "bg-amber-400"
                              : owned
                              ? "bg-emerald-400"
                              : isProcessing
                              ? "bg-cyan-400"
                              : "bg-emerald-300"
                          } rounded-full animate-pulse shadow-lg`}
                        ></div>
                      </div>
                      <div className="absolute bottom-3 left-3">
                        <div className={`p-2 bg-gradient-to-r ${gradient.button} rounded-lg shadow-lg`}>
                          {getMachineIcon(index)}
                        </div>
                      </div>
                    </div>

                    {/* Description & Features */}
                    <div>
                      <p className="text-sm text-slate-300 leading-relaxed mb-3">{machine.description}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {machineFeatures.map((feature, idx) => (
                          <div key={idx} className="flex items-center space-x-2 text-xs text-slate-400">
                            <div className={`w-1.5 h-1.5 bg-gradient-to-r ${gradient.button} rounded-full`}></div>
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Earnings Information */}
                    <div className="bg-slate-900/60 rounded-2xl p-4 space-y-3 border border-cyan-400/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-emerald-300" />
                          <span className="text-sm text-slate-300">Daily Earnings</span>
                        </div>
                        <span className="text-lg font-bold text-emerald-300">
                          {formatMoney(dailyEarnings)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-cyan-300" />
                          <span className="text-sm text-slate-300">Monthly Earnings</span>
                        </div>
                        <span className="text-lg font-bold text-cyan-300">
                          {formatMoney(monthlyEarnings)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="h-4 w-4 text-amber-300" />
                          <span className="text-sm text-slate-300">ROI Period</span>
                        </div>
                        <span className="text-sm font-bold text-amber-300">{roiDays} Days</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      {/* Price Display */}
                      <div className="text-center bg-slate-900/60 rounded-2xl p-4 border border-cyan-400/10">
{isDiscounted(machinePrice) ? (
  <>
    <div className="text-lg text-rose-300 line-through">
      {formatMoney(machinePrice)}
    </div>
    <div className="text-3xl font-bold text-emerald-300 mb-1">
      {formatMoney(getDiscountedPrice(machinePrice))}
    </div>
    <div className="text-xs text-amber-300 font-bold animate-pulse">
      🔥 5% NEW YEAR DISCOUNT
    </div>
  </>
) : (
  <div className="text-3xl font-bold text-white mb-1">
    {formatMoney(machinePrice)}
  </div>
)}
                        <div className="text-sm text-slate-400">One-time payment</div>
                      </div>

                      {/* Purchase Button */}
                      {owned ? (
                        <Button
                          disabled
                          className="w-full bg-green-500/20 text-green-400 border-green-500/30 font-bold text-lg py-6 shadow-lg"
                        >
                          ✓ Already Owned
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handlePurchaseClick(machine.id)}
                          disabled={!machine.is_available || isProcessing || !!purchasing}
                          className={`w-full bg-gradient-to-r ${gradient.button} hover:opacity-90 disabled:opacity-50 font-bold text-lg py-6 shadow-lg transition-all duration-200 hover:scale-105 text-slate-950`}
                        >
                          {!machine.is_available ? (
                            "Coming Soon"
                          ) : isProcessing ? (
                            <div className="flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Processing Payment...</span>
                            </div>
                          ) : purchasing ? (
                            "Please Wait..."
                          ) : (
                            <div className="flex items-center space-x-2">
                              <ShoppingCart className="h-5 w-5" />
                              <span>Buy Now</span>
                            </div>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Empty State */}
          {databaseMachines.length === 0 && (
            <div className="text-center py-12">
              <div className="bg-slate-800/50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="h-10 w-10 text-slate-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-300 mb-2">No Machines Available</h3>
              <p className="text-slate-400">Check back later for new AI gaming machines.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal */}
      {selectedMachine && (
        <PaymentModal
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          machine={selectedMachine}
          user={{
            id: user.id,
            email: user.email || "",
            name: user.user_metadata?.full_name || user.user_metadata?.username || "User",
            phone: user.user_metadata?.phone || ""
          }}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </>
  )
}
