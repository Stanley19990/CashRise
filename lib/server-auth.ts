import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const createServiceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("Missing Supabase service configuration")
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

export const getBearerToken = (request: NextRequest) => {
  const authorization = request.headers.get("authorization") || ""
  const [scheme, token] = authorization.split(" ")
  return scheme?.toLowerCase() === "bearer" && token ? token : null
}

export const getAuthenticatedUser = async (request: NextRequest) => {
  const token = getBearerToken(request)
  if (!token) return null

  const supabase = createServiceClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null

  return data.user
}

export const requireAuthenticatedUser = async (request: NextRequest) => {
  const user = await getAuthenticatedUser(request)

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })
    }
  }

  return { user, response: null }
}
