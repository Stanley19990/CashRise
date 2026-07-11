import { NextRequest, NextResponse } from "next/server"
import { createServiceClient, requireAuthenticatedUser } from "@/lib/server-auth"

const todayKey = () => new Date().toISOString().slice(0, 10)
const dayKey = (date: Date) => date.toISOString().slice(0, 10)

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const missions = [
  { id: "visit_today", title: "Visit the app today", reward: 25 },
  { id: "claim_earnings", title: "Claim earnings from any machine", reward: 100 },
  { id: "purchase_machine", title: "Purchase any machine", reward: 150 },
  { id: "share_referral", title: "Share your referral link", reward: 50 },
  { id: "keep_3_machines", title: "Keep 3 or more machines running", reward: 200 }
]

const spinRewards = [
  { amount: 0, label: "Try again", weight: 36 },
  { amount: 25, label: "Small bonus", weight: 26 },
  { amount: 50, label: "Quick win", weight: 18 },
  { amount: 75, label: "Nice boost", weight: 10 },
  { amount: 100, label: "Reward drop", weight: 6 },
  { amount: 150, label: "Big spin", weight: 3 },
  { amount: 250, label: "Rare prize", weight: 1 }
]

async function loadRewardContext(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const today = todayKey()
  const startOfToday = `${today}T00:00:00.000Z`

  const [profileResult, machinesResult, todayTxResult, claimsResult, stateResult, referralResult] = await Promise.all([
    supabase
      .from("users")
      .select("wallet_balance, total_earned, bonus_wallet_balance, verification_status")
      .eq("id", userId)
      .single(),
    supabase
      .from("user_machines")
      .select("id, is_active, purchased_at")
      .eq("user_id", userId),
    supabase
      .from("transactions")
      .select("type, created_at, metadata")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("created_at", startOfToday),
    supabase
      .from("reward_claims")
      .select("reward_type, claim_key, amount, created_at")
      .eq("user_id", userId)
      .gte("created_at", startOfToday),
    supabase
      .from("user_reward_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("referrals")
      .select("id")
      .eq("referrer_id", userId)
  ])

  if (profileResult.error || !profileResult.data) {
    throw new Error(profileResult.error?.message || "User profile not found")
  }

  const machines = machinesResult.data || []
  const todayTransactions = todayTxResult.data || []
  const todayClaims = claimsResult.data || []
  const state = stateResult.data || {
    daily_streak: 0,
    last_daily_claim_date: null,
    last_spin_date: null,
    bonus_wallet_balance: Number(profileResult.data.bonus_wallet_balance || 0)
  }

  const claimKeys = new Set(todayClaims.map((claim: any) => claim.claim_key))
  const hasClaimedEarningsToday = todayTransactions.some((tx: any) => tx.type === "mining_earnings")
  const machineCount = machines.length
  const activeMachineCount = machines.filter((machine: any) => machine.is_active).length
  const referralCount = referralResult.data?.length || 0

  const missionStatus = missions.map((mission) => {
    const claimKey = `mission:${today}:${mission.id}`
    const completed =
      mission.id === "visit_today" ||
      (mission.id === "claim_earnings" && hasClaimedEarningsToday) ||
      (mission.id === "purchase_machine" && machineCount > 0) ||
      mission.id === "share_referral" ||
      (mission.id === "keep_3_machines" && activeMachineCount >= 3)

    return {
      ...mission,
      completed,
      claimed: claimKeys.has(claimKey),
      claimKey
    }
  })

  return {
    profile: profileResult.data,
    state,
    machineCount,
    activeMachineCount,
    referralCount,
    hasClaimedEarningsToday,
    missionStatus,
    todayClaims
  }
}

async function grantReward(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  rewardType: string,
  claimKey: string,
  amount: number,
  description: string,
  metadata: Record<string, unknown> = {}
) {
  const { data: existingClaim } = await supabase
    .from("reward_claims")
    .select("id")
    .eq("user_id", userId)
    .eq("claim_key", claimKey)
    .maybeSingle()

  if (existingClaim) {
    return { granted: false, message: "This reward has already been claimed." }
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("wallet_balance, total_earned, bonus_wallet_balance")
    .eq("id", userId)
    .single()

  if (profileError || !profile) {
    throw new Error(profileError?.message || "User profile not found")
  }

  const { error: claimError } = await supabase.from("reward_claims").insert({
    user_id: userId,
    reward_type: rewardType,
    claim_key: claimKey,
    amount,
    currency: "XAF",
    metadata
  })

  if (claimError) {
    if (claimError.code === "23505") {
      return { granted: false, message: "This reward has already been claimed." }
    }
    throw claimError
  }

  if (amount > 0) {
    const nextWallet = Number(profile.wallet_balance || 0) + amount
    const nextEarned = Number(profile.total_earned || 0) + amount
    const nextBonusWallet = Number(profile.bonus_wallet_balance || 0) + amount

    const { error: balanceError } = await supabase
      .from("users")
      .update({
        wallet_balance: nextWallet,
        total_earned: nextEarned,
        bonus_wallet_balance: nextBonusWallet
      })
      .eq("id", userId)

    if (balanceError) throw balanceError

    await supabase.from("user_reward_state").upsert({
      user_id: userId,
      bonus_wallet_balance: nextBonusWallet,
      updated_at: new Date().toISOString()
    })

    await supabase.from("transactions").insert({
      user_id: userId,
      type: "bonus",
      description,
      amount,
      currency: "XAF",
      status: "completed",
      external_id: claimKey,
      metadata: {
        reward_type: rewardType,
        bonus_wallet: true,
        ...metadata
      }
    })
  }

  return { granted: true, amount, message: amount > 0 ? `${amount} XAF added to your wallet.` : "Spin completed." }
}

async function syncAchievements(supabase: ReturnType<typeof createServiceClient>, userId: string, context: any) {
  const { data: allTransactions } = await supabase
    .from("transactions")
    .select("type")
    .eq("user_id", userId)
    .eq("status", "completed")

  const transactionTypes = new Set((allTransactions || []).map((tx: any) => tx.type))
  const achievements = [
    {
      key: "first_machine",
      title: "First Machine",
      description: "Purchased your first machine",
      unlocked: context.machineCount > 0
    },
    {
      key: "first_claim",
      title: "First Claim",
      description: "Claimed mining earnings",
      unlocked: transactionTypes.has("mining_earnings")
    },
    {
      key: "daily_streak_3",
      title: "3-Day Streak",
      description: "Built a 3-day reward streak",
      unlocked: Number(context.state.daily_streak || 0) >= 3
    },
    {
      key: "referral_starter",
      title: "Inviter",
      description: "Invited your first user",
      unlocked: context.referralCount > 0
    },
    {
      key: "lucky_player",
      title: "Lucky Player",
      description: "Used Lucky Spin",
      unlocked: transactionTypes.has("bonus")
    },
    {
      key: "verified_member",
      title: "Verified Member",
      description: "Completed approved KYC",
      unlocked: String(context.profile.verification_status || "").toLowerCase() === "verified"
    }
  ]

  const unlocked = achievements.filter((achievement) => achievement.unlocked)
  if (unlocked.length > 0) {
    await supabase.from("user_achievements").upsert(
      unlocked.map((achievement) => ({
        user_id: userId,
        achievement_key: achievement.key,
        metadata: {
          title: achievement.title,
          description: achievement.description
        }
      })),
      { onConflict: "user_id,achievement_key" }
    )
  }

  return achievements
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response

    const supabase = createServiceClient()
    const context = await loadRewardContext(supabase, auth.user.id)
    const achievements = await syncAchievements(supabase, auth.user.id, context)
    const today = todayKey()

    return NextResponse.json({
      success: true,
      missions: context.missionStatus,
      daily: {
        streak: Number(context.state.daily_streak || 0),
        claimedToday: context.state.last_daily_claim_date === today,
        nextReward: Math.min(500, 50 + Math.max(0, Number(context.state.daily_streak || 0)) * 10)
      },
      spin: {
        claimedToday: context.state.last_spin_date === today
      },
      bonusWallet: Number(context.profile.bonus_wallet_balance || context.state.bonus_wallet_balance || 0),
      achievements
    })
  } catch (error: any) {
    console.error("Rewards status error:", error)
    return NextResponse.json({ success: false, error: error.message || "Unable to load rewards" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const action = String(body.action || "")
    const supabase = createServiceClient()
    const userId = auth.user.id
    const today = todayKey()

    if (action === "claim_mission") {
      const missionId = String(body.missionId || "")
      const context = await loadRewardContext(supabase, userId)
      const mission = context.missionStatus.find((item: any) => item.id === missionId)

      if (!mission) {
        return NextResponse.json({ success: false, error: "Mission not found" }, { status: 404 })
      }
      if (!mission.completed) {
        return NextResponse.json({ success: false, error: "Complete this mission before claiming." }, { status: 400 })
      }

      const result = await grantReward(
        supabase,
        userId,
        "mission",
        mission.claimKey,
        mission.reward,
        `Daily mission reward: ${mission.title}`,
        { mission_id: mission.id, mission_title: mission.title }
      )

      return NextResponse.json({ success: true, ...result })
    }

    if (action === "claim_daily") {
      const context = await loadRewardContext(supabase, userId)
      if (context.state.last_daily_claim_date === today) {
        return NextResponse.json({ success: false, error: "Daily streak already claimed today." }, { status: 409 })
      }

      const yesterday = dayKey(addDays(new Date(), -1))
      const streak = context.state.last_daily_claim_date === yesterday ? Number(context.state.daily_streak || 0) + 1 : 1
      const reward = Math.min(500, 50 + (streak - 1) * 10)

      const result = await grantReward(
        supabase,
        userId,
        "daily_streak",
        `daily:${today}`,
        reward,
        `Daily streak reward - day ${streak}`,
        { streak }
      )

      if (result.granted) {
        await supabase.from("user_reward_state").upsert({
          user_id: userId,
          daily_streak: streak,
          last_daily_claim_date: today,
          updated_at: new Date().toISOString()
        })
      }

      return NextResponse.json({ success: true, streak, ...result })
    }

    if (action === "spin") {
      const context = await loadRewardContext(supabase, userId)
      if (context.state.last_spin_date === today) {
        return NextResponse.json({ success: false, error: "Lucky Spin is available once per day." }, { status: 409 })
      }

      const totalWeight = spinRewards.reduce((sum, item) => sum + item.weight, 0)
      let draw = Math.random() * totalWeight
      const prize = spinRewards.find((item) => {
        draw -= item.weight
        return draw <= 0
      }) || spinRewards[0]

      const result = await grantReward(
        supabase,
        userId,
        "lucky_spin",
        `spin:${today}`,
        prize.amount,
        `Lucky Spin reward: ${prize.label}`,
        { prize_label: prize.label }
      )

      await supabase.from("user_reward_state").upsert({
        user_id: userId,
        last_spin_date: today,
        updated_at: new Date().toISOString()
      })

      return NextResponse.json({ success: true, prize, ...result })
    }

    return NextResponse.json({ success: false, error: "Unknown reward action" }, { status: 400 })
  } catch (error: any) {
    console.error("Rewards action error:", error)
    return NextResponse.json({ success: false, error: error.message || "Reward action failed" }, { status: 500 })
  }
}
