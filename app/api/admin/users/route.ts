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
    const { data, error } = await supabase
      .from("users")
      .select("id, email, username, full_name, country, wallet_balance, machines_owned, verification_status, verification_completed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json({ success: true, users: data || [] })
  } catch (error: any) {
    console.error("Admin users load error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load users" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminAuth = await verifyAdminAuth(request)
    if (!adminAuth.isValid) {
      return NextResponse.json(
        { success: false, error: adminAuth.error || "Admin authentication required" },
        { status: 403 }
      )
    }

    const { userId, verificationStatus } = await request.json()
    const cleanStatus = String(verificationStatus || "").toLowerCase()

    if (!userId || !["verified", "rejected", "in_progress", "pending"].includes(cleanStatus)) {
      return NextResponse.json({ success: false, error: "Invalid verification update" }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("users")
      .update({
        verification_status: cleanStatus,
        verification_completed_at: cleanStatus === "verified" ? new Date().toISOString() : null
      })
      .eq("id", userId)
      .select("id, verification_status, verification_completed_at")
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, user: data })
  } catch (error: any) {
    console.error("Admin user update error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update user" },
      { status: 500 }
    )
  }
}
