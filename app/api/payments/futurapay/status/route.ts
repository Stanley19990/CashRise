import { NextRequest, NextResponse } from "next/server"
import { createServiceClient, requireAuthenticatedUser } from "@/lib/server-auth"
import { convertToXAF } from "@/lib/currency"
import { fulfillMachinePurchase } from "@/lib/payment-fulfillment"

const FUTURAPAY_STATUS_URL = "https://api.futurapay.com/api/v1/futurapay/payment/status"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response

    const { transactionId } = await request.json()
    if (!transactionId) {
      return NextResponse.json({ success: false, error: "Missing transactionId" }, { status: 400 })
    }

    const apiKey = process.env.FUTURAPAY_API_KEY
    const siteId = process.env.FUTURAPAY_SITE_ID
    if (!apiKey || !siteId) {
      return NextResponse.json({ success: false, error: "International checkout is not configured yet" }, { status: 500 })
    }

    const response = await fetch(FUTURAPAY_STATUS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        site_id: siteId,
        customer_transaction_id: transactionId
      })
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.warn("Futurapay status check pending or unavailable:", data)
      return NextResponse.json({
        success: true,
        status: "pending"
      })
    }

    const normalizedStatus = String(data?.status || data?.data?.status || "pending").toLowerCase()
    const supabase = createServiceClient()

    const { data: transaction } = await supabase
      .from("transactions")
      .select("id, user_id, amount, status, type, external_id, metadata, created_at")
      .eq("external_id", transactionId)
      .eq("provider", "futurapay")
      .maybeSingle()

    if (transaction?.user_id !== auth.user.id) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 })
    }

    const isSuccess = ["completed", "success", "successful"].includes(normalizedStatus)
    const metadata = transaction.metadata || {}
    let nextMetadata = {
      ...metadata,
      futurapay_status_response: data
    }

    if (isSuccess) {
      if (transaction.type === "machine_purchase") {
        await fulfillMachinePurchase(supabase, transaction)
      } else if (!metadata.futurapay_wallet_credited) {
        const amountFromProvider = Number(data?.amount || data?.data?.amount)
        const currencyFromProvider = String(data?.currency || data?.data?.currency || metadata.local_currency || "XAF")
        const amountXAF = Number.isFinite(amountFromProvider)
          ? convertToXAF(amountFromProvider, currencyFromProvider.toUpperCase())
          : Number(transaction.amount || 0)

        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("wallet_balance")
          .eq("id", transaction.user_id)
          .single()

        if (userError || !userData) {
          return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
        }

        const { error: balanceError } = await supabase
          .from("users")
          .update({ wallet_balance: Number(userData.wallet_balance || 0) + amountXAF })
          .eq("id", transaction.user_id)

        if (balanceError) {
          return NextResponse.json({ success: false, error: balanceError.message }, { status: 500 })
        }

        nextMetadata = {
          ...nextMetadata,
          futurapay_wallet_credited: true,
          futurapay_wallet_credited_at: new Date().toISOString(),
          futurapay_wallet_credit_xaf: amountXAF
        }
      }
    }

    await supabase
      .from("transactions")
      .update({
        status: isSuccess ? "completed" : normalizedStatus,
        provider_transaction_id: data?.transaction_id || data?.data?.transaction_id || null,
        updated_at: new Date().toISOString(),
        metadata: nextMetadata
      })
      .eq("id", transaction.id)

    return NextResponse.json({
      success: true,
      status: normalizedStatus,
      raw: data
    })
  } catch (error: any) {
    console.error("International checkout status error:", error)
    return NextResponse.json({ success: true, status: "pending" })
  }
}
