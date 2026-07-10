import { NextRequest, NextResponse } from "next/server"
import { verifyAdminAuth } from "@/lib/auth-admin"
import { createServiceClient } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const adminAuth = await verifyAdminAuth(request)
    if (!adminAuth.isValid) {
      return NextResponse.json(
        { success: false, error: adminAuth.error || "Admin authentication required" },
        { status: 403 }
      )
    }

    const supabase = createServiceClient()

    const [
      usersResult,
      machinesResult,
      withdrawalsResult,
      revenueResult
    ] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("user_machines").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("withdrawals").select("amount").eq("status", "pending"),
      supabase
        .from("transactions")
        .select("amount")
        .eq("type", "machine_purchase")
        .in("status", ["successful", "completed"])
    ])

    if (usersResult.error) throw usersResult.error
    if (machinesResult.error) throw machinesResult.error
    if (withdrawalsResult.error) throw withdrawalsResult.error
    if (revenueResult.error) throw revenueResult.error

    const pendingWithdrawals = (withdrawalsResult.data || []).reduce(
      (sum: number, withdrawal: any) => sum + Number(withdrawal.amount || 0),
      0
    )
    const totalRevenue = (revenueResult.data || []).reduce(
      (sum: number, transaction: any) => sum + Math.abs(Number(transaction.amount || 0)),
      0
    )

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: usersResult.count || 0,
        totalRevenue,
        activeMachines: machinesResult.count || 0,
        pendingWithdrawals,
        pendingWithdrawalCount: withdrawalsResult.data?.length || 0
      }
    })
  } catch (error: any) {
    console.error("Admin stats error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load admin stats" },
      { status: 500 }
    )
  }
}
