// hooks/use-auth.tsx - FINAL FIX WITH RLS BYPASS
"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (
    email: string,
    password: string,
    fullName: string,
    country: string,
    phone?: string,
    referralCode?: string
  ) => Promise<{ user: User | null; error: string | null }>
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: string | null }>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error("Error getting session:", error)
        setUser(null)
        return
      }

      setUser(session?.user ?? null)
    } catch (error) {
      console.error("Error loading user:", error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [loadUser])

  // Helper function to generate unique referral code
  const generateReferralCode = (fullName: string, userId: string): string => {
    const cleanName = fullName
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()
      .substring(0, 8)
    
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase()
    const userIdPart = userId.substring(0, 4)
    
    return `${cleanName}${randomStr}${userIdPart}`
  }

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    country: string,
    phone?: string,
    referralCode?: string
  ): Promise<{ user: User | null; error: string | null }> => {
    try {
      console.log("🚀 Starting signup process...")
      console.log("📋 Referral code used:", referralCode || "None")
      
      // Step 1: Create auth user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: fullName,
            full_name: fullName,
            country,
            phone: phone || null,
          },
        },
      })

      if (error) {
        console.error("❌ Auth signup failed:", error)
        return { user: null, error: error.message }
      }

      if (!data.user) {
        return { user: null, error: "No user data returned" }
      }

      console.log("✅ Auth user created:", data.user.id)
      setUser(data.user)
      
      // Step 2: Generate a unique referral code for THIS new user
      const newUserReferralCode = generateReferralCode(fullName, data.user.id)
      console.log("🎫 Generated referral code for new user:", newUserReferralCode)

      // Step 3: Create username from full name
      const username = fullName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20) + Math.random().toString(36).substring(2, 6)

      // Step 4: Create user profile + referral record via server (bypasses RLS)
      try {
        console.log("📝 Creating user profile via API...")
        const session = data.session || (await supabase.auth.getSession()).data.session
        const profileResponse = await fetch("/api/auth/create-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
          },
          body: JSON.stringify({
            userId: data.user.id,
            email: data.user.email,
            fullName,
            country,
            phone,
            referralCode: referralCode || null,
            generatedReferralCode: newUserReferralCode,
            generatedUsername: username
          })
        })

        if (!profileResponse.ok) {
          const profileResult = await profileResponse.json().catch(() => null)
          const profileError = profileResult?.error || "Failed to create user profile"
          console.error("❌ Profile API error:", profileError)
          return { user: null, error: profileError }
        }

        console.log("✅ User profile created successfully via API")
      } catch (profileError: any) {
        console.error("💥 Exception creating user profile:", profileError)
        return { user: null, error: "Failed to create user profile" }
      }

      console.log("🎉 Signup completed successfully!")
      return { user: data.user, error: null }

    } catch (error: any) {
      console.error("💥 Sign up error:", error)
      return { user: null, error: error.message || "An unexpected error occurred" }
    }
  }

  const signIn = async (email: string, password: string): Promise<{ user: User | null; error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { user: null, error: error.message }
      }

      if (data.user) {
        setUser(data.user)
      }

      return { user: data.user, error: null }
    } catch (error: any) {
      console.error("Sign in error:", error)
      return { user: null, error: error.message || "An unexpected error occurred" }
    }
  }

  const signOut = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
    } catch (error) {
      console.error("Error signing out:", error)
      throw error
    }
  }

  const refreshUser = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error("Error refreshing user:", error)
        setUser(null)
        return
      }

      setUser(session?.user ?? null)
    } catch (error) {
      console.error("Error refreshing user:", error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const value: AuthContextType = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
