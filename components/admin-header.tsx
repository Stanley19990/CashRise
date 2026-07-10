"use client"

import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { CashRiseLogo } from "@/components/cashrise-logo"
import { supabase } from "@/lib/supabase"

export function AdminHeader() {
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/admin/login")
  }

  return (
    <header className="border-b border-slate-800/60 bg-slate-950/40 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <CashRiseLogo size={30} withText={false} />
                <div className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(255,180,84,0.9)]"></div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.35em] text-slate-400">Admin</div>
                <div className="text-lg font-bold text-white">CashRise Control</div>
              </div>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-slate-400 hover:text-red-400">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  )
}
