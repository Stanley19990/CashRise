import { supabase, type User, type MachineType, type UserMachine } from "./supabase"

// Export User type for other components to use
export type { User, MachineType, UserMachine }

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)
export type AdReward = {
  amount: number
}

export const authService ={ 
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.from("users").select("count").limit(1)
      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (error) {
      return { success: false, error: "Database connection failed" }
    }
  },

  async signUp(
    email: string,
    password: string,
    fullName: string,
    country: string,
    phone?: string,
    referralCode?: string
  ): Promise<{ user: User | null; error?: string }> {
    try {
      if (!email || !password || !fullName || !country) {
        return { user: null, error: "Please fill in all required fields including country" }
      }

      const connectionTest = await this.testConnection()
      if (!connectionTest.success) return { user: null, error: connectionTest.error }

      // Check if phone is already used
      if (phone) {
        const { data: existingPhoneUser } = await supabase
          .from("users")
          .select("id")
          .eq("phone", phone)
          .maybeSingle()
        if (existingPhoneUser) return { user: null, error: "Phone number already registered" }
      }

      // Create user in Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
      if (authError || !authData.user) return { user: null, error: authError?.message || "Failed to create user" }

      const newReferralCode = Math.random().toString(36).substr(2, 8).toUpperCase()
      let referrerId: string | null = null
      if (referralCode) {
        const { data: referrer } = await supabase.from("users").select("id").eq("referral_code", referralCode).single()
        if (referrer) referrerId = referrer.id
      }

      const userInsertData: any = {
        id: authData.user.id,
        email,
        full_name: fullName,
        country,
        referral_code: newReferralCode,
        referred_by: referrerId,
      }
      if (phone) userInsertData.phone = phone

      const { data: userData, error: userError } = await supabase
        .from("users")
        .insert(userInsertData)
        .select()
        .maybeSingle()
      if (userError) return { user: null, error: userError.message }

      if (referrerId) await this.addReferralBonus(referrerId, userData.id)
      return { user: userData, error: undefined }
    } catch (error: any) {
      return { user: null, error: error?.message || "An unexpected error occurred" }
    }
  },

  async signIn(email: string, password: string): Promise<{ user: User | null; error?: string }> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError || !authData.user) return { user: null, error: authError?.message || "Login failed" }

      const { data: userData } = await supabase.from("users").select("*").eq("id", authData.user.id).single()
      return { user: userData || null, error: undefined }
    } catch (error: any) {
      return { user: null, error: error?.message || "An unexpected error occurred" }
    }
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut()
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data } = await supabase.auth.getUser()
      if (!data.user) return null
      const { data: userData } = await supabase.from("users").select("*").eq("id", data.user.id).single()
      return userData || null
    } catch {
      return null
    }
  },

  isAdmin(email: string): boolean {
    return ADMIN_EMAILS.includes(email.trim().toLowerCase())
  },

  async getMachines(): Promise<MachineType[]> {
    try {
      const { data, error } = await supabase
        .from("machine_types")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true })

      if (error) {
        console.error("Error fetching machines:", error)
        return []
      }

      return data || []
    } catch (error) {
      console.error("Error fetching machines:", error)
      return []
    }
  },
