// components/dashboard-header.tsx - UPDATED VERIFICATION CHECK
"use client"

import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { LogOut, Wallet, Users, Shield, CheckCircle, AlertCircle, Clock, Cpu } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authService } from "@/lib/auth"
import { useState, useEffect } from "react"
import { VerificationModal } from "@/components/verification-modal"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { CashRiseLogo } from "@/components/cashrise-logo"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useLanguage } from "@/components/language-provider"
import { NotificationBell } from "@/components/notification-bell"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { InstallAppButton } from "@/components/install-app-button"

export function DashboardHeader() {
  const { t } = useLanguage()
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [verificationModalOpen, setVerificationModalOpen] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<string>("pending")
  const [machinePurchaseDays, setMachinePurchaseDays] = useState<number>(0)
  const [hasPurchasedMachine, setHasPurchasedMachine] = useState(false)
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false)
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  // Load verification status and machine purchase eligibility
  useEffect(() => {
    if (user) {
      loadVerificationStatus()
      checkMachinePurchaseEligibility()
    }
  }, [user])

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth < 768)

    updateIsMobile()
    window.addEventListener("resize", updateIsMobile)
    return () => window.removeEventListener("resize", updateIsMobile)
  }, [])

  const loadVerificationStatus = async () => {
    if (!user) return
    
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('verification_status, first_machine_purchase_date')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (userData) {
        setVerificationStatus(userData.verification_status || 'pending')
      }
    } catch (error) {
      console.error("Error loading verification status:", error)
    }
  }

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

          // Show verification prompt if eligible and not verified
          if (diffDays >= 7 && verificationStatus !== 'verified') {
            setShowVerificationPrompt(true)
          }
        }
      }
    } catch (error) {
      console.error("Error checking machine purchase eligibility:", error)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  const handleVerificationClick = () => {
    if (!hasPurchasedMachine) {
      toast.error("You need to purchase at least one machine before you can verify your account.")
      return
    }
    
    if (machinePurchaseDays < 7) {
      toast.error(`You need to wait ${7 - machinePurchaseDays} more day(s) after purchasing your first machine to verify your account.`)
      return
    }
    
    setVerificationModalOpen(true)
  }

  const isAdmin = user?.email ? authService.isAdmin(user.email) : false

  // Get user's display name - fallback to username, then email, then "User"
  const getDisplayName = () => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name.split(" ")[0]
    if (user?.user_metadata?.username) return user.user_metadata.username
    if (user?.email) return user.email.split("@")[0]
    return "User"
  }

  // Get verification badge color and icon
  const getVerificationBadge = () => {
    switch (verificationStatus) {
      case 'verified':
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-400" />,
          text: "Verified",
          color: "text-green-400",
          bgColor: "bg-green-400/10",
          borderColor: "border-green-400/20"
        }
      case 'in_progress':
        return {
          icon: <Clock className="h-4 w-4 text-yellow-400" />,
          text: "Verifying...",
          color: "text-yellow-400",
          bgColor: "bg-yellow-400/10",
          borderColor: "border-yellow-400/20"
        }
      case 'rejected':
        return {
          icon: <AlertCircle className="h-4 w-4 text-red-400" />,
          text: "Verification Failed",
          color: "text-red-400",
          bgColor: "bg-red-400/10",
          borderColor: "border-red-400/20"
        }
      default:
        if (!hasPurchasedMachine) {
          return {
            icon: <Cpu className="h-4 w-4 text-red-400" />,
            text: "Buy Machine",
            color: "text-red-400",
            bgColor: "bg-red-400/10",
            borderColor: "border-red-400/20"
          }
        } else if (machinePurchaseDays < 7) {
          return {
            icon: <Clock className="h-4 w-4 text-yellow-400" />,
            text: `${machinePurchaseDays}/7 Days`,
            color: "text-yellow-400",
            bgColor: "bg-yellow-400/10",
            borderColor: "border-yellow-400/20"
          }
        } else {
          return {
            icon: <AlertCircle className="h-4 w-4 text-cyan-400" />,
            text: "Verify Account",
            color: "text-cyan-400",
            bgColor: "bg-cyan-400/10",
            borderColor: "border-cyan-400/20"
          }
        }
    }
  }

  const verificationBadge = getVerificationBadge()

  return (
    <>
      <header className="border-b border-slate-800/60 bg-slate-950/40 backdrop-blur-xl">
        {/* Verification Prompt Banner */}
        {showVerificationPrompt && (
          <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-b border-cyan-500/20">
            <div className="container mx-auto px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-cyan-400" />
                  <p className="text-sm text-cyan-300">
                    <span className="font-semibold">Account Verification Available!</span> Verify now to start withdrawing your earnings.
                  </p>
                </div>
                <Button
                  onClick={handleVerificationClick}
                  size="sm"
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                >
                  Verify Now
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Machine Purchase Prompt */}
        {!hasPurchasedMachine && (
          <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 border-b border-red-500/20">
            <div className="container mx-auto px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Cpu className="h-4 w-4 text-red-400" />
                  <p className="text-sm text-red-300">
                    <span className="font-semibold">Purchase your first machine!</span> Buy a machine to start earning and unlock verification.
                  </p>
                </div>
                <Button
                  onClick={() => router.push("/dashboard")}
                  size="sm"
                  className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white"
                >
                  View Machines
                </Button>
              </div>
            </div>
          </div>
        )}

          <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Welcome */}
            <div className="flex items-center space-x-2 md:space-x-4">
              <Link href="/dashboard">
                <div className="cursor-pointer">
                  <CashRiseLogo size={34} />
                </div>
              </Link>
              <div className="hidden lg:flex items-center space-x-2">
                <span className="text-slate-400 text-sm">
                  Welcome, {getDisplayName()}
                </span>
                
                {/* Verification Badge */}
                <div 
                  className={`flex items-center space-x-1 px-2 py-1 rounded-full ${verificationBadge.bgColor} border ${verificationBadge.borderColor} cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={handleVerificationClick}
                >
                  {verificationBadge.icon}
                  <span className={`text-xs font-medium ${verificationBadge.color}`}>
                    {verificationBadge.text}
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop Navigation */}
            {isMobile === false && (
            <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
              {/* Verification Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleVerificationClick}
                className={`${verificationStatus === 'verified' ? 'text-green-400 hover:text-green-300' : 
                  !hasPurchasedMachine ? 'text-red-400 hover:text-red-300' :
                  machinePurchaseDays < 7 ? 'text-yellow-400 hover:text-yellow-300' :
                  'text-cyan-400 hover:text-cyan-300'}`}
              >
                {verificationBadge.icon}
                <span className="hidden lg:inline ml-2">
                  {verificationBadge.text}
                </span>
              </Button>

              <Link href="/social-links">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-cyan-400">
                  <Users className="h-4 w-4 lg:mr-2" />
                  <span className="hidden lg:inline">{t("socialLinks")}</span>
                </Button>
              </Link>

              <Link href="/referrals">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-purple-400">
                  <Users className="h-4 w-4 lg:mr-2" />
                  <span className="hidden lg:inline">{t("referrals")}</span>
                </Button>
              </Link>

              <Link href="/wallet">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-green-400">
                  <Wallet className="h-4 w-4 lg:mr-2" />
                  <span className="hidden lg:inline">{t("wallet")}</span>
                </Button>
              </Link>

              {isAdmin && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-orange-400">
                    <Shield className="h-4 w-4 lg:mr-2" />
                    <span className="hidden lg:inline">{t("admin")}</span>
                  </Button>
                </Link>
              )}

              <LanguageSwitcher compact />

              <InstallAppButton className="cr-outline-button h-9 px-3 text-xs" />

              <NotificationBell />

              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-slate-400 hover:text-red-400">
                <LogOut className="h-4 w-4 lg:mr-2" />
                <span className="hidden lg:inline">{t("signOut")}</span>
              </Button>
            </div>
            )}

            {/* Mobile Header Actions */}
            <div className="md:hidden flex items-center space-x-2">
              <div
                className={`flex items-center space-x-1 px-2 py-1 rounded-full ${verificationBadge.bgColor} border ${verificationBadge.borderColor} cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={handleVerificationClick}
              >
                {verificationBadge.icon}
                <span className={`text-xs font-medium ${verificationBadge.color}`}>
                  {verificationStatus === 'verified' ? 'OK' : '!'}
                </span>
              </div>
              {isMobile === true && <NotificationBell />}
            </div>
        </div>
        </div>
      </header>

      <VerificationModal 
        open={verificationModalOpen} 
        onOpenChange={setVerificationModalOpen}
        onVerificationComplete={() => {
          setVerificationStatus('in_progress')
          setShowVerificationPrompt(false)
        }}
      />
      <MobileBottomNav />
    </>
  )
}
