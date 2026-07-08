// app/referrals/page.tsx
"use client"

import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { FloatingParticles } from "@/components/floating-particles"
import { Toaster, toast } from "sonner"
import { Copy, DollarSign, Users, TrendingUp, CheckCircle, Clock, Share2, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { firstRelation, formatDate, formatNumber, toNumber } from "@/lib/safe-data"

interface ReferralStats {
  totalReferrals: number
  totalBonusEarned: number
  pendingReferrals: number
  referrals: any[]
}

export default function ReferralsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [referralStats, setReferralStats] = useState<ReferralStats>({
    totalReferrals: 0,
    totalBonusEarned: 0,
    pendingReferrals: 0,
    referrals: []
  })
  const [referralCode, setReferralCode] = useState("")
  const [pageLoading, setPageLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [purchasedReferrals, setPurchasedReferrals] = useState<Record<string, boolean>>({})

  const REFERRAL_BONUS = 1000

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/")
      return
    }
    
    if (user && !authLoading) {
      loadReferralData()
    }
  }, [user, authLoading, router])

  const generateReferralCode = async (userId: string, username: string): Promise<string> => {
    const cleanUsername = (username || 'user').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 8)
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `${cleanUsername}${randomStr}`
  }

  const loadReferralData = async () => {
    if (!user) return
    
    setPageLoading(true)
    try {
      console.log("🔄 Loading referral data for user:", user.id)
      const { data: sessionData } = await supabase.auth.getSession()
      const statsResponse = await fetch("/api/referrals/stats", {
        headers: {
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
        }
      }).catch(() => null)

      if (statsResponse?.ok) {
        const statsResult = await statsResponse.json()
        if (statsResult?.success) {
          const referrals = statsResult.referrals || []
          const totalReferrals = referrals.length
          const totalBonusEarned = referrals.reduce((sum: number, r: any) => sum + toNumber(r.bonus), 0)
          const pendingReferrals = referrals.filter((r: any) => toNumber(r.bonus) === 0).length
          const purchasedMap: Record<string, boolean> = {}

          referrals.forEach((referral: any) => {
            if (referral.referred_id && referral.hasPurchased) {
              purchasedMap[referral.referred_id] = true
            }
          })

          setReferralCode(statsResult.referralCode || "")
          setPurchasedReferrals(purchasedMap)
          setReferralStats({
            totalReferrals,
            totalBonusEarned,
            pendingReferrals,
            referrals
          })
          return
        }
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('referral_code, username')
        .eq('id', user.id)
        .single()

      if (userError) {
        console.error("Error fetching user:", userError)
        const basicCode = await generateReferralCode(user.id, 'user')
        setReferralCode(basicCode)
      } else {
        let code = userData.referral_code
        
        if (!code) {
          code = await generateReferralCode(user.id, userData.username || 'user')
          
          supabase
            .from('users')
            .update({ referral_code: code })
            .eq('id', user.id)
            .then(({ error }) => {
              if (error) {
                console.error("Error updating referral code:", error)
              }
            })
        }

        setReferralCode(code)
      }

      const { data: referrals, error: referralsError } = await supabase
        .from('referrals')
        .select(`
          id,
          referred_id,
          bonus,
          referral_date,
          referred_user:users!referrals_referred_id_fkey(
            username,
            email
          )
        `)
        .eq('referrer_id', user.id)
        .order('referral_date', { ascending: false })

      if (referralsError) {
        console.error("Error fetching referrals:", referralsError)
        setReferralStats({
          totalReferrals: 0,
          totalBonusEarned: 0,
          pendingReferrals: 0,
          referrals: []
        })
      } else {
        console.log("📊 Referrals data:", referrals)

        const totalReferrals = referrals?.length || 0
        const totalBonusEarned = referrals?.reduce((sum: number, r: any) => sum + toNumber(r.bonus), 0) || 0
        const pendingReferrals = referrals?.filter((r: any) => toNumber(r.bonus) === 0).length || 0
        const referredIds = (referrals || []).map((r: any) => r.referred_id).filter(Boolean)
        const purchasedMap: Record<string, boolean> = {}

        if (referredIds.length > 0) {
          const { data: purchasedMachines, error: purchasedError } = await supabase
            .from("user_machines")
            .select("user_id")
            .in("user_id", referredIds)

          if (purchasedError) {
            console.error("Error fetching referral purchase status:", purchasedError)
          } else {
            ;(purchasedMachines || []).forEach((machine: any) => {
              if (machine.user_id) purchasedMap[machine.user_id] = true
            })
          }
        }

        setPurchasedReferrals(purchasedMap)

        setReferralStats({
          totalReferrals,
          totalBonusEarned,
          pendingReferrals,
          referrals: referrals || []
        })
      }

    } catch (error: any) {
      console.error("Failed to load referral data:", error)
      setReferralStats({
        totalReferrals: 0,
        totalBonusEarned: 0,
        pendingReferrals: 0,
        referrals: []
      })
      
      const fallbackCode = await generateReferralCode(user.id, 'user')
      setReferralCode(fallbackCode)
    } finally {
      setPageLoading(false)
    }
  }

  const copyReferralLink = () => {
    if (!referralCode) {
      toast.error("No referral code available")
      return
    }
    
    const referralUrl = `${window.location.origin}/signup?ref=${referralCode}`
    navigator.clipboard.writeText(referralUrl)
    setLinkCopied(true)
    toast.success("Referral link copied!")
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const copyReferralCode = () => {
    if (!referralCode) {
      toast.error("No referral code available")
      return
    }
    
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    toast.success("Referral code copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  const shareViaWhatsApp = () => {
    if (!referralCode) {
      toast.error("No referral code available")
      return
    }
    
    const message = `Join me on CashRise and start earning money with AI gaming machines! Use my referral code: ${referralCode}\n\n${window.location.origin}/signup?ref=${referralCode}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank")
  }

  const getReferralStatus = (referral: any) => {
    if (toNumber(referral.bonus) > 0 || purchasedReferrals[referral.referred_id]) {
      return { 
        status: 'completed', 
        text: toNumber(referral.bonus) > 0 ? 'Bonus Paid' : 'Purchased', 
        color: 'bg-green-500/20 text-green-400', 
        icon: CheckCircle 
      }
    }
    
    return { 
      status: 'pending', 
      text: 'Pending Purchase', 
      color: 'bg-yellow-500/20 text-yellow-400', 
      icon: Clock 
    }
  }

  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-[#070b13]">
        <DashboardHeader />
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <div className="text-center">
            <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-400 animate-spin mx-auto mb-3 sm:mb-4" />
            <p className="text-slate-400 text-sm sm:text-base">Loading referral program...</p>
            <p className="text-slate-500 text-xs sm:text-sm mt-2">This may take a moment</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-400 text-sm sm:text-base">Please log in to view referrals</p>
        </div>
      </div>
    )
  }

  const referralUrl = `${window.location.origin}/signup?ref=${referralCode}`

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="cr-backdrop cr-grid"></div>
      <FloatingParticles />
      <div className="relative z-10">
        <DashboardHeader />

        <main className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8">
          {/* Page Header */}
          <div className="text-center mb-4 sm:mb-6 lg:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold cr-title cr-hero-text mb-2">
              Referral Program
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm lg:text-base px-4">
              Invite friends and earn {REFERRAL_BONUS.toLocaleString()} XAF for each referral when they purchase their first machine
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {/* Left Section: Overview + History */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6 lg:space-y-8">
              {/* Referral Overview */}
              <div className="cr-glass rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
                <h2 className="text-lg sm:text-xl font-bold text-white">Referral Overview</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-2xl p-3 sm:p-4 text-center">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white mx-auto mb-2" />
                    <p className="text-xs sm:text-sm text-slate-200">Total Referrals</p>
                    <p className="text-xl sm:text-2xl font-bold text-white">{referralStats.totalReferrals}</p>
                  </div>
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-3 sm:p-4 text-center">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-white mx-auto mb-2" />
                    <p className="text-xs sm:text-sm text-slate-200">Total Bonus Earned</p>
                    <p className="text-xl sm:text-2xl font-bold text-white">
                      {formatNumber(referralStats.totalBonusEarned)} XAF
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-3 sm:p-4 text-center">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-white mx-auto mb-2" />
                    <p className="text-xs sm:text-sm text-slate-200">Pending Bonus</p>
                    <p className="text-xl sm:text-2xl font-bold text-white">{referralStats.pendingReferrals}</p>
                  </div>
                </div>
              </div>

              {/* How It Works */}
              <div className="cr-glass rounded-2xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">How It Works</h2>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <div className="bg-emerald-400 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-slate-900 text-xs sm:text-sm font-bold mt-0.5 flex-shrink-0">
                      1
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm sm:text-base">Share your referral link</p>
                      <p className="text-slate-400 text-xs sm:text-sm">Send your unique link to friends and family</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <div className="bg-emerald-400 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-slate-900 text-xs sm:text-sm font-bold mt-0.5 flex-shrink-0">
                      2
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm sm:text-base">Friend signs up and buys a machine</p>
                      <p className="text-slate-400 text-xs sm:text-sm">Your friend must purchase at least one machine</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <div className="bg-emerald-400 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-slate-900 text-xs sm:text-sm font-bold mt-0.5 flex-shrink-0">
                      3
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm sm:text-base">Get {REFERRAL_BONUS.toLocaleString()} XAF instantly</p>
                      <p className="text-slate-400 text-xs sm:text-sm">We automatically credit {REFERRAL_BONUS.toLocaleString()} XAF to your wallet when they make their first purchase</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Referral History Table */}
              <div className="cr-glass rounded-2xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Referral History</h2>
                {referralStats.referrals.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <Users className="h-10 w-10 sm:h-12 sm:w-12 text-slate-600 mx-auto mb-3 sm:mb-4" />
                    <p className="text-slate-400 text-sm sm:text-base">No referrals yet. Share your link to start earning!</p>
                    <p className="text-xs text-slate-500 mt-2 px-4">
                      When someone signs up with your referral link, they'll appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="overflow-hidden">
                        <table className="min-w-full text-left text-xs sm:text-sm text-slate-200">
                          <thead>
                            <tr>
                              <th className="py-2 sm:py-3 px-2 sm:px-4 border-b border-slate-700 whitespace-nowrap">Referred User</th>
                              <th className="py-2 sm:py-3 px-2 sm:px-4 border-b border-slate-700 whitespace-nowrap">Status</th>
                              <th className="py-2 sm:py-3 px-2 sm:px-4 border-b border-slate-700 whitespace-nowrap">Bonus</th>
                              <th className="py-2 sm:py-3 px-2 sm:px-4 border-b border-slate-700 whitespace-nowrap hidden sm:table-cell">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {referralStats.referrals.map((referral) => {
                              const statusInfo = getReferralStatus(referral)
                              const StatusIcon = statusInfo.icon
                              const referredUser = firstRelation<any>(referral.referred_user)
                              const bonus = toNumber(referral.bonus)
                              
                              return (
                                <tr key={referral.id} className="hover:bg-slate-800/40 border-b border-slate-800/60">
                                  <td className="py-2 sm:py-3 px-2 sm:px-4">
                                    <div>
                                      <p className="font-medium text-white text-xs sm:text-sm">
                                        {referredUser?.username || 'New User'}
                                      </p>
                                      <p className="text-xs text-slate-400 truncate max-w-[120px] sm:max-w-none">
                                        {referredUser?.email || `User ID: ${referral.referred_id?.substring(0, 8) || 'Unknown'}...`}
                                      </p>
                                    </div>
                                  </td>
                                  <td className="py-2 sm:py-3 px-2 sm:px-4">
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                      <StatusIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                      <div>
                                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${statusInfo.color} whitespace-nowrap`}>
                                          {statusInfo.text}
                                        </span>
                                        {referral.purchasedAt && (
                                          <p className="mt-1 text-[10px] text-slate-500">
                                            Purchased {formatDate(referral.purchasedAt)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2 sm:py-3 px-2 sm:px-4">
                                    <span className={`font-semibold text-xs sm:text-sm whitespace-nowrap ${
                                      bonus > 0 ? 'text-emerald-300' : 'text-slate-400'
                                    }`}>
                                      {bonus > 0 ? `${formatNumber(bonus)} XAF` : '0 XAF'}
                                    </span>
                                  </td>
                                  <td className="py-2 sm:py-3 px-2 sm:px-4 hidden sm:table-cell text-xs sm:text-sm">
                                    {formatDate(referral.referral_date)}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Section: Referral Tools */}
            <div className="space-y-4 sm:space-y-6 lg:space-y-8">
              {/* Referral Code Card */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 space-y-3 sm:space-y-4">
                <h2 className="text-lg sm:text-xl font-bold text-white">Your Referral Code</h2>
                <div className="bg-slate-900 rounded-lg p-3 sm:p-4 text-center">
                  <div className="text-xl sm:text-2xl font-bold text-cyan-400 font-mono break-all">
                    {referralCode || "Loading..."}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-2">
                    Share this code with friends
                  </p>
                </div>
                <button
                  onClick={copyReferralCode}
                  disabled={!referralCode}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 sm:py-3 rounded-lg transition-all duration-200 flex items-center justify-center text-sm sm:text-base"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      Copy Referral Code
                    </>
                  )}
                </button>
              </div>

              {/* Referral Link Card */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 space-y-3 sm:space-y-4">
                <h2 className="text-lg sm:text-xl font-bold text-white">Your Referral Link</h2>
                <p className="text-slate-400 text-xs sm:text-sm">
                  Share this link with friends. You earn <strong>{REFERRAL_BONUS.toLocaleString()} XAF</strong> when they purchase their first machine.
                </p>
                <div className="flex items-center bg-slate-900 rounded-lg p-2 sm:p-3 space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={referralUrl}
                    className="flex-1 bg-transparent text-slate-200 focus:outline-none text-xs sm:text-sm truncate"
                    placeholder={referralCode ? "" : "Loading referral code..."}
                  />
                  <button
                    onClick={copyReferralLink}
                    disabled={!referralCode}
                    className="bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded-lg text-white transition-colors flex-shrink-0"
                  >
                    {linkCopied ? <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" /> : <Copy className="w-3 h-3 sm:w-4 sm:h-4" />}
                  </button>
                </div>
                <button
                  onClick={shareViaWhatsApp}
                  disabled={!referralCode}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 sm:py-3 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 text-sm sm:text-base"
                >
                  <Share2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Share via WhatsApp</span>
                </button>
              </div>

              {/* Important Notes */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                <h3 className="font-bold text-white mb-2 sm:mb-3 text-sm sm:text-base">Important Notes</h3>
                <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-slate-400">
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-1.5 flex-shrink-0"></div>
                    <span>You only get credited when your referral purchases their FIRST machine</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-1.5 flex-shrink-0"></div>
                    <span>Bonus is credited automatically within minutes of purchase</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-1.5 flex-shrink-0"></div>
                    <span>Each referral can only be counted once</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-1.5 flex-shrink-0"></div>
                    <span>No limit on how many people you can refer</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-1.5 flex-shrink-0"></div>
                    <span>Referral bonus: {REFERRAL_BONUS.toLocaleString()} XAF per successful referral</span>
                  </li>
                </ul>
              </div>

              {/* Bonus Info Card */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4 sm:p-6">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-bold text-purple-400 mb-2">{REFERRAL_BONUS.toLocaleString()} XAF</div>
                  <div className="text-xs sm:text-sm text-purple-300">Per Successful Referral</div>
                  <div className="text-xs text-slate-400 mt-2">
                    That's approximately ${(REFERRAL_BONUS / 600).toFixed(2)} USD per referral!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Toaster position="top-right" />
    </div>
  )
}
