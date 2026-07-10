import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/server-auth"
import { convertToXAF } from "@/lib/currency"
import { fulfillMachinePurchase } from "@/lib/payment-fulfillment"

const successfulStatuses = new Set(["completed", "success", "successful"])

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const {
      transaction_id,
      status,
      amount,
      currency,
      customer_transaction_id
    } = payload

    if (!customer_transaction_id) {
      return NextResponse.json({ message: "Missing customer_transaction_id" }, { status: 400 })
    }

    const supabase = createServiceClient()
    const normalizedStatus = String(status || "pending").toLowerCase()

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("id, user_id, amount, status, type, external_id, metadata, created_at")
      .eq("external_id", customer_transaction_id)
      .eq("provider", "futurapay")
      .maybeSingle()

    if (txError || !transaction) {
      return NextResponse.json({ message: "Transaction not found" }, { status: 404 })
    }

    const isSuccess = successfulStatuses.has(normalizedStatus)
    const metadata = transaction.metadata || {}
    let nextMetadata = {
      ...metadata,
      futurapay_webhook: payload
    }

    if (isSuccess) {
      const amountXAF = Number.isFinite(Number(amount))
        ? convertToXAF(Number(amount), String(currency || transaction.metadata?.local_currency || "XAF").toUpperCase())
        : Number(transaction.amount || 0)

      if (transaction.type === "machine_purchase") {
        await fulfillMachinePurchase(supabase, transaction)
      } else if (!metadata.futurapay_wallet_credited) {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("wallet_balance")
          .eq("id", transaction.user_id)
          .single()

        if (userError || !userData) {
          return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        const newBalance = Number(userData.wallet_balance || 0) + amountXAF

        const { error: balanceError } = await supabase
          .from("users")
          .update({ wallet_balance: newBalance })
          .eq("id", transaction.user_id)

        if (balanceError) {
          return NextResponse.json({ message: balanceError.message }, { status: 500 })
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
        provider_transaction_id: transaction_id || null,
        updated_at: new Date().toISOString(),
        metadata: nextMetadata
      })
      .eq("id", transaction.id)

    return NextResponse.json({ message: "Webhook received" })
  } catch (error: any) {
    console.error("Futurapay webhook error:", error)
    return NextResponse.json({ message: error.message || "Webhook error" }, { status: 500 })
  }
}
