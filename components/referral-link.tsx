// components/referral-link.tsx - FIXED
"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Share2, Copy, Check, MessageCircle, Mail, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useCurrency } from "@/contexts/CurrencyContext"

export function ReferralLink() {
  const { user } = useAuth()
  const { formatMoney } = useCurrency()
  const [copied, setCopied] = useState(false)
  const [referralCode, setReferralCode] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadReferralCode()
    }
  }, [user])

  const loadReferralCode = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error("Error loading referral code:", error)
        toast.error("Failed to load referral code")
      } else if (data?.referral_code) {
        setReferralCode(data.referral_code)
      }
    } catch (err) {
      console.error("Exception loading referral code:", err)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  if (loading) {
    return (
      <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (!referralCode) {
    return (
      <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
        <CardContent className="py-8 text-center text-slate-400">
          No referral code available
        </CardContent>
      </Card>
    )
  }

  const referralLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/signup?ref=${referralCode}`
      : `/signup?ref=${referralCode}`

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      toast.success("Referral link copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy link")
    }
  }

  const shareViaWhatsApp = () => {
    const message = `Join me on CashRise and start earning money by watching ads! Use my referral code: ${referralCode}\n\n${referralLink}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank")
  }

  const shareViaEmail = () => {
    const subject = "Join CashRise and Start Earning!"
    const body = `Hi!\n\nI've been using CashRise to earn money by watching ads and it's amazing! You can earn up to 10x your investment in 30 days.\n\nUse my referral code: ${referralCode}\nSign up here: ${referralLink}\n\nLet's start earning together!`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
  }

  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Share2 className="h-5 w-5 text-cyan-400" />
          <span>Share & Earn</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-2">Your Referral Code</div>
            <div className="text-2xl font-bold text-cyan-400 text-center">{referralCode}</div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Your Referral Link</label>
            <div className="flex space-x-2">
              <Input value={referralLink} readOnly className="bg-slate-800 border-slate-700 text-sm" />
              <Button
                onClick={copyToClipboard}
                size="icon"
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium mb-2">Share via:</div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={shareViaWhatsApp}
                variant="outline"
                className="bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                onClick={shareViaEmail}
                variant="outline"
                className="bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-4">
            <div className="text-center">
              <div className="text-lg font-bold text-purple-400 mb-1">{formatMoney(1000)} Bonus</div>
              <div className="text-sm text-slate-400">For each successful referral</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
