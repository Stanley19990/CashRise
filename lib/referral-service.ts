// lib/referral-service.ts
import { NotificationService } from './notification-service'
import { createServiceClient } from './server-auth'

const supabase = new Proxy({} as ReturnType<typeof createServiceClient>, {
  get(_target, prop) {
    return (createServiceClient() as any)[prop as keyof ReturnType<typeof createServiceClient>]
  }
})

export interface Referral {
  id: number
  referrer_id: string
  referred_id: string
  referral_date: string
  bonus: number
  referral_code?: string
  status?: string
  completed_at?: string
}

export interface ReferralStats {
  totalReferrals: number
  totalBonusEarned: number
  pendingReferrals: number
  referrals: Referral[]
}

export interface ReferralResult {
  success: boolean
  error?: string
  referral?: Referral
  bonusAmount?: number
  referrerId?: string
}

export class ReferralService {
  // Generate referral code based on username
  static async generateReferralCode(userId: string): Promise<string> {
    try {
      // Get user's username
      const { data: user, error } = await supabase
        .from('users')
        .select('username')
        .eq('id', userId)
        .single()

      if (error) throw error

      // Clean username and create code
      const cleanUsername = (user?.username || 'user')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase()
        .substring(0, 8)

      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase()
      const referralCode = `${cleanUsername}${randomStr}`

      return referralCode
    } catch (error) {
      console.error('Error generating referral code:', error)
      throw new Error('Failed to generate referral code')
    }
  }

  // Get or create user's referral code
  static async getUserReferralCode(userId: string): Promise<string> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', userId)
        .single()

      if (error) throw error

      // Return existing code
      if (user?.referral_code) {
        return user.referral_code
      }

      // Generate and save new code
      const referralCode = await this.generateReferralCode(userId)

      const { error: updateError } = await supabase
        .from('users')
        .update({ referral_code: referralCode })
        .eq('id', userId)

      if (updateError) throw updateError

      return referralCode
    } catch (error) {
      console.error('Error getting referral code:', error)
      throw new Error('Failed to get referral code')
    }
  }

  // Get user's referral statistics
  static async getUserReferralStats(userId: string): Promise<ReferralStats> {
    try {
      const { data: referrals, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', userId)
        .order('referral_date', { ascending: false })

      if (error) throw error

      const referralList: Referral[] = referrals || []
      const totalReferrals = referralList.length
      const totalBonusEarned = referralList.reduce((sum, r) => sum + (r.bonus || 0), 0)
      const pendingReferrals = referralList.filter(r => (r.bonus || 0) === 0).length

      return {
        totalReferrals,
        totalBonusEarned,
        pendingReferrals,
        referrals: referralList
      }
    } catch (error) {
      console.error('Error getting referral stats:', error)
      throw new Error('Failed to get referral statistics')
    }
  }

  // Process referral when new user signs up
  static async processReferralSignup(referredUserId: string, referralCode: string): Promise<ReferralResult> {
    try {
      console.log('🔗 Processing referral signup:', { referredUserId, referralCode })

      // Find referrer by referral code
      const { data: referrer, error: referrerError } = await supabase
        .from('users')
        .select('id, username')
        .eq('referral_code', referralCode)
        .single()

      if (referrerError || !referrer) {
        console.log('Referrer not found for code:', referralCode)
        return { success: false, error: 'Invalid referral code' }
      }

      // Check if referral already exists
      const { data: existingReferral } = await supabase
        .from('referrals')
        .select('id')
        .eq('referred_id', referredUserId)
        .single()

      if (existingReferral) {
        return { success: false, error: 'Referral already processed' }
      }

      // Create referral record
      const { data: referral, error: referralError } = await supabase
        .from('referrals')
        .insert({
          referrer_id: referrer.id,
          referred_id: referredUserId,
          referral_date: new Date().toISOString(),
          bonus: 0
        })
        .select()
        .single()

      if (referralError) throw referralError

      console.log('✅ Referral created successfully:', referral?.id)

      return { 
        success: true, 
        referral: referral as Referral 
      }
    } catch (error) {
      console.error('Error processing referral signup:', error)
      return { success: false, error: 'Failed to process referral' }
    }
  }

  // Award referral bonus when referred user buys first machine
  static async awardReferralBonus(referredUserId: string, machineId: string): Promise<ReferralResult> {
    try {
      console.log('💰 Awarding referral bonus for user:', referredUserId)

      // Find pending referral
      const { data: referral, error: referralError } = await supabase
        .from('referrals')
        .select('*')
        .eq('referred_id', referredUserId)
        .eq('bonus', 0)
        .single()

      if (referralError || !referral) {
        console.log('No pending referral found')
        return { success: false, error: 'No pending referral' }
      }

      // Check if this is user's first machine
      const { data: userMachines, error: machinesError } = await supabase
        .from('user_machines')
        .select('id')
        .eq('user_id', referredUserId)

      if (machinesError) throw machinesError

      if (userMachines && userMachines.length > 1) {
        console.log('Not first machine purchase, no bonus awarded')
        return { success: false, error: 'Not first machine purchase' }
      }

      const bonusAmountXAF = 1000

      // Update referrer's wallet balance
      const { data: referrer, error: referrerError } = await supabase
        .from('users')
        .select('wallet_balance, total_earned')
        .eq('id', referral.referrer_id)
        .single()

      if (referrerError) throw referrerError

      const currentBalance = referrer?.wallet_balance || 0
      const currentTotalEarned = referrer?.total_earned || 0
      
      const newWalletBalance = currentBalance + bonusAmountXAF
      const newTotalEarned = currentTotalEarned + bonusAmountXAF

      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          wallet_balance: newWalletBalance,
          total_earned: newTotalEarned
        })
        .eq('id', referral.referrer_id)

      if (updateError) throw updateError

      // Update referral bonus amount
      const { error: updateReferralError } = await supabase
        .from('referrals')
        .update({ bonus: bonusAmountXAF })
        .eq('id', referral.id)

      if (updateReferralError) throw updateReferralError

      // Record transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: referral.referrer_id,
          type: 'referral_bonus',
          description: 'Referral bonus from new user',
          amount: bonusAmountXAF,
          currency: 'XAF',
          status: 'completed',
          external_id: `ref_bonus_${referral.id}_${Date.now()}`,
          metadata: {
            referred_user_id: referredUserId,
            machine_id: machineId,
            referral_id: referral.id
          }
        })

      if (transactionError) {
        console.error('Failed to record transaction:', transactionError)
      }

      // Send notification
      await NotificationService.createNotification({
        user_id: referral.referrer_id,
        title: '🎉 Referral Bonus Earned!',
        message: `You earned ${bonusAmountXAF.toLocaleString()} XAF from your referral!`,
        type: 'success',
        action_url: '/referrals'
      })

      console.log('✅ Referral bonus awarded successfully')

      return { 
        success: true, 
        bonusAmount: bonusAmountXAF,
        referrerId: referral.referrer_id
      }
    } catch (error) {
      console.error('Error awarding referral bonus:', error)
      return { success: false, error: 'Failed to award bonus' }
    }
  }
}
