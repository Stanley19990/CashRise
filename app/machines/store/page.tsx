"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { MachineMarketplace } from "@/components/machine-marketplace"
import { FloatingParticles } from "@/components/floating-particles"

export default function MachineStorePage() {
  const { user, loading, refreshUser } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push("/")
  }, [loading, router, user])

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
        <main className="container mx-auto max-w-6xl px-4 py-6">
          <MachineMarketplace onPurchaseSuccess={refreshUser} />
        </main>
      </div>
    </div>
  )
}
