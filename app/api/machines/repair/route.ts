import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fulfillMachinePurchase } from '@/lib/payment-fulfillment'
import { requireAuthenticatedUser } from '@/lib/server-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response

    const { userId: requestedUserId } = await request.json()
    const userId = auth.user.id

    if (requestedUserId && requestedUserId !== userId) {
      return NextResponse.json({ success: false, error: 'Repair user mismatch' }, { status: 403 })
    }

    console.log('🔧 Running repair for user:', userId)

    // Find all successful transactions that don't have corresponding machines
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'successful')
      .eq('type', 'machine_purchase')
      .order('created_at', { ascending: true })

    if (txError) {
      console.error('❌ Error fetching transactions:', txError)
      return NextResponse.json({ error: txError.message }, { status: 500 })
    }

    console.log(`📊 Found ${transactions?.length || 0} successful transactions`)

    let activatedCount = 0
    let bonusCount = 0

    // Process each transaction
    for (const transaction of transactions || []) {
      const result = await fulfillMachinePurchase(supabase, transaction)
      if (result.activated) {
        activatedCount++
      }
      if (result.bonusPaid) {
        bonusCount++
      }
    }

    console.log(`✅ Repair complete. Activated ${activatedCount} machines. Paid ${bonusCount} bonuses.`)

    return NextResponse.json({ 
      success: true, 
      activated: activatedCount,
      referral_bonuses_paid: bonusCount
    })

  } catch (error: any) {
    console.error('❌ Repair error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
