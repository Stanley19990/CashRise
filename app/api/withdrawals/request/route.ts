import { NextRequest, NextResponse } from "next/server"
import { createServiceClient, requireAuthenticatedUser } from "@/lib/server-auth"

const MIN_WITHDRAWAL_XAF = 3000

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response

    const { amountXAF, method, accountDetails } = await request.json()
    const amount = Number(amountXAF)
    const cleanMethod = typeof method === "string" ? method.trim() : ""
    const cleanAccountDetails = typeof accountDetails === "string" ? accountDetails.trim() : ""

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: "Please enter a valid withdrawal amount" }, { status: 400 })
    }

    if (amount < MIN_WITHDRAWAL_XAF) {
      return NextResponse.json(
        { success: false, error: `Minimum withdrawal amount is ${MIN_WITHDRAWAL_XAF} XAF` },
        { status: 400 }
      )
    }

    if (!cleanMethod || !cleanAccountDetails) {
      return NextResponse.json(
        { success: false, error: "Please select a withdrawal method and enter account details" },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("wallet_balance, created_at")
      .eq("id", auth.user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: "User profile not found" }, { status: 404 })
    }

    const createdAt = userData.created_at ? new Date(userData.created_at) : null
    const oneMonthLater = createdAt ? new Date(createdAt) : null
    oneMonthLater?.setMonth(createdAt!.getMonth() + 1)

    if (!oneMonthLater || new Date() < oneMonthLater) {
      return NextResponse.json(
        { success: false, error: "You must use the app for at least 1 month before requesting a withdrawal" },
        { status: 403 }
      )
    }

    if (amount > Number(userData.wallet_balance || 0)) {
      return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 })
    }

    const { data: pendingWithdrawal, error: pendingError } = await supabase
      .from("withdrawals")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle()

    if (pendingError) {
      return NextResponse.json({ success: false, error: pendingError.message }, { status: 500 })
    }

    if (pendingWithdrawal) {
      return NextResponse.json(
        { success: false, error: "You already have a pending withdrawal request awaiting review" },
        { status: 409 }
      )
    }

    const { data: withdrawal, error: insertError } = await supabase
      .from("withdrawals")
      .insert({
        user_id: auth.user.id,
        amount,
        amount_usd: amount / 573.9,
        currency: "XAF",
        method: cleanMethod,
        account_details: cleanAccountDetails,
        payment_method: cleanMethod,
        payment_details: { account_details: cleanAccountDetails },
        status: "pending",
        processed_at: null
      })
      .select("id, amount, status, created_at")
      .single()

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, withdrawal })
  } catch (error: any) {
    console.error("Withdrawal request error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
