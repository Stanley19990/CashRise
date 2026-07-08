"use client"

import { ReactNode, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { DashboardHeader } from "@/components/dashboard-header"
import { FloatingParticles } from "@/components/floating-particles"

export function AppScreen({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const { user, loading } = useAuth()
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
        <main className="container mx-auto max-w-5xl px-4 py-6 space-y-5">
          <header>
            <h1 className="cr-title cr-hero-text text-2xl font-bold">{title}</h1>
            {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
          </header>
          {children}
        </main>
      </div>
    </div>
  )
}
