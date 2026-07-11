// components/verification-modal.tsx - UPDATED WITH BETTER MESSAGING
"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Clock, AlertCircle, ArrowRight, Shield, Users, Camera, FileText, Cpu, ShieldCheck, Lock, UserCheck, Handshake } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"

interface VerificationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onVerificationComplete: () => void
}

export function VerificationModal({ open, onOpenChange, onVerificationComplete }: VerificationModalProps) {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [machinePurchaseDays, setMachinePurchaseDays] = useState<number>(0)
  const [hasPurchasedMachine, setHasPurchasedMachine] = useState(false)
  const [verificationProgress, setVerificationProgress] = useState({
    step1: false,
    step2: false,
    step3: false
  })

  const totalSteps = 3

  // Check machine purchase eligibility on load
  useEffect(() => {
    if (user && open) {
      checkMachinePurchaseEligibility()
      loadVerificationProgress()
    }
  }, [user, open])

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

  const loadVerificationProgress = async () => {
    if (!user) return
    
    try {
      const { data: verificationData, error } = await supabase
        .from('users')
        .select('verification_data')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (verificationData?.verification_data) {
        const data = verificationData.verification_data
        setVerificationProgress({
          step1: !!data.personal_info_completed,
          step2: !!data.support_verified,
          step3: !!data.id_verified
        })
      }
    } catch (error) {
      console.error("Error loading verification progress:", error)
    }
  }

  const handleStartVerification = () => {
    if (!hasPurchasedMachine) {
      toast.error("You need to purchase at least one machine before you can verify your account.")
      onOpenChange(false)
      return
    }
    
    if (machinePurchaseDays < 7) {
      toast.error(`You need to wait ${7 - machinePurchaseDays} more day(s) after purchasing your first machine to verify your account.`)
      onOpenChange(false)
      return
    }
    
    // Start verification process
    startVerificationProcess()
  }

  const startVerificationProcess = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Update user verification status
      const { error } = await supabase
        .from('users')
        .update({
          verification_status: 'in_progress',
          verification_started_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success("Verification process started! Complete all steps to verify your account.")
      onVerificationComplete()
      
    } catch (error) {
      console.error("Error starting verification:", error)
      toast.error("Failed to start verification process")
    } finally {
      setLoading(false)
    }
  }

  const handleContinueToStep = (step: number) => {
    // If trying to skip ahead, check if previous steps are completed
    if (step > 1 && !verificationProgress.step1) {
      toast.error("Please complete Step 1 first")
      return
    }
    if (step > 2 && !verificationProgress.step2) {
      toast.error("Please complete Step 2 first")
      return
    }
    
    // Redirect to the specific verification step page
    window.location.href = `/verification/step${step}`
    onOpenChange(false)
  }

  const getStepStatus = (step: number) => {
    switch (step) {
      case 1: return verificationProgress.step1 ? "completed" : "current"
      case 2: return verificationProgress.step2 ? "completed" : verificationProgress.step1 ? "available" : "locked"
      case 3: return verificationProgress.step3 ? "completed" : verificationProgress.step2 ? "available" : "locked"
      default: return "locked"
    }
  }

  const StepCard = ({ step, title, description, icon: Icon, status }: {
    step: number
    title: string
    description: string
    icon: any
    status: string
  }) => {
    const isCompleted = status === "completed"
    const isCurrent = status === "current"
    const isAvailable = status === "available"
    const isLocked = status === "locked"

    return (
      <Card className={`border ${isCompleted ? 'border-green-500/20 bg-green-500/5' : isCurrent ? 'border-cyan-500/20 bg-cyan-500/5' : isLocked ? 'border-slate-700 bg-slate-800/30' : 'border-slate-700 hover:border-slate-600 transition-colors'}`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className={`p-3 rounded-lg ${isCompleted ? 'bg-green-500/10' : isCurrent ? 'bg-cyan-500/10' : 'bg-slate-700'}`}>
                <Icon className={`h-6 w-6 ${isCompleted ? 'text-green-400' : isCurrent ? 'text-cyan-400' : 'text-slate-400'}`} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-white">{title}</h3>
                  {isCompleted && <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Completed</Badge>}
                  {isCurrent && <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">Current</Badge>}
                </div>
                <p className="text-sm text-slate-400">{description}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {isCompleted ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : isCurrent ? (
                <Button 
                  onClick={() => handleContinueToStep(step)}
                  size="sm"
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                >
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : isAvailable ? (
                <Button 
                  onClick={() => handleContinueToStep(step)}
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Start
                </Button>
              ) : (
                <Clock className="h-5 w-5 text-slate-500" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl">
            <ShieldCheck className="h-6 w-6 text-cyan-400" />
            <span>Account Verification Required</span>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Submit verification for admin review before withdrawals can be unlocked
          </DialogDescription>
        </DialogHeader>

        {/* IMPORTANT SECURITY MESSAGE */}
        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-red-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-300 mb-1">Security & Fraud Prevention</h4>
              <p className="text-sm text-red-200/80">
                To combat fraud and ensure platform security, all users must complete identity verification. 
                This protects your earnings and maintains trust within our community.
              </p>
            </div>
          </div>
        </div>

        {/* Verification Requirements */}
        <div className="space-y-4">
          {/* Machine Purchase & Time Check */}
          <div className={`p-4 rounded-lg border ${hasPurchasedMachine && machinePurchaseDays >= 7 ? 'border-green-500/20 bg-green-500/5' : !hasPurchasedMachine ? 'border-red-500/20 bg-red-500/5' : 'border-yellow-500/20 bg-yellow-500/5'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {!hasPurchasedMachine ? (
                  <>
                    <Lock className="h-5 w-5 text-red-400" />
                    <div>
                      <h4 className="font-medium text-white">Machine Purchase Required</h4>
                      <p className="text-sm text-slate-400">
                        Purchase at least one AI gaming machine to start verification
                      </p>
                    </div>
                  </>
                ) : machinePurchaseDays >= 7 ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <div>
                      <h4 className="font-medium text-white">Verification Eligibility</h4>
                      <p className="text-sm text-slate-400">
                        ✓ You have completed 1 week since purchasing your first machine
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Clock className="h-5 w-5 text-yellow-400" />
                    <div>
                      <h4 className="font-medium text-white">Verification Eligibility</h4>
                      <p className="text-sm text-slate-400">
                        Complete {7 - machinePurchaseDays} more day(s) after purchasing your first machine
                      </p>
                    </div>
                  </>
                )}
              </div>
              <Badge className={
                !hasPurchasedMachine ? "bg-red-500/10 text-red-400 border-red-500/20" :
                machinePurchaseDays >= 7 ? "bg-green-500/10 text-green-400 border-green-500/20" :
                "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
              }>
                {!hasPurchasedMachine ? (
                  <Cpu className="h-3 w-3 mr-1" />
                ) : (
                  <span>{machinePurchaseDays} day(s)</span>
                )}
              </Badge>
            </div>
          </div>

          {/* Why Verification is Required */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="p-4">
              <h4 className="font-medium text-white mb-2 flex items-center">
                <UserCheck className="h-4 w-4 text-cyan-400 mr-2" />
                Why Verification is Required
              </h4>
              <ul className="space-y-1 text-sm text-slate-400">
                <li className="flex items-start space-x-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-1.5" />
                  <span>Prevent multiple accounts and fraud</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-1.5" />
                  <span>Secure withdrawals and protect your earnings</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-1.5" />
                  <span>Build trust within our gaming community</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-1.5" />
                  <span>Comply with financial regulations</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Verification Progress */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Verification Steps</h3>
              <div className="text-sm text-slate-400">
                {Object.values(verificationProgress).filter(v => v).length} of {totalSteps} completed
              </div>
            </div>

            {/* Progress Steps */}
            <div className="space-y-3">
              <StepCard
                step={1}
                title="Personal Information"
                description="Provide your full name, residence, job, and withdrawal methods"
                icon={FileText}
                status={getStepStatus(1)}
              />

              <StepCard
                step={2}
                title="Support Verification"
                description="Invite 10 friends and have 5+ purchase minimum 2500 XAF machines"
                icon={Users}
                status={getStepStatus(2)}
              />

              <StepCard
                step={3}
                title="ID Verification"
                description="Upload ID photos and personal photos for identity confirmation"
                icon={Camera}
                status={getStepStatus(3)}
              />
            </div>
          </div>

          {/* Benefits Section */}
          <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg p-4">
            <h4 className="font-semibold text-cyan-300 mb-2 flex items-center">
              <Handshake className="h-4 w-4 mr-2" />
              Benefits of Verification
            </h4>
            <ul className="space-y-1 text-sm text-cyan-200/80">
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-3 w-3" />
                <span>Unlock withdrawal functionality (Cash out your earnings!)</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-3 w-3" />
                <span>Higher daily earning limits (Earn more per day)</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-3 w-3" />
                <span>Priority support and faster payouts</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-3 w-3" />
                <span>Access to premium features and bonuses</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-3 w-3" />
                <span>Verified badge on your profile</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            {!hasPurchasedMachine ? (
              <Button
                onClick={() => {
                  onOpenChange(false)
                  window.location.href = "/dashboard"
                }}
                className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600"
              >
                <Cpu className="h-4 w-4 mr-2" />
                Purchase Your First Machine
              </Button>
            ) : machinePurchaseDays < 7 ? (
              <Button
                disabled
                className="flex-1 bg-slate-700 text-slate-400 cursor-not-allowed"
              >
                <Clock className="h-4 w-4 mr-2" />
                Complete {7 - machinePurchaseDays} more day(s)
              </Button>
            ) : verificationProgress.step1 && verificationProgress.step2 && verificationProgress.step3 ? (
              <Button
                disabled
                className="flex-1 bg-green-500/10 text-green-400 border border-green-500/20 cursor-not-allowed"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Submitted for Review
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleStartVerification}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                >
                  {loading ? "Starting..." : "Start Verification"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Complete Later
                </Button>
              </>
            )}
          </div>

          {/* Important Notes */}
          <div className="text-xs text-slate-500 space-y-1 pt-4 border-t border-slate-800">
            <p>• Verification unlocks after 7 days from your first machine purchase</p>
            <p>• All information is encrypted and securely stored</p>
            <p>• Verification typically takes 24-48 hours after submission</p>
            <p>• You can save progress and return later</p>
            <p>• Contact support if you encounter any issues</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
