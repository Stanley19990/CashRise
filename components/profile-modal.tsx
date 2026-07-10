"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { User, Mail, Phone, MapPin, Calendar, Edit3, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { CountrySelect } from "@/components/CountrySelect"
import { CountryPhoneInput } from "@/components/CountryPhoneInput"
import { useCurrency } from "@/contexts/CurrencyContext"
import { CountryInfo, normalizeCountry } from "@/lib/currency"
import { formatPhoneForCountry } from "@/lib/phone"

interface ProfileModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ProfileFormData {
  full_name: string
  phone: string
  country: string
  countryData: CountryInfo
}

// Extended user type that includes database fields
interface DatabaseUser {
  id: string
  created_at: string
  email?: string
  username?: string
  full_name?: string
  avatar_url?: string
  country?: string | CountryInfo
  phone?: string
  referral_code?: string
  referred_by?: string
  wallet_balance: number
  ed_balance: number
  total_earned: number
  machines_owned: number
  last_earning_date?: string
  social_media_completed: boolean
  completed_social_links?: string[]
  social_media_bonus_paid: boolean
}

export function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { user: authUser, refreshUser } = useAuth()
  const { country: currentCountry, setCountry: setGlobalCountry } = useCurrency()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profileData, setProfileData] = useState<ProfileFormData>({
    full_name: "",
    phone: "",
    country: currentCountry.name,
    countryData: currentCountry
  })

  // Type assertion to handle the user type mismatch
  const user = authUser as unknown as DatabaseUser

  // Initialize form data when user or modal opens
  useEffect(() => {
    if (user && open) {
      const normalizedCountry = normalizeCountry(user.country || currentCountry)
      setProfileData({
        full_name: user.full_name || "",
        phone: user.phone || "",
        country: normalizedCountry.name,
        countryData: normalizedCountry
      })
    }
  }, [user, open, currentCountry])

  const handleSave = async () => {
    if (!user) return
    
    setSaving(true)
    
    try {
      // Validate required fields
      if (!profileData.full_name?.trim()) {
        toast.error("Full name is required")
        setSaving(false)
        return
      }

      // Check if phone already exists (if phone is provided)
      if (profileData.phone.trim()) {
        const formattedPhone = formatPhoneForCountry(profileData.phone, profileData.countryData)
        const { data: existingUsers, error: checkError } = await supabase
          .from("users")
          .select("id")
          .eq("phone", formattedPhone)
          .neq("id", user.id)

        if (checkError) {
          console.error("Error checking phone:", checkError)
          toast.error("Error validating phone number")
          setSaving(false)
          return
        }

        if (existingUsers && existingUsers.length > 0) {
          toast.error("This phone number is already in use")
          setSaving(false)
          return
        }
      }

      // Prepare update data
      const updateData: {
        full_name?: string
        phone?: string | null
        country?: CountryInfo | null
        preferredLanguage?: string
        lastCurrencyUpdate?: string
      } = {
        full_name: profileData.full_name.trim()
      }

      // Add optional fields only if they have values
      if (profileData.phone.trim()) {
        updateData.phone = formatPhoneForCountry(profileData.phone, profileData.countryData)
      } else {
        updateData.phone = null
      }

      if (profileData.country.trim()) {
        updateData.country = profileData.countryData
        updateData.lastCurrencyUpdate = new Date().toISOString()
      } else {
        updateData.country = null
      }

      // Update user profile
      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", user.id)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      toast.success("Profile updated successfully!")
      await setGlobalCountry(profileData.countryData)
      await refreshUser()
      setEditing(false)
      onOpenChange(false)
      
    } catch (error: any) {
      console.error("Profile update error:", error)
      toast.error(error.message || "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset to original user data
    if (user) {
      const normalizedCountry = normalizeCountry(user.country || currentCountry)
      setProfileData({
        full_name: user.full_name || "",
        phone: user.phone || "",
        country: normalizedCountry.name,
        countryData: normalizedCountry
      })
    }
    setEditing(false)
  }

  // Handle modal close
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      handleCancel()
    }
    onOpenChange(newOpen)
  }

  if (!user) return null

  const getInitials = (): string => {
    if (user.full_name) {
      return user.full_name
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return user.email?.charAt(0).toUpperCase() || "U"
  }

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }
  }

  const handleCountryChange = (country: CountryInfo) => {
    setProfileData((prev) => ({
      ...prev,
      country: country.name,
      countryData: country
    }))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5 text-cyan-400" />
            <span>Profile Settings</span>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            View and manage your account information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Avatar */}
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-20 w-20 border-4 border-cyan-500/20">
              <AvatarFallback className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-2xl font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h3 className="font-semibold text-lg text-white">
                {user.full_name || "User"}
              </h3>
              <p className="text-slate-400 text-sm">{user.email}</p>
            </div>
          </div>

          {/* Profile Information */}
          <div className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name" className="flex items-center space-x-2 text-slate-300">
                <User className="h-4 w-4 text-cyan-400" />
                <span>Full Name *</span>
              </Label>
              <Input
                id="full_name"
                value={profileData.full_name}
                onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                disabled={!editing || saving}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Enter your full name"
              />
              {!profileData.full_name?.trim() && editing && (
                <p className="text-xs text-red-400">Full name is required</p>
              )}
            </div>

            {/* Email (Read-only) */}
            <div className="space-y-2">
              <Label className="flex items-center space-x-2 text-slate-300">
                <Mail className="h-4 w-4 text-cyan-400" />
                <span>Email</span>
              </Label>
              <Input 
                value={user.email || ""} 
                disabled 
                className="bg-slate-800 border-slate-700 text-slate-400 opacity-60 cursor-not-allowed" 
              />
              <p className="text-xs text-slate-500">Email cannot be changed</p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center space-x-2 text-slate-300">
                <Phone className="h-4 w-4 text-cyan-400" />
                <span>Phone</span>
              </Label>
              <CountryPhoneInput
                id="phone"
                country={profileData.countryData}
                value={profileData.phone}
                onChange={(value) => setProfileData({ ...profileData, phone: value })}
                disabled={!editing || saving}
              />
            </div>

            {/* Country */}
            <div className="space-y-2">
              <Label htmlFor="country" className="flex items-center space-x-2 text-slate-300">
                <MapPin className="h-4 w-4 text-cyan-400" />
                <span>Country</span>
              </Label>
              <CountrySelect
                value={profileData.countryData}
                onChange={handleCountryChange}
                disabled={!editing || saving}
                className="bg-slate-800 border-slate-700"
              />
            </div>

            {/* Member Since (Read-only) */}
            <div className="space-y-2">
              <Label className="flex items-center space-x-2 text-slate-300">
                <Calendar className="h-4 w-4 text-cyan-400" />
                <span>Member Since</span>
              </Label>
              <Input
                value={formatDate(user.created_at)}
                disabled
                className="bg-slate-800 border-slate-700 text-slate-400 opacity-60 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-2">
            {editing ? (
              <>
                <Button
                  onClick={handleSave}
                  disabled={saving || !profileData.full_name?.trim()}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  disabled={saving}
                  className="flex-1 border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800 bg-transparent"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setEditing(true)}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>

          {/* Edit Mode Notice */}
          {editing && (
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
              <p className="text-xs text-cyan-400 text-center">
                You are in edit mode. Click "Save Changes" to update your profile.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
