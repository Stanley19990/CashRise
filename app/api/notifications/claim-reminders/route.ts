import { NextRequest, NextResponse } from "next/server"
import { createNotificationAndPush } from "@/lib/push-server"
import { createServiceClient } from "@/lib/server-auth"

const REMINDER_MILESTONES = [15, 10, 5, 0]

const getReminderMilestone = (hoursRemaining: number) => {
  if (hoursRemaining <= 0) return 0
  return REMINDER_MILESTONES.find((hours) => hours > 0 && hoursRemaining <= hours && hoursRemaining > hours - 1)
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (!cronSecret) {
    return NextResponse.json({ success: false, error: "CRON_SECRET is not configured" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const { data: machines, error } = await supabase
    .from("user_machines")
    .select(`
      id,
      user_id,
      machine_type_id,
      last_claim_time,
      is_active,
      machine_types (
        name,
        daily_earnings
      )
    `)
    .eq("is_active", true)
    .not("last_claim_time", "is", null)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  let created = 0
  const now = Date.now()

  for (const machine of machines || []) {
    const lastClaimTime = new Date(machine.last_claim_time).getTime()
    const hoursSinceClaim = (now - lastClaimTime) / (1000 * 60 * 60)
    const hoursRemaining = 24 - hoursSinceClaim
    const milestone = getReminderMilestone(hoursRemaining)

    if (milestone === undefined) continue

    const reminderKey = `claim_${machine.id}_${milestone}_${machine.last_claim_time}`

    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", machine.user_id)
      .eq("metadata->>reminder_key", reminderKey)
      .maybeSingle()

    if (existing) continue

    const machineType = Array.isArray(machine.machine_types) ? machine.machine_types[0] : machine.machine_types
    const machineName = machineType?.name || "Machine"
    const dailyEarnings = machineType?.daily_earnings || 0
    const title = milestone === 0 ? "Your earnings are ready" : `Claim in about ${milestone}h`
    const message =
      milestone === 0
        ? `${machineName} has ${Number(dailyEarnings).toLocaleString()} XAF ready to claim.`
        : `${machineName} is working. Come back in about ${milestone}h to claim your earnings.`

    await createNotificationAndPush(supabase, {
      user_id: machine.user_id,
      title,
      message,
      type: "claim_reminder",
      action_url: "/dashboard",
      related_id: machine.id.toString(),
      metadata: {
        reminder_key: reminderKey,
        machine_id: machine.id,
        machine_type_id: machine.machine_type_id,
        milestone
      }
    })

    created++
  }

  return NextResponse.json({ success: true, created })
}

export async function GET(request: NextRequest) {
  return POST(request)
}
