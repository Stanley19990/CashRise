// app/verification/step2/page.tsx - FULLY CORRECTED WITH PROPER REFERRAL LINK
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, CheckCircle, Users, Target, AlertCircle, Sparkles, RefreshCw, UserPlus, Cpu, Clock, Loader2, DollarSign, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { VerificationProgress } from "@/components/verification-progress"
import { firstRelation, formatDate, formatNumber, toNumber } from "@/lib/safe-data"
import { useCurrency } from "@/contexts/CurrencyContext"

export default function VerificationStep2() {
  const { user } = useAuth()
  const { formatMoney } = useCurrency()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [verificationData, setVerificationData] = useState<any>(null)
  const [machinePurchaseDays, setMachinePurchaseDays] = useState<number>(0)
  const [hasPurchasedMachine, setHasPurchasedMachine] = useState(false)
  const [statsLoading, setStatsLoading] = useState(true)
  const [referralCode, setReferralCode] = useState<string>("")
  const [referralLinkCopied, setReferralLinkCopied] = useState(false)
  
  // Stats state
  const [stats, setStats] = useState({
    totalReferrals: 0,
    referralsWithMachines: 0,
    completedReferrals: 0,
    userMachines: 0,
    referralDetails: [] as Array<{
      id: string
      email: string
      username: string
      bonus: number
      referral_date: string
      hasPurchasedMachine: boolean
    }>
  })

  // Check machine purchase eligibility and load referral code on load
  useEffect(() => {
    if (user) {
      checkMachinePurchaseEligibility()
      loadVerificationData()
      loadReferralStats()
      loadReferralCode()
    }
  }, [user])

  const checkMachinePurchaseEligibility = async () => {
    if (!user) return
    
    try {
      // Check if user has any machines
      const { data: userMachines, error } = await supabase
        .from('user_machines')
        .select('purchased_at')
        .eq('user_id', user.id)
        .limit(1)

      if (error) throw error

      const hasMachine = userMachines && userMachines.length > 0
      setHasPurchasedMachine(hasMachine)

      if (hasMachine) {
        // Get first machine purchase date
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('first_machine_purchase_date')
          .eq('id', user.id)
          .single()

        if (userError) throw userError

        // Calculate days since first machine purchase
        const purchaseDate = userData?.first_machine_purchase_date || userMachines?.[0]?.purchased_at
        if (purchaseDate) {
          const firstPurchase = new Date(purchaseDate)
          if (Number.isNaN(firstPurchase.getTime())) return
          const now = new Date()
          const diffTime = Math.abs(now.getTime() - firstPurchase.getTime())
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          setMachinePurchaseDays(diffDays)
        }
      }
    } catch (error) {
      console.error("Error checking machine purchase eligibility:", error)
    }
  }

  const loadVerificationData = async () => {
    if (!user) return
    
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('verification_data, referral_code')
        .eq('id', user.id)
        .single()

      if (error) throw error

      setVerificationData(userData.verification_data || {})
    } catch (error) {
      console.error("Error loading verification data:", error)
    }
  }

  const loadReferralCode = async () => {
    if (!user) return
    
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error("Error loading referral code:", error)
        return
      }

      if (userData?.referral_code) {
        setReferralCode(userData.referral_code)
      }
    } catch (error) {
      console.error("Exception loading referral code:", error)
    }
  }

  const loadReferralStats = async () => {
    if (!user) return
    
    setStatsLoading(true)
    setRefreshing(true)
    
    try {
      console.log("🔄 Loading referral stats for user:", user.id)

      // Get user's actual machine count from user_machines table
      const { data: userMachines, error: machinesError } = await supabase
        .from('user_machines')
        .select('id')
        .eq('user_id', user.id)

      if (machinesError) {
        console.error("Error loading user machines:", machinesError)
      }

      const userMachineCount = userMachines?.length || 0
      console.log(`🛠️ Your machine count from user_machines table: ${userMachineCount}`)

      // First, get the user's referral code
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', user.id)
        .single()

      if (userError) throw userError

      // Method 1: Get referrals from referrals table (like your referrals page)
      const { data: referralRecords, error: referralError } = await supabase
        .from('referrals')
        .select(`
          id,
          referred_id,
          bonus,
          referral_date,
          status,
          referred_user:users!referrals_referred_id_fkey(
            email,
            username,
            machines_owned
          )
        `)
        .eq('referrer_id', user.id)
        .order('referral_date', { ascending: false })

      if (referralError) {
        console.error("Error loading from referrals table:", referralError)
        
        // Fallback method: Get referrals from users table using referral_code
        if (userData.referral_code) {
          const { data: directReferrals, error: directError } = await supabase
            .from('users')
            .select('id, email, username, machines_owned, created_at')
            .eq('referred_by', userData.referral_code)
            .order('created_at', { ascending: false })

          if (directError) {
            console.error("Error loading direct referrals:", directError)
            setStats({
              totalReferrals: 0,
              referralsWithMachines: 0,
              completedReferrals: 0,
              userMachines: userMachineCount, // Use actual machine count
              referralDetails: []
            })
            return
          }

          // Process direct referrals
          const referralDetails = directReferrals?.map(ref => ({
            id: ref.id,
            email: ref.email || 'No email',
            username: ref.username || 'User',
            bonus: 0, // We don't know bonus from direct referrals
            referral_date: ref.created_at,
            hasPurchasedMachine: (ref.machines_owned || 0) > 0
          })) || []

          const referralsWithMachines = referralDetails.filter(ref => ref.hasPurchasedMachine).length
          const completedCount = Math.min(referralsWithMachines, 5)

          setStats({
            totalReferrals: referralDetails.length,
            referralsWithMachines,
            completedReferrals: completedCount,
            userMachines: userMachineCount, // Use actual machine count
            referralDetails
          })
          return
        }
        
        setStats({
          totalReferrals: 0,
          referralsWithMachines: 0,
          completedReferrals: 0,
          userMachines: userMachineCount, // Use actual machine count
          referralDetails: []
        })
        return
      }

      console.log(`📊 Found ${referralRecords?.length || 0} referral records`)

      // Process referral records
      const referralDetails = referralRecords?.map(ref => {
        const referredUser = firstRelation<any>(ref.referred_user)
        const bonus = toNumber(ref.bonus)
        const hasBonus = bonus > 0
        const hasMachine = toNumber(referredUser?.machines_owned) > 0 || hasBonus
        
        return {
          id: ref.id,
          email: referredUser?.email || 'No email',
          username: referredUser?.username || 'User',
          bonus,
          referral_date: ref.referral_date,
          hasPurchasedMachine: hasMachine
        }
      }) || []

      // Count referrals with machines (bonus > 0 indicates purchase)
      const referralsWithMachines = referralDetails.filter(ref => ref.hasPurchasedMachine).length
      const completedCount = Math.min(referralsWithMachines, 5)

      console.log(`Referrals with machines: ${referralsWithMachines}`)
      console.log(`Total referrals: ${referralDetails.length}`)
      console.log(`Your machine count: ${userMachineCount}`)

      setStats({
        totalReferrals: referralDetails.length,
        referralsWithMachines,
        completedReferrals: completedCount,
        userMachines: userMachineCount, // Use actual machine count
        referralDetails
      })

    } catch (error) {
      console.error("Error loading referral stats:", error)
      toast.error("Failed to load verification stats")
    } finally {
      setStatsLoading(false)
      setRefreshing(false)
    }
  }

  const calculateProgress = () => {
    const totalRequirements = 2
    let completed = 0

    // Check requirement 1: 10 referrals
    if (stats.totalReferrals >= 10) completed++

    // Check requirement 2: 5+ referrals with machines (2500 XAF minimum)
    if (stats.referralsWithMachines >= 5) completed++

    return {
      completed,
      total: totalRequirements,
      percentage: Math.round((completed / totalRequirements) * 100)
    }
  }

  const checkRequirementsMet = () => {
    const progress = calculateProgress()
    return progress.completed === progress.total
  }

  const handleCompleteStep = async () => {
    if (!user) {
      toast.error("You must be logged in")
      router.push("/login")
      return
    }

    if (!checkRequirementsMet()) {
      toast.error("Please complete all requirements before continuing")
      return
    }

    setLoading(true)
    try {
      // Update verification data
      const { error } = await supabase
        .from('users')
        .update({
          verification_data: {
            ...verificationData,
            support_verification: {
              totalReferrals: stats.totalReferrals,
              referralsWithMachines: stats.referralsWithMachines,
              completedAt: new Date().toISOString(),
              requirements: {
                minReferrals: 10,
                minReferralsWithMachines: 5,
                minMachineValue: 2500
              }
            },
            support_verified: true
          }
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success("Support verification completed!")
      router.push("/verification/step3")
      
    } catch (error) {
      console.error("Error completing support verification:", error)
      toast.error("Failed to save verification data")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveForLater = () => {
    router.push("/dashboard")
    toast.info("You can return to complete verification later")
  }

  const copyReferralLink = async () => {
    if (!referralCode) {
      toast.error("No referral code available")
      return
    }
    
    try {
      const referralLink = `${window.location.origin}/signup?ref=${referralCode}`
      await navigator.clipboard.writeText(referralLink)
      setReferralLinkCopied(true)
      toast.success("Referral link copied to clipboard!")
      setTimeout(() => setReferralLinkCopied(false), 2000)
    } catch (error) {
      console.error("Error copying referral link:", error)
      toast.error("Failed to copy referral link")
    }
  }

  const RequirementCard = ({ 
    title, 
    description, 
    current, 
    required, 
    completed,
    icon: Icon 
  }: {
    title: string
    description: string
    current: number
    required: number
    completed: boolean
    icon: any
  }) => {
    return (
      <Card className={`border ${completed ? 'border-green-500/20 bg-green-500/5' : 'border-slate-700 bg-slate-800/30'}`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className={`p-3 rounded-lg ${completed ? 'bg-green-500/10' : 'bg-slate-700'}`}>
                <Icon className={`h-6 w-6 ${completed ? 'text-green-400' : 'text-slate-400'}`} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-white">{title}</h3>
                  {completed && (
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                      <CheckCircle className="h-3 w-3 mr-1" /> Completed
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-400">{description}</p>
                
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300">
                      Progress: {current} / {required}
                    </span>
                    <span className="text-sm font-medium">
                      {Math.round((current / required) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min((current / required) * 100, 100)} 
                    className="h-2"
                    indicatorClassName={completed ? "bg-green-500" : "bg-cyan-500"}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
        <Card className="w-full max-w-md border-slate-700 bg-slate-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Authentication Required</h3>
              <p className="text-slate-400 mb-4">Please log in to access verification</p>
              <Button onClick={() => router.push("/login")} className="w-full">
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // NEW CHECK: Verify machine purchase eligibility
  if (!hasPurchasedMachine) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-500/20 bg-slate-800/50 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Cpu className="h-10 w-10 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Machine Required</h2>
              <p className="text-slate-300 mb-6">
                You need to purchase at least one AI gaming machine before you can verify your account.
                The 7-day waiting period starts from your first machine purchase.
              </p>
              <div className="space-y-4">
                <Button
                  onClick={() => router.push("/dashboard")}
                  className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600"
                >
                  <Cpu className="h-5 w-5 mr-2" />
                  Browse Machines
                </Button>
                <Button
                  onClick={() => router.push("/")}
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Go Home
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // NEW CHECK: Verify 7-day waiting period
  if (machinePurchaseDays < 7) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-yellow-500/20 bg-slate-800/50 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="bg-yellow-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="h-10 w-10 text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Verification Unlocks Soon</h2>
              <p className="text-slate-300 mb-4">
                You need to wait <span className="text-yellow-400 font-bold">{7 - machinePurchaseDays}</span> more day(s) after purchasing your first machine to verify your account.
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center space-x-2">
                  <div className="text-yellow-400 font-bold text-xl">{machinePurchaseDays}/7</div>
                  <div className="text-slate-300">Days Completed</div>
                </div>
                <div className="w-full bg-slate-600 rounded-full h-2 mt-2">
                  <div 
                    className="bg-gradient-to-r from-yellow-500 to-amber-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(machinePurchaseDays / 7) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Started: {machinePurchaseDays} day(s) ago from first machine purchase
                </p>
              </div>
              <Button
                onClick={() => router.push("/dashboard")}
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const progress = calculateProgress()
  const requirementsMet = checkRequirementsMet()
  const referralLink = referralCode ? `${window.location.origin}/signup?ref=${referralCode}` : ""

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="cr-backdrop cr-grid"></div>
      {/* Header */}
      <div className="border-b border-slate-800/60 bg-slate-950/40 backdrop-blur-xl relative z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-6 w-6 text-cyan-200" />
              <h1 className="text-xl font-bold text-white">Support Verification</h1>
            </div>
            <Button
              variant="ghost"
              onClick={() => router.push("/verification/step1")}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Progress Bar */}
        <VerificationProgress currentStep={2} />

        <div className="max-w-4xl mx-auto">
          {/* IMPORTANT NOTICE */}
          <div className="mb-6">
            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-red-300 mb-1">Fraud Prevention Requirement</h4>
                    <p className="text-sm text-red-200/80">
                      To combat fraud and ensure genuine community support, we require all users to demonstrate 
                      real engagement by inviting supporters who invest in the platform. This maintains trust 
                      and security for all users.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overall Progress */}
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-white">
                <span>Support Verification Progress</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadReferralStats}
                  disabled={refreshing}
                  className="text-slate-400 hover:text-white"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh Stats
                </Button>
              </CardTitle>
              <CardDescription className="text-slate-400">
                Complete these requirements to prove your support for the project and prevent fraud
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 text-cyan-500 animate-spin mr-3" />
                  <span className="text-slate-300">Loading referral data...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-300">Overall Progress</span>
                      <span className="text-sm font-medium text-cyan-400">
                        {progress.completed} of {progress.total} requirements met
                      </span>
                    </div>
                    <Progress 
                      value={progress.percentage} 
                      className="h-3"
                      indicatorClassName="bg-gradient-to-r from-cyan-500 to-purple-500"
                    />
                  </div>

                  {requirementsMet && (
                    <div className="p-4 border border-green-500/20 bg-green-500/5 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                        <div>
                          <h4 className="font-medium text-green-300">All Requirements Met!</h4>
                          <p className="text-sm text-green-200/80">
                            You can now proceed to the next step.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Requirements */}
          <div className="grid gap-6 mb-8">
            <RequirementCard
              title="Invite 10 Friends"
              description="Share your referral link and get 10 people to join. Track progress in your Referrals page."
              current={stats.totalReferrals}
              required={10}
              completed={stats.totalReferrals >= 10}
              icon={UserPlus}
            />

            <RequirementCard
              title="5+ Active Supporters"
              description="Get 5+ referrals to purchase minimum 2500 XAF machines. System automatically detects machine purchases."
              current={stats.referralsWithMachines}
              required={5}
              completed={stats.referralsWithMachines >= 5}
              icon={Target}
            />
          </div>

          {/* Current Referral Status */}
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm mb-8">
            <CardHeader>
              <CardTitle className="text-white">Current Referral Status</CardTitle>
              <CardDescription className="text-slate-400">
                {stats.totalReferrals > 0 
                  ? `You have ${stats.totalReferrals} referrals in the system` 
                  : "No referrals found. Start inviting friends!"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                  <div className="text-2xl font-bold text-white mb-1">{stats.totalReferrals}</div>
                  <div className="text-sm text-slate-400">Total Referrals</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {stats.totalReferrals >= 10 ? '✓ Requirement met' : `${10 - stats.totalReferrals} more needed`}
                  </div>
                </div>
                <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                  <div className="text-2xl font-bold text-white mb-1">{stats.referralsWithMachines}</div>
                  <div className="text-sm text-slate-400">With Machines</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {stats.referralsWithMachines >= 5 ? '✓ Requirement met' : `${5 - stats.referralsWithMachines} more needed`}
                  </div>
                </div>
                <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                  <div className="text-2xl font-bold text-green-400 mb-1">
                    {Math.min(stats.referralsWithMachines, 5)}/5
                  </div>
                  <div className="text-sm text-slate-400">Active Supporters</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {stats.referralsWithMachines >= 5 ? '✓ Minimum reached' : 'Working on it'}
                  </div>
                </div>
                <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                  <div className="text-2xl font-bold text-cyan-400 mb-1">{stats.userMachines}</div>
                  <div className="text-sm text-slate-400">Your Machines</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {machinePurchaseDays >= 7 ? '✓ Eligible' : `${7 - machinePurchaseDays} day(s) left`}
                  </div>
                </div>
              </div>

              {/* Referral Details Table */}
              {stats.referralDetails.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-white mb-3">Your Referrals</h4>
                  <div className="overflow-x-auto border border-slate-700 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800">
                        <tr>
                          <th className="py-2 px-3 text-left text-slate-300">User</th>
                          <th className="py-2 px-3 text-left text-slate-300">Machine Status</th>
                          <th className="py-2 px-3 text-left text-slate-300">Bonus</th>
                          <th className="py-2 px-3 text-left text-slate-300">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.referralDetails.map((ref) => (
                          <tr key={ref.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                            <td className="py-2 px-3">
                              <div>
                                <div className="font-medium text-white">{ref.username}</div>
                                <div className="text-xs text-slate-400 truncate max-w-[150px]">
                                  {ref.email}
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <Badge className={
                                ref.hasPurchasedMachine 
                                  ? "bg-green-500/10 text-green-400 border-green-500/20" 
                                  : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                              }>
                                {ref.hasPurchasedMachine ? '✓ Has Machine' : 'Needs Machine'}
                              </Badge>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center space-x-1">
                                <DollarSign className="h-3 w-3 text-green-400" />
                                <span className={`font-medium ${
                                  ref.bonus > 0 ? 'text-green-400' : 'text-slate-400'
                                }`}>
                                  {ref.bonus > 0 ? formatMoney(toNumber(ref.bonus)) : 'Pending'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-slate-400">
                              {formatDate(ref.referral_date)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Referral Tools */}
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm mb-8">
            <CardHeader>
              <CardTitle className="text-white">Invite More Friends</CardTitle>
              <CardDescription className="text-slate-400">
                Use these tools to invite more friends and complete verification faster
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Referral Link */}
              <div className="space-y-3">
                <Label className="text-sm text-slate-300">Your Referral Link</Label>
                <div className="flex gap-2">
                  <div className="flex-1 p-3 bg-slate-700 rounded-lg border border-slate-600 text-sm text-slate-300 overflow-x-auto">
                    {referralLink || (referralCode ? `${window.location.origin}/signup?ref=${referralCode}` : "Loading...")}
                  </div>
                  <Button
                    onClick={copyReferralLink}
                    disabled={!referralCode}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {referralLinkCopied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Share this link with friends. When they sign up and purchase machines, it counts toward your verification.
                </p>
              </div>

              {/* Tips Section */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border border-cyan-500/20 bg-cyan-500/5 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Sparkles className="h-5 w-5 text-cyan-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-cyan-300 mb-1">Quick Tips</h4>
                      <ul className="text-sm text-cyan-200/80 space-y-1">
                        <li>• Share on social media groups</li>
                        <li>• Explain the earning potential</li>
                        <li>• Offer to help them get started</li>
                        <li>• Focus on serious supporters</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-purple-500/20 bg-purple-500/5 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Target className="h-5 w-5 text-purple-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-purple-300 mb-1">Machine Requirement</h4>
                      <p className="text-sm text-purple-200/80">
                        Each referral needs to purchase at least 1 machine worth 2500 XAF or more to count as an "active supporter".
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm">
            <CardFooter className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button
                onClick={handleSaveForLater}
                variant="outline"
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Save & Finish Later
              </Button>
              <Button
                onClick={handleCompleteStep}
                disabled={loading || !requirementsMet || statsLoading}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Processing..." : (
                  <>
                    {requirementsMet ? "Continue to Next Step" : "Complete Requirements First"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Important Notes */}
          <div className="mt-6 p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-300 mb-1">Important Notes</h4>
                <ul className="text-sm text-yellow-200/80 space-y-1">
                  <li>• System detects machine purchases automatically when bonuses are awarded</li>
                  <li>• If referrals aren't showing correctly, refresh the page or check your Referrals page</li>
                  <li>• Only referrals who purchase machines count toward verification</li>
                  <li>• Each referral can only be counted once for verification</li>
                  <li>• Verification is required to prevent fraud and ensure platform security</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// We need to create the Label component
function Label({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <label className={`text-sm font-medium text-white ${className}`}>
      {children}
    </label>
  )
}
