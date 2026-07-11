// app/verification/success/page.tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, PartyPopper, Shield, Clock, Home, Wallet } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import confetti from "canvas-confetti"

export default function VerificationSuccess() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Trigger confetti animation
    const duration = 3 * 1000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
      
      // Since particles fall down, start a bit higher than random
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      })
    }, 250)

    return () => clearInterval(interval)
  }, [])

  const handleGoToDashboard = () => {
    router.push("/dashboard")
  }

  const handleGoToWallet = () => {
    router.push("/wallet")
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
        <Card className="w-full max-w-md cr-glass">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Verification Submitted</h3>
              <p className="text-slate-400 mb-4">Please log in to view your verification status</p>
              <Button onClick={() => router.push("/login")} className="w-full">
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      <div className="cr-backdrop cr-grid"></div>
      <Card className="w-full max-w-2xl cr-glass overflow-hidden relative z-10">
        {/* Confetti Background Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5" />
        
        <CardContent className="relative p-8 md:p-12">
          <div className="text-center space-y-6">
            {/* Success Icon */}
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl" />
              <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-12 w-12 text-white" />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                Verification Submitted!
              </h1>
              <p className="text-lg text-emerald-200">
                <PartyPopper className="h-5 w-5 inline mr-2" />
                Congratulations on completing all verification steps
              </p>
            </div>

            {/* Message */}
            <div className="max-w-md mx-auto">
              <p className="text-slate-300">
                Your account verification has been submitted successfully. Our team is now reviewing your documents.
              </p>
            </div>

            {/* Next Steps */}
            <div className="bg-slate-700/30 border border-slate-600 rounded-xl p-6 max-w-md mx-auto">
              <h3 className="font-semibold text-white mb-4 flex items-center justify-center">
                <Clock className="h-5 w-5 mr-2 text-cyan-400" />
                What happens next?
              </h3>
              <ul className="space-y-3 text-left">
                <li className="flex items-start space-x-3">
                  <div className="h-2 w-2 rounded-full bg-cyan-400 mt-2" />
                  <span className="text-sm text-slate-300">
                    <span className="font-medium text-white">24-48 hour review:</span> Our team will verify your documents
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="h-2 w-2 rounded-full bg-cyan-400 mt-2" />
                  <span className="text-sm text-slate-300">
                    <span className="font-medium text-white">Notification:</span> You'll receive an email when verification is complete
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="h-2 w-2 rounded-full bg-cyan-400 mt-2" />
                  <span className="text-sm text-slate-300">
                    <span className="font-medium text-white">Withdrawals unlocked:</span> Start cashing out your earnings
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="h-2 w-2 rounded-full bg-cyan-400 mt-2" />
                  <span className="text-sm text-slate-300">
                    <span className="font-medium text-white">Full access:</span> Enjoy all premium features
                  </span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6 max-w-md mx-auto">
              <Button
                onClick={handleGoToDashboard}
                variant="outline"
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
              <Button
                onClick={handleGoToWallet}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
              >
                <Wallet className="h-4 w-4 mr-2" />
                Check Wallet
              </Button>
            </div>

            {/* Support Info */}
            <div className="pt-6 border-t border-slate-700">
              <p className="text-sm text-slate-500">
                Questions? Contact support at{" "}
                <a href="mailto:support@easydollars.com" className="text-cyan-400 hover:text-cyan-300">
                  support@easydollars.com
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
