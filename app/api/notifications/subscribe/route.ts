import { NextRequest, NextResponse } from "next/server"
import { createServiceClient, requireAuthenticatedUser } from "@/lib/server-auth"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    const supabase = createServiceClient()

    const { userId: requestedUserId, subscription, language } = await request.json()
    const userId = auth.user.id

    if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ success: false, error: "Invalid push subscription" }, { status: 400 })
    }

    if (requestedUserId && requestedUserId !== userId) {
      return NextResponse.json({ success: false, error: "Subscription user mismatch" }, { status: 403 })
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          language: language || "en",
          updated_at: new Date().toISOString()
        },
        { onConflict: "endpoint" }
      )

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
