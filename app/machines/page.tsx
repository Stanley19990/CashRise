"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { MyMachines } from "@/components/my-machines"
import { FloatingParticles } from "@/components/floating-particles"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function MachinesPage() {
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
        <main className="container mx-auto max-w-5xl px-4 py-6 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="cr-title cr-hero-text text-2xl font-bold">Machines</h1>
              <p className="text-sm text-slate-400">Track owned machines and claim completed 24-hour earnings.</p>
            </div>
            <Button asChild className="cr-button text-slate-950">
              <Link href="/machines/store">Store</Link>
            </Button>
          </div>
          <MyMachines onRefresh={refreshUser} />
        </main>
      </div>
    </div>
  )
}
