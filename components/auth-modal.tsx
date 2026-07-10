"use client"

import { useEffect, useState } from "react"

import type React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { Loader2 } from "lucide-react"
import { CashRiseLogo } from "@/components/cashrise-logo"
import { CountrySelect } from "@/components/CountrySelect"
import { CountryPhoneInput } from "@/components/CountryPhoneInput"
import { useCurrency } from "@/contexts/CurrencyContext"
import type { CountryInfo } from "@/lib/currency"
import { formatPhoneForCountry } from "@/lib/phone"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  mode: "signin" | "signup"
  onModeChange: (mode: "signin" | "signup") => void
}

export function AuthModal({ isOpen, onClose, mode, onModeChange }: AuthModalProps) {
  const { signIn, signUp } = useAuth()
  const { country: selectedCountry, setCountry: setGlobalCountry } = useCurrency()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    country: selectedCountry.name,
    countryData: selectedCountry as CountryInfo,
    phone: "",
    referralCode: "",
  })

  useEffect(() => {
    if (!isOpen) return
    setFormData((prev) => ({
      ...prev,
      country: selectedCountry.name,
      countryData: selectedCountry
    }))
  }, [isOpen, selectedCountry])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    console.log("Form submitted with mode:", mode)
    console.log("Form data:", {
      email: formData.email,
      fullName: formData.fullName,
      country: formData.country,
      phone: formData.phone,
      referralCode: formData.referralCode,
    })

    if (mode === "signup") {
      if (!formData.fullName.trim()) {
        setError("Full name is required")
        setLoading(false)
        return
      }
      if (!formData.country) {
        setError("Please select your country")
        setLoading(false)
        return
      }
    }

    try {
      if (mode === "signin") {
        console.log("Attempting sign in...")
        const result = await signIn(formData.email, formData.password)
        console.log("Sign in result:", result?.error ? "Error occurred" : "Success")
        if (result.error) {
          setError(result.error)
        } else {
          onClose()
        }
      } else {
        console.log("Attempting sign up...")
        const result = await signUp(
          formData.email,
          formData.password,
          formData.fullName,
          formData.country,
          formatPhoneForCountry(formData.phone, formData.countryData),
          formData.referralCode,
          formData.countryData,
        )
        console.log("Sign up result:", result?.error ? "Error occurred" : "Success")
        if (result.error) {
          setError(result.error)
        } else {
          setError("")
          alert("Account created successfully! Please check your email to verify your account.")
          onClose()
        }
      }
    } catch (err) {
      console.error("Auth error occurred")
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCountryChange = (country: CountryInfo) => {
    setFormData((prev) => ({
      ...prev,
      country: country.name,
      countryData: country
    }))
    void setGlobalCountry(country)
    if (error) setError("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md cr-glass border-cyan-500/30">
        <DialogHeader>
          <div className="flex justify-center">
            <CashRiseLogo size={38} />
          </div>
          <DialogTitle className="text-2xl font-bold text-center text-white">
            {mode === "signin" ? "Welcome Back" : "Join CashRise"}
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            {mode === "signin"
              ? "Sign in to your CashRise account to start earning"
              : "Create your account and start earning money by watching ads"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-slate-900/70 border-slate-700/70 focus:border-cyan-500 text-slate-100"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="bg-slate-900/70 border-slate-700/70 focus:border-cyan-500 text-slate-100"
              required
            />
          </div>

          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-200">Full Name</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="bg-slate-900/70 border-slate-700/70 focus:border-cyan-500 text-slate-100"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country" className="text-slate-200">Country</Label>
                <CountrySelect value={formData.countryData} onChange={handleCountryChange} disabled={loading} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-200">Phone (Optional)</Label>
                <CountryPhoneInput
                  id="phone"
                  country={formData.countryData}
                  value={formData.phone}
                  onChange={(value) => setFormData({ ...formData, phone: value })}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="referralCode" className="text-slate-200">Referral Code (Optional)</Label>
                <Input
                  id="referralCode"
                  value={formData.referralCode}
                  onChange={(e) => setFormData({ ...formData, referralCode: e.target.value })}
                  className="bg-slate-900/70 border-slate-700/70 focus:border-cyan-500 text-slate-100"
                  placeholder="Enter referral code"
                />
              </div>
            </>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full cr-button text-slate-950 font-bold"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign In" : "Create Account"}
          </Button>

          <div className="text-center text-sm text-slate-400">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => onModeChange(mode === "signin" ? "signup" : "signin")}
              className="text-cyan-400 hover:text-cyan-300"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
