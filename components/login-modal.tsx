"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { Loader2, Key } from "lucide-react"
import { CashRiseLogo } from "@/components/cashrise-logo"
import { useLanguage } from "@/components/language-provider"

interface LoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const { t } = useLanguage()
  const { signIn } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      console.log("Logging in user:", formData.email)
      const result = await signIn(formData.email, formData.password)

      if (!result.user) {
        // If the user object is null, check for error message
        setError(result.error || t("loginFailed"))
      } else {
        onOpenChange(false)
        router.push("/dashboard")
      }
    } catch (err: any) {
      console.error("Login error occurred:", err)
      setError(err?.message || t("genericError"))
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = () => {
    onOpenChange(false)
    router.push("/forgot-password")
  }

  const handleSignup = () => {
    onOpenChange(false)
    router.push("/signup")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cr-glass text-slate-100 max-w-md border border-cyan-400/30">
        <DialogHeader>
          <div className="flex justify-center">
            <CashRiseLogo size={40} />
          </div>
          <DialogTitle className="text-2xl font-bold text-center">{t("welcomeBack")}</DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            {t("loginDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          <div>
            <Label htmlFor="email" className="text-slate-200">
              {t("email")}
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-slate-900/70 border-cyan-500/40 text-slate-100"
              required
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-slate-200">
              {t("password")}
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="bg-slate-900/70 border-cyan-500/40 text-slate-100"
              required
            />
          </div>

          {/* Forgot Password Link */}
          <div className="text-right">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs text-cyan-200 hover:text-cyan-100 hover:underline flex items-center justify-end gap-1"
            >
              <Key className="h-3 w-3" />
              {t("forgotPassword")}
            </button>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full cr-button text-slate-950 font-bold"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("loginToDashboard")}
          </Button>

          <div className="text-center text-sm text-slate-400">
            {t("noAccount")}{" "}
            <button
              type="button"
              onClick={handleSignup}
              className="text-cyan-200 hover:text-cyan-100 underline"
            >
              {t("signup")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
