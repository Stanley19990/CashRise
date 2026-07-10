import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/server-auth'
import { verifyAdminAuth } from '@/lib/auth-admin'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (process.env.ENABLE_ADMIN_BALANCE_RESTORE !== 'true') {
      return NextResponse.json(
        { success: false, error: 'Balance restoration is disabled in this environment' },
        { status: 403 }
      )
    }

    const adminAuth = await verifyAdminAuth(request)
    if (!adminAuth.isValid) {
      return NextResponse.json(
        { success: false, error: adminAuth.error || 'Admin authentication required' },
        { status: 403 }
      )
    }

    const supabase = createServiceClient()
    const { userId, amount } = await request.json()
    const restoreAmount = Number(amount)

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 })
    }

    if (!Number.isFinite(restoreAmount) || restoreAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'A positive numeric amount is required' },
        { status: 400 }
      )
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('wallet_balance, username, email')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const newBalance = Number(userData.wallet_balance || 0) + restoreAmount

    const { error: updateError } = await supabase
      .from('users')
      .update({ wallet_balance: newBalance })
      .eq('id', userId)

    if (updateError) {
      throw updateError
    }

    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'balance_restoration',
      description: 'Admin balance restoration',
      amount: restoreAmount,
      currency: 'XAF',
      status: 'completed',
      external_id: `restore_${userId}_${Date.now()}`,
      metadata: {
        original_balance: Number(userData.wallet_balance || 0),
        restored_amount: restoreAmount,
        new_balance: newBalance,
        restored_at: new Date().toISOString()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Balance restored successfully',
      originalBalance: Number(userData.wallet_balance || 0),
      restoredAmount: restoreAmount,
      newBalance,
      user: {
        username: userData.username,
        email: userData.email
      }
    })
  } catch (error: any) {
    console.error('Balance restoration error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
