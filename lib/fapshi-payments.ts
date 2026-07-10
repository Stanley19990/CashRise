import type { SupabaseClient } from "@supabase/supabase-js"

export const normalizeFapshiStatus = (status: string | null | undefined) => {
  if (!status) return "unknown"

  const normalized = status.toLowerCase()

  if (["successful", "success", "completed", "complete"].includes(normalized)) {
    return "successful"
  }

  if (["failed", "fail", "canceled", "cancelled", "expired"].includes(normalized)) {
    return "failed"
  }

  if (["created", "pending", "processing", "in_progress"].includes(normalized)) {
    return "pending"
  }

  return normalized
}

export const extractFapshiStatus = (payload: any) => {
  return payload?.status || payload?.data?.status || (Array.isArray(payload) ? payload?.[0]?.status : null)
}

export const extractMachineId = (source: any) => {
  return (
    source?.metadata?.machineId ||
    source?.metadata?.machine_id ||
    source?.metadata?.machine_type_id ||
    source?.metadata?.metadata?.machineId ||
    source?.metadata?.metadata?.machine_id ||
    source?.metadata?.metadata?.machine_type_id ||
    (typeof source?.external_id === "string" ? source.external_id.split("_")[1] : null) ||
    (typeof source?.externalId === "string" ? source.externalId.split("_")[1] : null)
  )
}

export async function ensureFapshiTransaction(supabase: SupabaseClient, payload: any) {
  const transId = payload?.transId || payload?.data?.transId
  const externalId = payload?.externalId || payload?.data?.externalId
  const userId = payload?.userId || payload?.data?.userId

  if (!transId) return null

  const { data: existing } = await supabase
    .from("transactions")
    .select("id, user_id, amount, type, external_id, metadata, created_at")
    .eq("fapshi_trans_id", transId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return existing

  const machineId = extractMachineId({ external_id: externalId })
  if (!userId || !externalId || !machineId) return null

  const { data: machine } = await supabase
    .from("machine_types")
    .select("name, price")
    .eq("id", parseInt(machineId))
    .maybeSingle()

  const rawAmount = Number(payload?.amount || payload?.data?.amount || machine?.price || 0)
  const amount = Number.isFinite(rawAmount) ? rawAmount : 0

  const { data: created, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: "machine_purchase",
      description: `Purchase ${machine?.name || `Machine ${machineId}`}`,
      amount: -Math.abs(amount),
      currency: "XAF",
      status: normalizeFapshiStatus(extractFapshiStatus(payload)),
      external_id: externalId,
      fapshi_trans_id: transId,
      metadata: {
        machine_id: machineId,
        machine_name: machine?.name || null,
        recovered_from_fapshi: true
      }
    })
    .select("id, user_id, amount, type, external_id, metadata, created_at")
    .single()

  if (error) {
    console.error("Failed to recover Fapshi transaction:", error)
    return null
  }

  return created
}
