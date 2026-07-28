import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import {
  ensureFapshiTransaction,
  isFapshiDeferredFailureStatus,
  normalizeFapshiStatus,
  shouldKeepFapshiPaymentPending
} from "@/lib/fapshi-payments"
import { fulfillMachinePurchase } from "@/lib/payment-fulfillment"
import { createNotificationAndPush } from "@/lib/push-server"
import { createServiceClient } from "@/lib/server-auth"

const FAPSHI_BASE_URL = process.env.FAPSHI_BASE_URL || process.env.FAPSHI_ENVIRONMENT || "https://live.fapshi.com"

const supabase = new Proxy({} as ReturnType<typeof createServiceClient>, {
  get(_target, prop) {
    return (createServiceClient() as any)[prop as keyof ReturnType<typeof createServiceClient>]
  }
})

const processedWebhooks = new Set<string>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const webhookData = JSON.parse(body)

    if (process.env.FAPSHI_WEBHOOK_SECRET) {
      const signature = request.headers.get("x-fapshi-signature") || request.headers.get("signature")

      if (signature) {
        const expectedSignature = crypto
          .createHmac("sha256", process.env.FAPSHI_WEBHOOK_SECRET)
          .update(body)
          .digest("hex")

        if (signature !== expectedSignature) {
          console.warn("Fapshi webhook signature mismatch. Verifying transaction with Fapshi status API instead.")
        }
      } else {
        console.warn("Fapshi webhook signature header missing. Verifying transaction with Fapshi status API instead.")
      }
    } else {
      console.warn("FAPSHI_WEBHOOK_SECRET is not set. Signature verification skipped.")
    }

    const { transId, status } = webhookData

    if (!transId) {
      return NextResponse.json({ error: "Missing transId" }, { status: 400 })
    }

    if (processedWebhooks.has(transId)) {
      return NextResponse.json({ received: true, duplicate: true })
    }

    processedWebhooks.add(transId)
    setTimeout(() => processedWebhooks.delete(transId), 10 * 60 * 1000)

    let verifiedPayload = webhookData
    if (process.env.FAPSHI_API_USER && process.env.FAPSHI_API_KEY) {
      const statusResponse = await fetch(`${FAPSHI_BASE_URL}/payment-status/${transId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apiuser: process.env.FAPSHI_API_USER,
          apikey: process.env.FAPSHI_API_KEY
        }
      })

      const statusPayload = await statusResponse.json().catch(() => null)
      if (statusResponse.ok && statusPayload) {
        verifiedPayload = {
          ...webhookData,
          ...statusPayload,
          data: {
            ...(webhookData.data || {}),
            ...(statusPayload.data || {})
          }
        }
      } else {
        console.error("Unable to verify Fapshi webhook status:", {
          transId,
          statusCode: statusResponse.status,
          message: statusPayload?.message || statusPayload?.error || null
        })
      }
    } else {
      console.error("Fapshi API credentials missing. Webhook status could not be independently verified.")
    }

    const reportedStatus = normalizeFapshiStatus(verifiedPayload.status || verifiedPayload.data?.status || status)
    const transactionRecord = await ensureFapshiTransaction(supabase, verifiedPayload)
    const normalizedStatus = shouldKeepFapshiPaymentPending(reportedStatus, transactionRecord?.created_at)
      ? "pending"
      : isFapshiDeferredFailureStatus(reportedStatus)
        ? "failed"
        : reportedStatus
    const isSuccess = normalizedStatus === "successful"
    const statusMetadata = {
      ...(transactionRecord?.metadata || {}),
      fapshi_status: reportedStatus,
      fapshi_medium: verifiedPayload.medium || verifiedPayload.data?.medium || transactionRecord?.metadata?.fapshi_medium || null,
      fapshi_amount: verifiedPayload.amount || verifiedPayload.data?.amount || null,
      fapshi_revenue: verifiedPayload.revenue || verifiedPayload.data?.revenue || null,
      fapshi_reason:
        verifiedPayload.reason ||
        verifiedPayload.data?.reason ||
        verifiedPayload.data?.failureReason ||
        verifiedPayload.message ||
        verifiedPayload.error ||
        null,
      fapshi_date_initiated: verifiedPayload.dateInitiated || verifiedPayload.data?.dateInitiated || null,
      fapshi_date_confirmed: verifiedPayload.dateConfirmed || verifiedPayload.data?.dateConfirmed || null
    }

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        status: isSuccess ? "successful" : normalizedStatus,
        metadata: statusMetadata,
        updated_at: new Date().toISOString()
      })
      .eq("fapshi_trans_id", transId)

    if (updateError) {
      console.error("Fapshi transaction update error:", updateError)
    }

    if (isSuccess) {
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .select("id, user_id, external_id, metadata, created_at")
        .eq("fapshi_trans_id", transId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (txError || !transaction) {
        console.error("Unable to load Fapshi transaction for activation:", txError)
      } else {
        await fulfillMachinePurchase(supabase, transaction)
      }
    } else if (normalizedStatus === "failed") {
      const { data: transaction } = await supabase
        .from("transactions")
        .select("user_id")
        .eq("fapshi_trans_id", transId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (transaction?.user_id) {
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
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("Fapshi webhook error:", error)
    return NextResponse.json({ error: error.message || "Webhook error" }, { status: 500 })
  }
}
