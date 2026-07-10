import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/server-auth'
import { verifyAdminAuth } from '@/lib/auth-admin'
import { processReferralBonusForMachine } from '@/lib/payment-fulfillment'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const adminAuth = await verifyAdminAuth(request)
    if (!adminAuth.isValid) {
      return NextResponse.json(
        { success: false, error: adminAuth.error || 'Admin authentication required' },
        { status: 403 }
      )
    }

    const supabase = createServiceClient()
    const { data: pendingReferrals, error: referralsError } = await supabase
      .from('referrals')
      .select('*')
      .in('status', ['pending', 'active', 'completed'])
      .or('bonus.is.null,bonus.eq.0')

    if (referralsError) {
      return NextResponse.json({ success: false, error: referralsError.message }, { status: 500 })
    }

    if (!pendingReferrals?.length) {
      return NextResponse.json({
        success: true,
        message: 'No unpaid referrals found',
        checked: 0,
        processed: 0,
        results: []
      })
    }

    let processed = 0
    const results = []

    for (const referral of pendingReferrals) {
      const { data: firstMachine, error: machineError } = await supabase
        .from('user_machines')
        .select('id, machine_type_id, purchased_at')
        .eq('user_id', referral.referred_id)
        .order('purchased_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (machineError) {
        results.push({
          referralId: referral.id,
          status: 'error',
          message: machineError.message
        })
        continue
      }

      if (!firstMachine?.machine_type_id) {
        results.push({
          referralId: referral.id,
          status: 'pending',
          message: 'Referred user has not purchased a machine'
        })
        continue
      }

      const result = await processReferralBonusForMachine(
        supabase,
        referral.referred_id,
        String(firstMachine.machine_type_id)
      )

      if (result.paid) processed++

      results.push({
        referralId: referral.id,
        referredUserId: referral.referred_id,
        referrerId: referral.referrer_id,
        machineTypeId: firstMachine.machine_type_id,
        status: result.paid ? 'completed' : 'skipped',
        message: result.message
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Referral repair completed',
      checked: pendingReferrals.length,
      processed,
      results
    })
  } catch (error: any) {
    console.error('Referral repair error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminAuth = await verifyAdminAuth(request)
    if (!adminAuth.isValid) {
      return NextResponse.json(
        { success: false, error: adminAuth.error || 'Admin authentication required' },
        { status: 403 }
      )
    }

    const supabase = createServiceClient()
    const { data: pendingReferrals, error } = await supabase
      .from('referrals')
      .select('id, referrer_id, referred_id')
      .in('status', ['pending', 'active', 'completed'])
      .or('bonus.is.null,bonus.eq.0')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      unpaidReferralsCount: pendingReferrals?.length || 0,
      message: 'Send POST to run the referral repair'
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
