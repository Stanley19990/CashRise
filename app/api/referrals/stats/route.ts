import { NextRequest, NextResponse } from "next/server"
import { requireAuthenticatedUser, createServiceClient } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response

    const supabase = createServiceClient()

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("referral_code, username")
      .eq("id", auth.user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ success: false, error: profileError.message }, { status: 500 })
    }

    const { data: referrals, error: referralsError } = await supabase
      .from("referrals")
      .select(`
        id,
        referred_id,
        bonus,
        referral_date,
        completed_at,
        referred_user:users!referrals_referred_id_fkey(
          username,
          email,
          created_at
        )
      `)
      .eq("referrer_id", auth.user.id)
      .order("referral_date", { ascending: false })

    if (referralsError) {
      return NextResponse.json({ success: false, error: referralsError.message }, { status: 500 })
    }

    const referredIds = (referrals || []).map((referral: any) => referral.referred_id).filter(Boolean)
    const purchasedMap: Record<string, boolean> = {}
    const purchasedAtMap: Record<string, string> = {}

    if (referredIds.length > 0) {
      const { data: machines, error: machinesError } = await supabase
        .from("user_machines")
        .select("user_id, purchased_at")
        .in("user_id", referredIds)
        .order("purchased_at", { ascending: true })

      if (machinesError) {
        return NextResponse.json({ success: false, error: machinesError.message }, { status: 500 })
      }

      ;(machines || []).forEach((machine: any) => {
        if (!machine.user_id) return
        purchasedMap[machine.user_id] = true
        if (!purchasedAtMap[machine.user_id] && machine.purchased_at) {
          purchasedAtMap[machine.user_id] = machine.purchased_at
        }
      })
    }

    const enrichedReferrals = (referrals || []).map((referral: any) => ({
      ...referral,
      hasPurchased: Boolean(purchasedMap[referral.referred_id]),
      purchasedAt: purchasedAtMap[referral.referred_id] || referral.completed_at || null
    }))

    return NextResponse.json({
      success: true,
      referralCode: profile?.referral_code || "",
      username: profile?.username || "",
      referrals: enrichedReferrals
    })
  } catch (error: any) {
    console.error("Referral stats error:", error)
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 })
  }
}
