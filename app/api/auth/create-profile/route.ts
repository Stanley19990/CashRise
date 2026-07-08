import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createNotificationAndPush } from "@/lib/push-server"
import { getAuthenticatedUser } from "@/lib/server-auth"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const generateReferralCode = (fullName: string, userId: string): string => {
  const cleanName = fullName
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .substring(0, 8)

  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase()
  const userIdPart = userId.substring(0, 4)

  return `${cleanName}${randomStr}${userIdPart}`
}

const generateUsername = (fullName: string): string => {
  return (
    fullName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 20) + Math.random().toString(36).substring(2, 6)
  )
}

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      email,
      fullName,
      country,
      phone,
      referralCode,
      generatedReferralCode,
      generatedUsername
    } = await request.json()

    if (!userId || !fullName || !country) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      )
    }

    const authenticatedUser = await getAuthenticatedUser(request)

    if (authenticatedUser && authenticatedUser.id !== userId) {
      return NextResponse.json(
        { success: false, error: "Profile user mismatch" },
        { status: 403 }
      )
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
    if (authError || !authUser?.user) {
      return NextResponse.json(
        { success: false, error: "Auth user not found" },
        { status: 404 }
      )
    }

    const { data: existingUser, error: existingError } = await supabase
      .from("users")
      .select("id, referral_code")
      .eq("id", userId)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { success: false, error: "Failed to check existing profile" },
        { status: 500 }
      )
    }

    if (!authenticatedUser) {
      const createdAt = authUser.user.created_at ? new Date(authUser.user.created_at).getTime() : 0
      const isRecentAuthUser = createdAt > 0 && Date.now() - createdAt < 10 * 60 * 1000
      if (!isRecentAuthUser || existingUser) {
        return NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 }
        )
      }
    }

    const authEmail = authUser.user.email || email || null

    const referralCodeForUser =
      existingUser?.referral_code ||
      generatedReferralCode ||
      generateReferralCode(fullName, userId)

    const usernameForUser = generatedUsername || generateUsername(fullName)

    const cleanReferralCode = typeof referralCode === "string" ? referralCode.trim() : ""
    let referrerId: string | null = null

    if (cleanReferralCode) {
      const { data: referrer } = await supabase
        .from("users")
        .select("id, referral_code")
        .eq("referral_code", cleanReferralCode)
        .maybeSingle()

      if (referrer?.id && referrer.id !== userId) {
        referrerId = referrer.id
      }
    }

    const userProfile: Record<string, any> = {
      id: userId,
      email: authEmail,
      username: usernameForUser,
      full_name: fullName,
      country,
      phone: phone || null,
      referral_code: referralCodeForUser
    }

    if (referrerId) {
      userProfile.referred_by = referrerId
    }

    const { error: upsertError } = await supabase
      .from("users")
      .upsert(userProfile, { onConflict: "id" })

    if (upsertError) {
      return NextResponse.json(
        { success: false, error: upsertError.message || "Failed to create user profile" },
        { status: 500 }
      )
    }

    if (referrerId) {
      const { data: existingReferral } = await supabase
        .from("referrals")
        .select("id")
        .eq("referred_id", userId)
        .maybeSingle()

      if (!existingReferral) {
        const { error: referralInsertError } = await supabase.from("referrals").insert({
          referrer_id: referrerId,
          referred_id: userId,
          referral_date: new Date().toISOString(),
          bonus: 0,
          status: "pending"
        })

        if (referralInsertError) {
          console.error("Referral insert error:", referralInsertError)
        } else {
          await createNotificationAndPush(supabase, {
            user_id: referrerId,
            title: "New referral joined",
            message: `${fullName} joined using your referral link.`,
            type: "referral_joined",
            action_url: "/referrals",
            related_id: userId,
            metadata: {
              referred_user_id: userId,
              referral_code: cleanReferralCode
            }
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("❌ Create profile error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
