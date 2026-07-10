import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, requireAuthenticatedUser } from '@/lib/server-auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response

    const supabase = createServiceClient()
    const { userId, machineId, machineName, amount, externalId, transId, type } = await request.json()

    if (userId !== auth.user.id) {
      return NextResponse.json({ success: false, error: 'Transaction user mismatch' }, { status: 403 })
    }

    console.log('💾 Saving transaction:', { externalId, transId, amount, machineId })

    // Save transaction to database with metadata
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: type || 'machine_purchase',
        description: `Purchase ${machineName}`,
        amount: -amount, // Negative for purchases
        currency: 'XAF',
        status: 'pending',
        external_id: externalId,
        fapshi_trans_id: transId,
        metadata: {
          machineId: machineId,
          machine_id: machineId,
          machineName: machineName,
          machinePrice: amount,
          purchasedAt: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Transaction save error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    console.log('✅ Transaction saved with metadata:', data.id)
    return NextResponse.json({ success: true, data })

  } catch (error: any) {
    console.error('❌ Transaction API error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
