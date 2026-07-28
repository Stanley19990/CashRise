import { NextRequest, NextResponse } from "next/server"
import { createServiceClient, requireAuthenticatedUser } from "@/lib/server-auth"

const MIN_WITHDRAWAL_XAF = 3000
const FIRST_WITHDRAWAL_WAIT_DAYS = 30
const BUILT_IN_INSTANT_WITHDRAWAL_USER_IDS = [
  "c48142ec-6d81-491c-86b9-89432ae34f62"
]

const getInstantWithdrawalAllowList = () =>
  [
    process.env.INSTANT_WITHDRAWAL_USER_IDS,
    process.env.INSTANT_WITHDRAWAL_USER_EMAILS,
    ...BUILT_IN_INSTANT_WITHDRAWAL_USER_IDS
  ]
    .filter(Boolean)
    .join(",")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const getFirstMachinePurchaseDate = async (supabase: ReturnType<typeof createServiceClient>, userId: string) => {
  const { data: profile } = await supabase
    .from("users")
    .select("first_machine_purchase_date")
    .eq("id", userId)
    .maybeSingle()

  if (profile?.first_machine_purchase_date) {
    const date = new Date(profile.first_machine_purchase_date)
    if (!Number.isNaN(date.getTime())) return date
  }

  const { data: machine } = await supabase
    .from("user_machines")
    .select("purchased_at")
    .eq("user_id", userId)
    .order("purchased_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!machine?.purchased_at) return null

  const date = new Date(machine.purchased_at)
  return Number.isNaN(date.getTime()) ? null : date
}

const getWithdrawalEligibility = async (
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  email?: string | null
) => {
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("wallet_balance, email, verification_status")
    .eq("id", userId)
    .single()

  if (userError || !userData) {
    throw new Error("User profile not found")
  }

  const allowList = getInstantWithdrawalAllowList()
  const cleanEmail = String(email || userData.email || "").toLowerCase()
  const hasInstantAccess = allowList.includes(userId.toLowerCase()) || (cleanEmail && allowList.includes(cleanEmail))
  const firstMachinePurchaseDate = await getFirstMachinePurchaseDate(supabase, userId)
  const unlockDate = firstMachinePurchaseDate ? addDays(firstMachinePurchaseDate, FIRST_WITHDRAWAL_WAIT_DAYS) : null
  const now = new Date()
  const isVerified = String(userData.verification_status || "").toLowerCase() === "verified"
  const daysRemaining = unlockDate
    ? Math.max(0, Math.ceil((unlockDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : FIRST_WITHDRAWAL_WAIT_DAYS

  let reason = ""
  if (!hasInstantAccess) {
    if (!firstMachinePurchaseDate) {
      reason = "Purchase your first machine to start the 30-day withdrawal countdown."
    } else if (unlockDate && now < unlockDate) {
      reason = `Your first withdrawal unlocks ${FIRST_WITHDRAWAL_WAIT_DAYS} days after your first machine purchase. ${daysRemaining} day(s) remaining.`
    } else if (!isVerified) {
      reason = "Complete and get approved for KYC verification before requesting withdrawals."
    }
  }

  return {
    userData,
    eligible: hasInstantAccess || (!!firstMachinePurchaseDate && !!unlockDate && now >= unlockDate && isVerified),
    hasInstantAccess,
    isVerified,
    firstMachinePurchaseDate: firstMachinePurchaseDate?.toISOString() || null,
    unlockDate: unlockDate?.toISOString() || null,
    daysRemaining,
    minWithdrawalXAF: MIN_WITHDRAWAL_XAF,
    reason
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response

    const supabase = createServiceClient()
    const eligibility = await getWithdrawalEligibility(supabase, auth.user.id, auth.user.email)

    return NextResponse.json({
      success: true,
      eligible: eligibility.eligible,
      hasInstantAccess: eligibility.hasInstantAccess,
      isVerified: eligibility.isVerified,
      firstMachinePurchaseDate: eligibility.firstMachinePurchaseDate,
      unlockDate: eligibility.unlockDate,
      daysRemaining: eligibility.daysRemaining,
      minWithdrawalXAF: eligibility.minWithdrawalXAF,
      reason: eligibility.reason,
      walletBalance: Number(eligibility.userData.wallet_balance || 0)
    })
  } catch (error: any) {
    console.error("Withdrawal eligibility error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Unable to check withdrawal eligibility" },
      { status: 500 }
    )
  }
}

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
    const eligibility = await getWithdrawalEligibility(supabase, auth.user.id, auth.user.email)
    const userData = eligibility.userData

    if (!userData) {
      return NextResponse.json({ success: false, error: "User profile not found" }, { status: 404 })
    }

    if (!eligibility.eligible) {
      return NextResponse.json(
        { success: false, error: eligibility.reason || "Withdrawal requirements are not complete yet" },
        { status: 403 }
      )
    }

    if (amount > Number(userData.wallet_balance || 0)) {
      return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 })
    }

    if (!eligibility.hasInstantAccess) {
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
    }

    const isInstantWithdrawal = eligibility.hasInstantAccess

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
        payment_details: {
          account_details: cleanAccountDetails,
          instant_withdrawal: isInstantWithdrawal
        },
        status: "pending",
        processed_at: null
      })
      .select("id, amount, status, created_at")
      .single()

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }

    if (isInstantWithdrawal) {
      const currentBalance = Number(userData.wallet_balance || 0)
      const nextBalance = currentBalance - amount
      const processedAt = new Date().toISOString()

      const { data: updatedUser, error: balanceError } = await supabase
        .from("users")
        .update({ wallet_balance: nextBalance })
        .eq("id", auth.user.id)
        .gte("wallet_balance", amount)
        .select("wallet_balance")
        .single()

      if (balanceError || !updatedUser) {
        await supabase
          .from("withdrawals")
          .update({ status: "rejected", processed_at: new Date().toISOString() })
          .eq("id", withdrawal.id)

        const balanceUpdateError = balanceError as { code?: string; message?: string } | null
        const noBalanceRowUpdated = !updatedUser || balanceUpdateError?.code === "PGRST116"
        return NextResponse.json(
          { success: false, error: noBalanceRowUpdated ? "Insufficient balance" : balanceUpdateError?.message || "Unable to deduct balance" },
          { status: noBalanceRowUpdated ? 400 : 500 }
        )
      }

      const completedPayload = {
        status: "completed",
        processed_at: processedAt,
        payment_details: {
          account_details: cleanAccountDetails,
          instant_withdrawal: true,
          instant_processed_at: processedAt
        }
      }
      const approvedPayload = {
        ...completedPayload,
        status: "approved"
      }

      let finalWithdrawalStatus = "completed"
      let { data: finalizedWithdrawal, error: finalizeError } = await supabase
        .from("withdrawals")
        .update(completedPayload)
        .eq("id", withdrawal.id)
        .select("id, amount, status, created_at, processed_at")
        .single()

      if (finalizeError) {
        finalWithdrawalStatus = "approved"
        const approvedResult = await supabase
          .from("withdrawals")
          .update(approvedPayload)
          .eq("id", withdrawal.id)
          .select("id, amount, status, created_at, processed_at")
          .single()

        finalizedWithdrawal = approvedResult.data
        finalizeError = approvedResult.error
      }

      if (finalizeError || !finalizedWithdrawal) {
        await supabase
          .from("users")
          .update({ wallet_balance: currentBalance })
          .eq("id", auth.user.id)

        return NextResponse.json(
          { success: false, error: finalizeError?.message || "Unable to finalize instant withdrawal" },
          { status: 500 }
        )
      }

      const { error: transactionError } = await supabase.from("transactions").insert({
        user_id: auth.user.id,
        type: "withdrawal",
        description: "Instant withdrawal completed",
        amount: -amount,
        currency: "XAF",
        status: "completed",
        metadata: {
          withdrawal_id: withdrawal.id,
          method: cleanMethod,
          instant_withdrawal: true,
          withdrawal_status: finalWithdrawalStatus,
          previous_balance: currentBalance,
          new_balance: nextBalance
        }
      })

      if (transactionError) {
        console.error("Instant withdrawal transaction log error:", transactionError)
      }

      return NextResponse.json({
        success: true,
        instant: true,
        message: "Withdrawal successful",
        withdrawal: finalizedWithdrawal,
        walletBalance: Number(updatedUser.wallet_balance || nextBalance)
      })
    }

    return NextResponse.json({ success: true, instant: false, withdrawal })
  } catch (error: any) {
    console.error("Withdrawal request error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
