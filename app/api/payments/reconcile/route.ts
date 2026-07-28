import { NextRequest, NextResponse } from "next/server"
import {
  ensureFapshiTransaction,
  extractFapshiStatus,
  getFapshiPendingGraceUntil,
  isFapshiDeferredFailureStatus,
  normalizeFapshiStatus,
  shouldKeepFapshiPaymentPending
} from "@/lib/fapshi-payments"
import { fulfillMachinePurchase } from "@/lib/payment-fulfillment"
import { createNotificationAndPush } from "@/lib/push-server"
import { createServiceClient, requireAuthenticatedUser } from "@/lib/server-auth"

const FAPSHI_BASE_URL = process.env.FAPSHI_BASE_URL || process.env.FAPSHI_ENVIRONMENT || "https://live.fapshi.com"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    const supabase = createServiceClient()

    if (!process.env.FAPSHI_API_USER || !process.env.FAPSHI_API_KEY) {
      return NextResponse.json({ success: false, error: "Mobile money payments are not configured yet" }, { status: 500 })
    }

    const { transId } = await request.json()
    if (!transId) {
      return NextResponse.json({ success: false, error: "Missing transId" }, { status: 400 })
    }

    const response = await fetch(`${FAPSHI_BASE_URL}/payment-status/${transId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apiuser: process.env.FAPSHI_API_USER,
        apikey: process.env.FAPSHI_API_KEY
      }
    })

    const responseData = await response.json().catch(() => null)
    console.log("Fapshi status response:", {
      transId,
      ok: response.ok,
      statusCode: response.status,
      status: extractFapshiStatus(responseData),
      message: responseData?.message || responseData?.data?.message || null,
      reason: responseData?.reason || responseData?.data?.reason || responseData?.data?.failureReason || null,
      medium: responseData?.medium || responseData?.data?.medium || null
    })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: responseData?.message || "Failed to check status" },
        { status: 502 }
      )
    }

    const reportedStatus = normalizeFapshiStatus(extractFapshiStatus(responseData))
    let { data: transaction } = await supabase
      .from("transactions")
      .select("id, user_id, amount, type, external_id, metadata, status, created_at")
      .eq("fapshi_trans_id", transId)
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!transaction) {
      transaction = await ensureFapshiTransaction(supabase, responseData)
    }

    if (!transaction) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 })
    }

    if (transaction.user_id !== auth.user.id) {
      return NextResponse.json({ success: false, error: "Transaction user mismatch" }, { status: 403 })
    }

    const alreadySuccessful = transaction.status === "successful"
    const pendingGraceUntil = getFapshiPendingGraceUntil(reportedStatus, transaction.created_at)
    const normalizedStatus = alreadySuccessful
      ? "successful"
      : shouldKeepFapshiPaymentPending(reportedStatus, transaction.created_at)
        ? "pending"
        : isFapshiDeferredFailureStatus(reportedStatus)
          ? "failed"
          : reportedStatus
    const statusMetadata = {
      ...(transaction.metadata || {}),
      fapshi_status: reportedStatus,
      fapshi_pending_grace_until: pendingGraceUntil,
      cashrise_status_note:
        normalizedStatus === "pending" && reportedStatus !== "pending"
          ? "CashRise is holding this payment pending during the confirmation grace window."
          : null,
      fapshi_medium: responseData?.medium || responseData?.data?.medium || transaction.metadata?.fapshi_medium || null,
      fapshi_amount: responseData?.amount || responseData?.data?.amount || null,
      fapshi_revenue: responseData?.revenue || responseData?.data?.revenue || null,
      fapshi_reason:
        responseData?.reason ||
        responseData?.data?.reason ||
        responseData?.data?.failureReason ||
        responseData?.message ||
        responseData?.error ||
        null,
      fapshi_date_initiated: responseData?.dateInitiated || responseData?.data?.dateInitiated || null,
      fapshi_date_confirmed: responseData?.dateConfirmed || responseData?.data?.dateConfirmed || null
    }

    await supabase
      .from("transactions")
      .update({
        status: normalizedStatus,
        metadata: statusMetadata,
        updated_at: new Date().toISOString()
      })
      .eq("id", transaction.id)

    let fulfillment = null
    if (normalizedStatus === "successful") {
      fulfillment = await fulfillMachinePurchase(supabase, transaction)
    } else if (normalizedStatus === "failed") {
      const notificationKey = `payment_${transId}_failed`
      const { data: existingFailureNotice } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", transaction.user_id)
        .eq("metadata->>notification_key", notificationKey)
        .maybeSingle()

      if (!existingFailureNotice) {
        await createNotificationAndPush(supabase, {
          user_id: transaction.user_id,
          title: "Payment failed",
          message: "Your machine payment was not completed. Please try again or use another number.",
          type: "payment_failed",
          action_url: "/dashboard",
          related_id: transId,
          metadata: {
            notification_key: notificationKey,
            trans_id: transId
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      status: normalizedStatus,
      reportedStatus,
      pendingGrace: normalizedStatus === "pending" && reportedStatus !== "pending",
      recovered: Boolean((transaction as any)?.metadata?.recovered_from_fapshi),
      fulfillment
    })
  } catch (error: any) {
    console.error("Reconcile error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
