// components/signup-modal.tsx
"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Loader2, Gift, LogIn } from "lucide-react"
import { CashRiseLogo } from "@/components/cashrise-logo"
import { useLanguage } from "@/components/language-provider"
import { CountrySelect } from "@/components/CountrySelect"
import { CountryPhoneInput } from "@/components/CountryPhoneInput"
import { CountryInfo, getPreferredLanguageForCountry } from "@/lib/currency"
import { formatPhoneForCountry } from "@/lib/phone"
import { useCurrency } from "@/contexts/CurrencyContext"

interface SignupModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialReferralCode?: string
  onSuccess?: () => void
  onSwitchToLogin?: () => void
}

export function SignupModal({ 
  open, 
  onOpenChange, 
  initialReferralCode = "", 
  onSuccess,
  onSwitchToLogin
}: SignupModalProps) {
  const { t, preference, setLanguage } = useLanguage()
  const { country: selectedCountry, setCountry: setGlobalCountry } = useCurrency()
  const { signUp } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [referralCode, setReferralCode] = useState(initialReferralCode)
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    country: selectedCountry.name,
    countryData: selectedCountry as CountryInfo,
    phone: "",
  })

  useEffect(() => {
    if (initialReferralCode) {
      setReferralCode(initialReferralCode)
    }
  }, [initialReferralCode])

  useEffect(() => {
    if (!open) return
    setFormData((prev) => ({
      ...prev,
      country: selectedCountry.name,
      countryData: selectedCountry
    }))
  }, [open, selectedCountry])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (formData.password !== formData.confirmPassword) {
      setError(t("passwordsDoNotMatch"))
      setLoading(false)
      return
    }

    if (!formData.fullName.trim()) {
      setError(t("fullNameRequired"))
      setLoading(false)
      return
    }

    if (!formData.country) {
      setError(t("countryRequired"))
      setLoading(false)
      return
    }

    try {
      console.log("Creating account with referral code:", referralCode)

      const result = await signUp(
        formData.email,
        formData.password,
        formData.fullName,
        formData.country,
        formatPhoneForCountry(formData.phone, formData.countryData),
        referralCode,
        formData.countryData,
      )

      if (result?.error) {
        if (result.error.includes("duplicate key")) {
          setError(t("duplicateAccount"))
        } else {
          setError(result.error)
        }
      } else {
        console.log("✅ Account created successfully!")
        if (onSuccess) onSuccess()
      }
    } catch (err) {
      console.error("Signup error occurred", err)
      setError(t("unexpectedError"))
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError("")
  }

  const handleCountryChange = (country: CountryInfo) => {
    setFormData(prev => ({
      ...prev,
      country: country.name,
      countryData: country
    }))
    if (preference === "system") {
      setLanguage(getPreferredLanguageForCountry(country.code))
    }
    void setGlobalCountry(country)
    if (error) setError("")
  }

  const handleSwitchToLogin = () => {
    onOpenChange(false)
    if (onSwitchToLogin) {
      onSwitchToLogin()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cr-glass text-slate-100 max-w-md w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto border border-cyan-400/30">
        <DialogHeader>
          <div className="flex justify-center">
            <CashRiseLogo size={40} />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-center">
            {t("joinCashRise")}
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400 text-sm sm:text-base px-2">
            {t("signupDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 px-2 sm:px-0">
          {error && (
            <div className="p-2 sm:p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm">
              {error}
            </div>
          )}

          {referralCode && (
            <div className="p-2 sm:p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center space-x-2 text-green-400">
                <Gift className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium">{t("referralApplied")}</span>
              </div>
              <p className="text-green-300 text-xs sm:text-sm mt-1 break-all">
                {t("usingCode")}: <strong>{referralCode}</strong>
              </p>
              <p className="text-green-200 text-xs mt-1">
                {t("referralBenefit")}
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="fullName" className="text-slate-200 text-sm sm:text-base">
              {t("fullName")}
            </Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => handleInputChange('fullName', e.target.value)}
              className="bg-slate-900/70 border-cyan-500/40 text-slate-100 text-sm sm:text-base h-10 sm:h-auto"
              required
              placeholder={t("fullNamePlaceholder")}
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-slate-200 text-sm sm:text-base">
              {t("email")}
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="bg-slate-900/70 border-cyan-500/40 text-slate-100 text-sm sm:text-base h-10 sm:h-auto"
              required
              placeholder={t("emailPlaceholder")}
            />
          </div>

          <div>
            <Label htmlFor="country" className="text-slate-200 text-sm sm:text-base">
              {t("country")}
            </Label>
            <CountrySelect value={formData.countryData} onChange={handleCountryChange} disabled={loading} />
          </div>

          <div>
            <Label htmlFor="phone" className="text-slate-200 text-sm sm:text-base">
              {t("phoneOptional")}
            </Label>
            <CountryPhoneInput
              id="phone"
              country={formData.countryData}
              value={formData.phone}
              onChange={(value) => handleInputChange('phone', value)}
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-slate-200 text-sm sm:text-base">
              {t("password")}
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className="bg-slate-900/70 border-cyan-500/40 text-slate-100 text-sm sm:text-base h-10 sm:h-auto"
              required
              placeholder={t("passwordPlaceholder")}
              minLength={6}
            />
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-slate-200 text-sm sm:text-base">
              {t("confirmPassword")}
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className="bg-slate-900/70 border-cyan-500/40 text-slate-100 text-sm sm:text-base h-10 sm:h-auto"
              required
              placeholder={t("confirmPasswordPlaceholder")}
            />
          </div>

          <div>
            <Label htmlFor="referralCode" className="text-slate-200 text-sm sm:text-base">
              {t("referralCodeOptional")}
            </Label>
            <Input
              id="referralCode"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              className="bg-slate-900/70 border-cyan-500/40 text-slate-100 text-sm sm:text-base h-10 sm:h-auto"
              placeholder={t("referralPlaceholder")}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full cr-button text-slate-950 font-bold h-10 sm:h-auto text-sm sm:text-base"
          >
            {loading && <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />}
            {t("createAccount")}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-600" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-400">
                {t("alreadyHaveAccount")}
              </span>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSwitchToLogin}
            variant="outline"
            className="w-full cr-outline-button hover:text-cyan-100 h-10 sm:h-auto text-sm sm:text-base"
          >
            <LogIn className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            {t("login")}
          </Button>

          <p className="text-xs text-slate-400 text-center px-2">
            {t("termsNotice")}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