async getUserMachines(userId: string): Promise<UserMachine[]> {
  try {
    const { data, error } = await supabase
      .from("user_machines")
      .select(`
        *,
        machine_types (*),
        earnings:earnings (
          id,
          amount,
          earned_at
        )
      `)
      .eq("user_id", userId)
      .eq("is_active", true)

    if (error) {
      console.error("Error fetching user machines:", error)
      return []
    }

    // ✅ Aggregate total earnings per machine
    return (
      data?.map((m: any) => {
        const totalEarnings =
          m.earnings?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0
        return { ...m, totalEarnings }
      }) || []
    )
  } catch (error) {
    console.error("Error fetching user machines:", error)
    return []
  }
},


  async purchaseMachine(userId: string, machineId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: machine } = await supabase.from("machine_types").select("*").eq("id", machineId).single()

      const { data: user } = await supabase
        .from("users")
        .select("wallet_balance, machines_owned")
        .eq("id", userId)
        .single()

      if (!machine || !user) {
        return { success: false, error: "Machine or user not found" }
      }

      if (user.wallet_balance < machine.price) {
        return { success: false, error: "Insufficient balance" }
      }

      const { error: purchaseError } = await supabase.from("user_machines").insert({
        user_id: userId,
        machine_type_id: machineId,
      })

      if (purchaseError) {
        return { success: false, error: purchaseError.message }
      }

      const { error: updateError } = await supabase
        .from("users")
        .update({
          wallet_balance: user.wallet_balance - machine.price,
          machines_owned: user.machines_owned + 1,
        })
        .eq("id", userId)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      await this.transferToAdminWallet(machine.price, `Machine purchase: ${machine.name}`)

      return { success: true }
    } catch (error) {
      return { success: false, error: "An unexpected error occurred" }
    }
  },

  async transferToAdminWallet(amount: number, description: string): Promise<void> {
    try {
      // Get or create admin wallet record
      const { data: adminWallet, error: fetchError } = await supabase.from("admin_wallet").select("*").single()

      if (fetchError && fetchError.code === "PGRST116") {
        // Admin wallet doesn't exist, create it
        await supabase.from("admin_wallet").insert({
          balance: amount,
          total_received: amount,
        })
      } else if (!fetchError && adminWallet) {
        // Update existing admin wallet
        await supabase
          .from("admin_wallet")
          .update({
            balance: adminWallet.balance + amount,
            total_received: adminWallet.total_received + amount,
          })
          .eq("id", adminWallet.id)
      }

      // Record the transaction
      await supabase.from("admin_transactions").insert({
        amount,
        transaction_type: "credit",
        description,
        status: "completed",
      })
    } catch (error) {
      console.error("Error transferring to admin wallet:", error)
    }
  },

  async getAdminWallet(): Promise<{ balance: number; totalReceived: number; totalWithdrawn: number }> {
    try {
      const { data: adminWallet } = await supabase.from("admin_wallet").select("*").single()

      if (!adminWallet) {
        return { balance: 0, totalReceived: 0, totalWithdrawn: 0 }
      }

      return {
        balance: adminWallet.balance,
        totalReceived: adminWallet.total_received,
        totalWithdrawn: adminWallet.total_withdrawn || 0,
      }
    } catch (error) {
      console.error("Error fetching admin wallet:", error)
      return { balance: 0, totalReceived: 0, totalWithdrawn: 0 }
    }
  },

  async adminWithdraw(amount: number, method: string, details: any): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: adminWallet } = await supabase.from("admin_wallet").select("*").single()

      if (!adminWallet || adminWallet.balance < amount) {
        return { success: false, error: "Insufficient admin wallet balance" }
      }

      // Update admin wallet balance
      await supabase
        .from("admin_wallet")
        .update({
          balance: adminWallet.balance - amount,
          total_withdrawn: (adminWallet.total_withdrawn || 0) + amount,
        })
        .eq("id", adminWallet.id)

      // Record the withdrawal transaction
      await supabase.from("admin_transactions").insert({
        amount: -amount,
        transaction_type: "withdrawal",
        description: `Admin withdrawal via ${method}`,
        status: "completed",
        withdrawal_method: method,
        withdrawal_details: details,
      })

      return { success: true }
    } catch (error) {
      console.error("Error processing admin withdrawal:", error)
      return { success: false, error: "An unexpected error occurred" }
    }
  },

  async getAdminTransactions(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("admin_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) {
        console.error("Error fetching admin transactions:", error)
        return []
      }

      return data || []
    } catch (error) {
      console.error("Error fetching admin transactions:", error)
      return []
    }
  },

  async addReferralBonus(referrerId: string, referredId: string): Promise<void> {
    try {
      await supabase.from("referrals").insert({
        referrer_id: referrerId,
        referred_id: referredId,
        referral_date: new Date().toISOString(),
        bonus: 5.0,
        status: "active",
      })

      const { data: referrer } = await supabase.from("users").select("wallet_balance").eq("id", referrerId).single()

      if (referrer) {
        await supabase
          .from("users")
          .update({
            wallet_balance: referrer.wallet_balance + 5.0,
          })
          .eq("id", referrerId)

        await supabase.from("earnings").insert({
          user_id: referrerId,
          amount: 5.0,
          currency: "USD",
          type: "referral",
          earning_type: "referral",
          description: "Referral bonus for new user signup",
          earned_at: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error("Error adding referral bonus:", error)
    }
  },

  
async watchAd(
  userId: string,
  machineId: string,
  rewardAmount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Insert ad session
    const { error: sessionError } = await supabase.from("ad_sessions").insert({
      user_id: userId,
      machine_id: machineId,
      reward_amount: rewardAmount,
      session_duration: 30,
      completed: true,
    });

    if (sessionError) {
      console.error("Ad session insert error:", sessionError.message);
      return { success: false, error: sessionError.message };
    }

    // Update user balances
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("ed_balance, total_earned")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("Fetch user error:", userError.message);
    }

    if (user) {
      const newEdBalance = (user.ed_balance || 0) + rewardAmount;
      const newTotalEarned = (user.total_earned || 0) + rewardAmount;

      await supabase
        .from("users")
        .update({
          ed_balance: newEdBalance,
          total_earned: newTotalEarned,
        })
        .eq("id", userId);

      console.log("✅ User balances updated:", {
        ed_balance: newEdBalance,
        total_earned: newTotalEarned,
      });

      await supabase.from("earnings").insert({
        user_id: userId,
        machine_id: machineId,
        amount: rewardAmount,
        currency: "ED",
        earning_type: "ad_watch",
        description: "Reward for watching advertisement",
      });

      console.log("✅ Earnings record added:", {
        user_id: userId,
        machine_id: machineId,
        amount: rewardAmount,
      });
    }

    // Update machine stats
    const { data: machineData, error: machineError } = await supabase
      .from("user_machines")
      .select("ads_watched_today, total_earned")
      .eq("id", machineId)
      .single();

    if (machineError) {
      console.error("Fetch machine error:", machineError.message);
    }

    if (machineData) {
      const newAdsWatched = (machineData.ads_watched_today || 0) + 1;
      const newMachineEarned = (machineData.total_earned || 0) + rewardAmount;

      await supabase
        .from("user_machines")
        .update({
          ads_watched_today: newAdsWatched,
          total_earned: newMachineEarned,
          last_ad_watched: new Date().toISOString(),
        })
        .eq("id", machineId);

      console.log("✅ Machine stats updated:", {
        ads_watched_today: newAdsWatched,
        total_earned: newMachineEarned,
        last_ad_watched: new Date().toISOString(),
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error in watchAd:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
 }
