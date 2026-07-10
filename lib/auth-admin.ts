import type { NextRequest } from "next/server"
import { createSupabaseAdmin } from "./supabaseAdmin"

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

export async function verifyAdminAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return { isValid: false, error: "Missing or invalid authorization header" }
    }

    if (ADMIN_EMAILS.length === 0) {
      return { isValid: false, error: "ADMIN_EMAILS or NEXT_PUBLIC_ADMIN_EMAILS is not configured" }
    }

    const token = authHeader.split(" ")[1]

    const supabaseAdmin = createSupabaseAdmin()
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return { isValid: false, error: "Invalid token or user not found" }
    }

    if (!ADMIN_EMAILS.includes((user.email || "").toLowerCase())) {
      return { isValid: false, error: "User is not authorized as admin" }
    }

    return { isValid: true, user }
  } catch (error) {
    console.error("Admin auth verification error:", error)
    return { isValid: false, error: "Authentication verification failed" }
  }
}
