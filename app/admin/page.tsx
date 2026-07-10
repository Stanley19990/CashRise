"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { authService } from "@/lib/auth"
import { AdminHeader } from "@/components/admin-header"
import { AdminStats } from "@/components/admin-stats"
import { UserManagement } from "@/components/user-management"
import { WithdrawalManagement } from "@/components/withdrawal-management"
import { FloatingParticles } from "@/components/floating-particles"
import { Toaster } from "sonner"
import { AdminWallet } from "@/components/admin-wallet"

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (user?.email && authService.isAdmin(user.email)) {
      setIsAdmin(true)
      return
    }

    setIsAdmin(false)
    if (!user) {
      router.push("/admin/login")
    } else {
      router.push("/dashboard")
    }
  }, [loading, router, user])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-400"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="cr-backdrop cr-grid"></div>
      <FloatingParticles />

      <div className="relative z-10">
        <AdminHeader />

        <main className="container mx-auto px-4 py-6 lg:py-8 space-y-6 lg:space-y-8">
          <div className="text-center mb-6 lg:mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold cr-title cr-hero-text mb-2">
              Admin Dashboard
            </h1>
            <p className="text-slate-400 text-sm lg:text-base">Manage users, withdrawals, and platform analytics</p>
          </div>

          <AdminStats />

          <AdminWallet />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
            <UserManagement />
            <WithdrawalManagement />
          </div>
        </main>
      </div>

      <Toaster position="top-right" />
    </div>
  )
}
