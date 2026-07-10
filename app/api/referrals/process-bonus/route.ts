import { NextRequest, NextResponse } from "next/server"
import { processReferralBonusForMachine } from "@/lib/payment-fulfillment"
import { createServiceClient, requireAuthenticatedUser } from "@/lib/server-auth"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response

    const supabase = createServiceClient()
    const { userId, machineId } = await request.json()

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 })
    }

    if (userId !== auth.user.id) {
      return NextResponse.json({ success: false, error: "Referral bonus user mismatch" }, { status: 403 })
    }

    let targetMachineId = machineId

    if (!targetMachineId) {
      const { data: latestMachine, error } = await supabase
        .from("user_machines")
        .select("machine_type_id")
        .eq("user_id", userId)
        .order("purchased_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error || !latestMachine) {
        return NextResponse.json({ success: false, error: "Machine not found" }, { status: 404 })
      }

      targetMachineId = latestMachine.machine_type_id
    }

    const result = await processReferralBonusForMachine(supabase, userId, targetMachineId.toString())

    return NextResponse.json({
      success: true,
      bonusPaid: result.paid,
      message: result.message
    })
  } catch (error: any) {
    console.error("Referral bonus processing error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Referral bonus API is active"
  })
}
