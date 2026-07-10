import { NextRequest, NextResponse } from 'next/server'
import { createNotificationAndPush } from '@/lib/push-server'
import { createServiceClient, requireAuthenticatedUser } from '@/lib/server-auth'

const FAPSHI_BASE_URL = process.env.FAPSHI_BASE_URL || process.env.FAPSHI_ENVIRONMENT || 'https://live.fapshi.com'

// Helper function to get discounted price
const getDiscountedPrice = (price: number) => {
  const discountMachines = [50000, 100000, 150000]
  if (discountMachines.includes(price)) {
    return Math.round(price * 0.95) // 5% discount
  }
  return price
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    const supabase = createServiceClient()

    if (!process.env.FAPSHI_API_USER || !process.env.FAPSHI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Missing Fapshi payment configuration' },
        { status: 500 }
      )
    }

    const { 
      amount, 
      machineId, 
      userId: requestedUserId, 
      machineName, 
      phone,
      medium
    } = await request.json()
    const userId = auth.user.id
    
    console.log('💰 Payment request received:', { 
      amount, 
      machineId, 
      userId,
      phone: phone ? `***${phone.slice(-3)}` : 'missing'
    })

    // Validate required fields
    if (!amount || !machineId || !phone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (requestedUserId && requestedUserId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Payment user mismatch' },
        { status: 403 }
      )
    }

    // More flexible phone validation (allows 237 prefix, spaces, etc.)
    const cleanPhone = phone.replace(/\D/g, '')
    const isValidPhone = cleanPhone.length === 9 || 
                        (cleanPhone.length === 11 && cleanPhone.startsWith('237'))
    
    if (!isValidPhone) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // ✅ FIX: Get machine from database to validate price
    const { data: machine, error: machineError } = await supabase
      .from('machine_types')
      .select('*')
      .eq('id', parseInt(machineId))
      .single()

    if (machineError || !machine) {
      return NextResponse.json(
        { success: false, error: 'Machine not found' },
        { status: 404 }
      )
    }

    // ✅ FIX: Calculate correct discounted price
    const correctPrice = getDiscountedPrice(machine.price)

    // ✅ FIX: Validate the amount matches
    if (Math.abs(amount - correctPrice) > 1) { // Allow 1 XAF rounding difference
      console.error('❌ Price mismatch:', { 
        sentAmount: amount, 
        expectedPrice: correctPrice,
        machinePrice: machine.price 
      })
      return NextResponse.json(
        { success: false, error: 'Invalid price - please refresh the page' },
        { status: 400 }
      )
    }

    // Check if user already owns this machine
    const { data: existingMachine } = await supabase
      .from('user_machines')
      .select('id')
      .eq('user_id', userId)
      .eq('machine_type_id', parseInt(machineId))
      .single()

    if (existingMachine) {
      return NextResponse.json(
        { success: false, error: 'You already own this machine' },
        { status: 400 }
      )
    }

    // Generate unique external ID
    const externalId = `MACHINE_${machineId}_${userId}_${Date.now()}`

    // Prepare Fapshi Direct Pay payload.
    // Keep this minimal so Fapshi does not send app-branded email/message content.
    const fapshiPayload = {
      amount: correctPrice, // Use validated discounted price
      phone: cleanPhone.slice(-9), // Always send last 9 digits
      ...(medium ? { medium } : {}),
      userId: userId,
      externalId: externalId
    }

    console.log('📤 Calling Fapshi API...', {
      endpoint: 'direct-pay',
      amount: fapshiPayload.amount,
      phone: `***${fapshiPayload.phone.slice(-3)}`,
      medium: 'medium' in fapshiPayload ? fapshiPayload.medium : 'auto-detect',
      externalId
    })

    // Call Fapshi API
    const response = await fetch(`${FAPSHI_BASE_URL}/direct-pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiuser': process.env.FAPSHI_API_USER!,
        'apikey': process.env.FAPSHI_API_KEY!
      },
      body: JSON.stringify(fapshiPayload)
    })

    const responseData = await response.json().catch(() => ({}))
    console.log('📨 Fapshi response:', responseData)

    if (!response.ok) {
      // Handle specific Fapshi errors
      const errorMessage = responseData.message || responseData.error || 'Payment failed'
      
      // Check for insufficient balance
      if (errorMessage.toLowerCase().includes('insufficient') || 
          errorMessage.toLowerCase().includes('balance') ||
          response.status === 402) {
        return NextResponse.json({
          success: false,
          error: 'Insufficient balance in your mobile money account'
        }, { status: 400 })
      }
      
      // Check for invalid phone
      if (errorMessage.toLowerCase().includes('invalid phone') ||
          errorMessage.toLowerCase().includes('not registered')) {
        return NextResponse.json({
          success: false,
          error: 'Phone number not registered with mobile money'
        }, { status: 400 })
      }

      throw new Error(errorMessage)
    }

    // Save transaction to database
    const { error: dbError } = await supabase.from('transactions').insert({
      user_id: userId,
      type: 'machine_purchase',
      description: `Purchase ${machineName}`,
      amount: -correctPrice,
      currency: 'XAF',
      status: 'pending',
      external_id: externalId,
      fapshi_trans_id: responseData.transId,
      metadata: {
        machine_id: machineId,
        machine_name: machineName,
        original_price: machine.price,
        discounted_price: correctPrice,
        discount_applied: correctPrice !== machine.price
      }
    })

    if (dbError) {
      console.error('❌ Database error:', dbError)
      // Don't fail the payment if DB save fails
    } else {
      await createNotificationAndPush(supabase, {
        user_id: userId,
        title: 'Payment request sent',
        message: 'Confirm the payment prompt on your phone to activate your machine.',
        type: 'payment_started',
        action_url: '/dashboard',
        related_id: responseData.transId,
        metadata: {
          trans_id: responseData.transId,
          external_id: externalId,
          machine_id: machineId
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Payment request sent to your phone!',
      transId: responseData.transId,
      externalId: externalId,
      mode: 'direct-pay'
    })

  } catch (error: any) {
    console.error('❌ Payment error:', error)
    
    return NextResponse.json(
      { success: false, error: error.message || 'Payment failed' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Payment API is working',
    timestamp: new Date().toISOString()
  })
}
