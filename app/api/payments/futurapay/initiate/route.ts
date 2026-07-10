import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createServiceClient, requireAuthenticatedUser } from "@/lib/server-auth"
import { convertToXAF, normalizeCountry } from "@/lib/currency"

const getFuturapayConfig = () => {
  const merchantKey = process.env.FUTURAPAY_MERCHANT_KEY
  const siteId = process.env.FUTURAPAY_SITE_ID
  const apiKey = process.env.FUTURAPAY_API_KEY
  const env = (process.env.FUTURAPAY_ENV || "production").toLowerCase()
  const isSandbox = ["sandbox", "test", "testing", "development", "dev"].includes(env)

  if (!merchantKey || !siteId || !apiKey) {
    throw new Error("International checkout is not configured yet")
  }

  return {
    merchantKey,
    siteId,
    apiKey,
    env,
    widgetBaseUrl: isSandbox
      ? "https://stage-payment-widget.futurapay.com/widget/deposit"
      : "https://payment-widget.futurapay.com/widget/deposit"
  }
}

const encryptPayload = (payload: Record<string, unknown>, merchantKey: string, apiKey: string, siteId: string) => {
  const key = crypto.createHash("md5").update(`${merchantKey}${apiKey}${siteId}`).digest("hex")
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key, "utf8"), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({
    ...payload,
    merchant_key: merchantKey,
    api_key: apiKey,
    site_id: siteId
  }), "utf8"), cipher.final()])
  const encryptedBase64 = encrypted.toString("base64")

  return {
    data: Buffer.from(encryptedBase64, "utf8").toString("base64"),
    iv: iv.toString("base64"),
    key: Buffer.from(apiKey, "utf8").toString("base64")
  }
}

const makeCustomerTransactionId = async (supabase: ReturnType<typeof createServiceClient>) => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = crypto.randomInt(10000000, 100000000).toString()
    const { data } = await supabase
      .from("transactions")
      .select("id")
      .eq("external_id", candidate)
      .maybeSingle()

    if (!data) return candidate
  }

  throw new Error("Unable to generate payment reference. Please try again.")
}

const normalizeCheckoutPhone = (phone: string, country: ReturnType<typeof normalizeCountry>) => {
  const trimmed = phone.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("+")) return trimmed

  const digits = trimmed.replace(/\D/g, "")
  if (!digits) return ""
  if (country.dialCode && digits.startsWith(country.dialCode)) return `+${digits}`
  if (country.dialCode) return `+${country.dialCode}${digits}`
  return `+${digits}`
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const amount = Number(body.amount)
    const currency = String(body.currency || "XAF").toUpperCase()
    const country = normalizeCountry(body.country || body.country_code || "CM")

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: "Invalid payment amount" }, { status: 400 })
    }

    const config = getFuturapayConfig()
    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from("users")
      .select("full_name, username, phone")
      .eq("id", auth.user.id)
      .maybeSingle()

    const displayName =
      body.name ||
      profile?.full_name ||
      profile?.username ||
      auth.user.user_metadata?.full_name ||
      auth.user.email ||
      "CashRise User"
    const rawPhone = body.phone || profile?.phone || auth.user.user_metadata?.phone || ""
    const checkoutPhone = normalizeCheckoutPhone(String(rawPhone), country)

    if (!checkoutPhone) {
      return NextResponse.json(
        { success: false, error: "Please enter a phone number before opening checkout" },
        { status: 400 }
      )
    }

    const amountXAF = convertToXAF(amount, currency)
    const transactionType = body.type || "deposit"
    const transactionAmount = transactionType === "machine_purchase" ? -Math.abs(amountXAF) : amountXAF
    const customerTransactionId = await makeCustomerTransactionId(supabase)

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: auth.user.id,
        type: transactionType,
        description: body.description || "Secure checkout payment",
        amount: transactionAmount,
        currency: "XAF",
        status: "pending",
        external_id: customerTransactionId,
        provider: "futurapay",
        metadata: {
          provider: "futurapay",
          local_amount: amount,
          local_currency: currency,
          country_code: country.code,
          purpose: body.purpose || "wallet_deposit",
          ...(body.metadata || {})
        }
      })
      .select("id")
      .single()

    if (txError) {
      return NextResponse.json({ success: false, error: txError.message }, { status: 500 })
    }

    const [firstName, ...lastNameParts] = String(displayName).trim().split(/\s+/)
    const lastName = lastNameParts.join(" ") || firstName || "User"

    const payload = {
      customer_transaction_id: customerTransactionId,
      amount,
      currency,
      country_code: country.code,
      customer_first_name: firstName || "CashRise",
      customer_last_name: lastName,
      customer_phone: checkoutPhone,
      customer_email: auth.user.email || ""
    }

    const encrypted = encryptPayload(payload, config.merchantKey, config.apiKey, config.siteId)
    const params = new URLSearchParams({
      data: encrypted.data,
      iv: encrypted.iv
    })
    params.set("key", encrypted.key)

    return NextResponse.json({
      success: true,
      transactionId: customerTransactionId,
      widgetUrl: `${config.widgetBaseUrl}?${params.toString()}`,
      encryptedQuery: params.toString()
    })
  } catch (error: any) {
    console.error("International checkout initiate error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to start secure checkout" },
      { status: 500 }
    )
  }
}
