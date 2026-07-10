// app/api/referrals/claim/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ReferralService } from '@/lib/referral-service'
import { requireAuthenticatedUser } from '@/lib/server-auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response

    const { userId, machineId } = await request.json()

    if (userId !== auth.user.id) {
      return NextResponse.json({ success: false, error: 'Referral claim user mismatch' }, { status: 403 })
    }

    console.log('🎯 Processing referral bonus for user:', userId)

    // Use the referral service to award bonus
    const { success, error, bonusAmount } = await ReferralService.awardReferralBonus(userId, machineId)

    if (!success) {
      console.log('No referral bonus to award:', error)
      return NextResponse.json({ 
        success: true, 
        message: 'No referral bonus applicable' 
      })
    }

    console.log('✅ Referral bonus processed successfully')

    return NextResponse.json({
      success: true,
      message: 'Referral bonus credited',
      bonusAmount,
      userId
    })

  } catch (error: any) {
    console.error('❌ Referral bonus error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
