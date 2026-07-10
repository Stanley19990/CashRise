"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Save } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { FloatingParticles } from "@/components/floating-particles"
import { CountrySelect } from "@/components/CountrySelect"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useCurrency } from "@/contexts/CurrencyContext"
import { CountryInfo, normalizeCountry } from "@/lib/currency"
import { supabase } from "@/lib/supabase"

export default function EditProfilePage() {
  const { user, loading } = useAuth()
  const { country, refreshCurrency } = useCurrency()
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(country)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push("/")
  }, [loading, router, user])

  useEffect(() => {
    setSelectedCountry(normalizeCountry(country))
  }, [country])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from("users")
        .update({
          country: selectedCountry,
          lastCurrencyUpdate: new Date().toISOString()
        })
        .eq("id", user.id)

      if (error) throw error

      await refreshCurrency()
      toast.success(`Country updated to ${selectedCountry.name}. Prices now show in ${selectedCountry.currency}.`)
      router.push("/profile")
    } catch (error: any) {
      console.error("Country update error:", error)
      toast.error(error.message || "Failed to update country")
    } finally {
      setSaving(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="cr-backdrop cr-grid" />
      <FloatingParticles />
      <div className="relative z-10">
        <DashboardHeader />
        <main className="container mx-auto max-w-md px-4 py-6 space-y-5">
          <section className="cr-glass rounded-2xl p-5 space-y-4">
            <div>
              <h1 className="text-xl font-bold text-white">Edit Profile</h1>
              <p className="text-sm text-slate-400">Update your country and currency preferences.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Country</label>
              <CountrySelect value={selectedCountry} onChange={setSelectedCountry} disabled={saving} />
            </div>

            <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <p>Changing country will update all prices to {selectedCountry.currency}.</p>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full cr-button text-slate-950">
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </section>
        </main>
      </div>
    </div>
  )
}
