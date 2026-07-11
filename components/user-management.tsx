"use client"

import { useEffect, useState } from "react"
import { CheckCircle, Loader2, ShieldCheck, Users, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { formatDate, toNumber } from "@/lib/safe-data"

type ManagedUser = {
  id: string
  email?: string
  username?: string
  full_name?: string
  country?: any
  wallet_balance?: number
  machines_owned?: number
  verification_status?: string
  verification_completed_at?: string
  created_at?: string
}

export function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch("/api/admin/users", {
        headers: {
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
        }
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to load users")
      setUsers(result.users || [])
    } catch (error: any) {
      toast.error(error.message || "Failed to load users")
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const updateVerification = async (userId: string, verificationStatus: "verified" | "rejected") => {
    setUpdating(userId)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
        },
        body: JSON.stringify({ userId, verificationStatus })
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to update user")
      toast.success(verificationStatus === "verified" ? "User marked verified" : "User verification rejected")
      await loadUsers()
    } catch (error: any) {
      toast.error(error.message || "Failed to update user")
    } finally {
      setUpdating(null)
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "verified":
        return "bg-green-500/10 text-green-400 border-green-500/20"
      case "in_progress":
        return "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
      case "rejected":
        return "bg-red-500/10 text-red-400 border-red-500/20"
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20"
    }
  }

  const getCountryLabel = (country: any) => {
    if (!country) return "Unknown"
    if (typeof country === "string") return country
    return country.name || country.code || "Unknown"
  }

  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-purple-400" />
            <span>User Management</span>
          </span>
          <Button variant="outline" size="sm" className="cr-outline-button" onClick={loadUsers} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No users found.</p>
        ) : (
          <div className="space-y-4">
            {users.map((user) => {
              const status = user.verification_status || "pending"
              const isBusy = updating === user.id
              const displayName = user.full_name || user.username || user.email || "CashRise user"

              return (
                <div
                  key={user.id}
                  className="flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-white">{displayName}</div>
                    <div className="truncate text-sm text-slate-400">{user.email}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {getCountryLabel(user.country)} - Joined {user.created_at ? formatDate(user.created_at) : "Unknown"}
                    </div>
                  </div>

                  <div className="text-left lg:text-right">
                    <div className="text-sm font-medium text-green-400">{toNumber(user.wallet_balance).toLocaleString()} XAF</div>
                    <div className="text-xs text-slate-400">{toNumber(user.machines_owned)} machines</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className={getStatusColor(status)}>
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      {status.replace("_", " ")}
                    </Badge>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={isBusy || status === "verified"}
                      onClick={() => updateVerification(user.id, "verified")}
                    >
                      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
                      Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-400/30 text-red-300 hover:bg-red-500/10"
                      disabled={isBusy || status === "rejected"}
                      onClick={() => updateVerification(user.id, "rejected")}
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
