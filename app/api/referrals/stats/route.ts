import { NextRequest, NextResponse } from "next/server"
import { requireAuthenticatedUser, createServiceClient } from "@/lib/server-auth"
import { processReferralBonusForMachine } from "@/lib/payment-fulfillment"

export const dynamic = "force-dynamic"

const REFERRAL_SELECT = `
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
`

async function loadReferrals(supabase: any, referrerId: string) {
  return supabase
    .from("referrals")
    .select(REFERRAL_SELECT)
    .eq("referrer_id", referrerId)
    .order("referral_date", { ascending: false })
}

async function repairMissingReferralRows(
  supabase: any,
  referrerId: string,
  referralCode: string,
  existingReferredIds: Set<string>
) {
  const directUsers: any[] = []

  const { data: byId } = await supabase
    .from("users")
    .select("id, created_at")
    .eq("referred_by", referrerId)

  directUsers.push(...(byId || []))

  if (referralCode) {
    const { data: byCode } = await supabase
      .from("users")
      .select("id, created_at")
      .eq("referred_by", referralCode)

    directUsers.push(...(byCode || []))
  }

  const rowsToCreate = directUsers
    .filter((user) => user?.id && user.id !== referrerId && !existingReferredIds.has(user.id))
    .filter((user, index, rows) => rows.findIndex((candidate) => candidate.id === user.id) === index)
    .map((user) => ({
      referrer_id: referrerId,
      referred_id: user.id,
      referral_date: user.created_at || new Date().toISOString(),
      bonus: 0,
      status: "pending"
    }))

  if (rowsToCreate.length === 0) return false

  const { error } = await supabase.from("referrals").insert(rowsToCreate)
  if (error) {
    console.error("Referral stats repair insert failed:", error)
    return false
  }

  return true
}

async function loadPurchaseMaps(supabase: any, referredIds: string[]) {
  const purchasedMap: Record<string, boolean> = {}
  const purchasedAtMap: Record<string, string> = {}
  const machineTypeMap: Record<string, string> = {}

  if (referredIds.length === 0) {
    return { purchasedMap, purchasedAtMap, machineTypeMap }
  }

  const { data: machines, error } = await supabase
    .from("user_machines")
    .select("user_id, machine_type_id, purchased_at")
    .in("user_id", referredIds)
    .order("purchased_at", { ascending: true })

  if (error) throw error

  ;(machines || []).forEach((machine: any) => {
    if (!machine.user_id) return
    purchasedMap[machine.user_id] = true
    if (!purchasedAtMap[machine.user_id] && machine.purchased_at) {
      purchasedAtMap[machine.user_id] = machine.purchased_at
    }
    if (!machineTypeMap[machine.user_id] && machine.machine_type_id) {
      machineTypeMap[machine.user_id] = machine.machine_type_id.toString()
    }
  })

  return { purchasedMap, purchasedAtMap, machineTypeMap }
}

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

    let { data: referrals, error: referralsError } = await loadReferrals(supabase, auth.user.id)

    if (referralsError) {
      return NextResponse.json({ success: false, error: referralsError.message }, { status: 500 })
    }

    const existingReferredIds = new Set<string>(
      (referrals || [])
        .map((referral: any) => referral.referred_id)
        .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    )

    const repairedMissingRows = await repairMissingReferralRows(
      supabase,
      auth.user.id,
      profile?.referral_code || "",
      existingReferredIds
    )

    if (repairedMissingRows) {
      const refreshed = await loadReferrals(supabase, auth.user.id)
      referrals = refreshed.data || []
      referralsError = refreshed.error

      if (referralsError) {
        return NextResponse.json({ success: false, error: referralsError.message }, { status: 500 })
      }
    }

    let referredIds = (referrals || []).map((referral: any) => referral.referred_id).filter(Boolean)
    let { purchasedMap, purchasedAtMap, machineTypeMap } = await loadPurchaseMaps(supabase, referredIds)

    const bonusRepairs = await Promise.all(
      (referrals || [])
        .filter((referral: any) => {
          const hasPurchased = Boolean(purchasedMap[referral.referred_id])
          const hasBonus = Number(referral.bonus || 0) > 0
          return hasPurchased && !hasBonus && machineTypeMap[referral.referred_id]
        })
        .map((referral: any) =>
          processReferralBonusForMachine(
            supabase,
            referral.referred_id,
            machineTypeMap[referral.referred_id]
          )
        )
    )

    if (bonusRepairs.some((result) => result.paid)) {
      const refreshed = await loadReferrals(supabase, auth.user.id)
      referrals = refreshed.data || []
      referralsError = refreshed.error

      if (referralsError) {
        return NextResponse.json({ success: false, error: referralsError.message }, { status: 500 })
      }

      referredIds = (referrals || []).map((referral: any) => referral.referred_id).filter(Boolean)
      ;({ purchasedMap, purchasedAtMap, machineTypeMap } = await loadPurchaseMaps(supabase, referredIds))
    }

    const enrichedReferrals = (referrals || []).map((referral: any) => ({
      ...referral,
      hasPurchased: Boolean(purchasedMap[referral.referred_id]),
      purchasedAt: purchasedAtMap[referral.referred_id] || referral.completed_at || null,
      machineTypeId: machineTypeMap[referral.referred_id] || null
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
