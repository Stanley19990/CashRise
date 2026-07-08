// components/my-machines.tsx - FIXED WITH LIVE COUNTDOWN
"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Zap, Cpu, BarChart3, DollarSign, Image as ImageIcon, Timer, CheckCircle, Clock, TrendingUp, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { firstRelation, formatNumber, toNumber } from "@/lib/safe-data"

interface UserMachine {
  id: string
  machine_type_id: string
  purchased_at: string
  is_active: boolean
  activated_at: string | null
  last_claim_time: string | null
  total_earned: number
  machine_types: {
    name: string
    daily_earnings: number
    monthly_earnings: number
    description: string
    features: string[]
    image_url: string
  }
}

interface MyMachinesProps {
  onRefresh?: () => void;
}

export function MyMachines({ onRefresh }: MyMachinesProps) {
  const { user, refreshUser } = useAuth()
  const [userMachines, setUserMachines] = useState<UserMachine[]>([])
  const [loading, setLoading] = useState(true)
  const [activatingMachine, setActivatingMachine] = useState<string | null>(null)
  const [claimingMachine, setClaimingMachine] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const repairRanRef = useRef(false)

  // ✅ FIX: Live countdown timer - updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000) // Update every second for live countdown
    
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    loadUserMachines()
    
    // Also refresh every 60 seconds to get updated data from server
    const interval = setInterval(loadUserMachines, 60000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`user-machines-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_machines",
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadUserMachines()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  useEffect(() => {
    if (!user || repairRanRef.current) return
    repairRanRef.current = true
    supabase.auth.getSession().then(({ data: sessionData }) => fetch("/api/machines/repair", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
      },
      body: JSON.stringify({ userId: user.id })
    }))
      .then(() => loadUserMachines())
      .catch(() => null)
  }, [user])

  const loadUserMachines = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_machines')
        .select(`
          id,
          machine_type_id,
          purchased_at,
          is_active,
          activated_at,
          last_claim_time,
          total_earned,
          machine_types (
            name,
            daily_earnings,
            monthly_earnings,
            description,
            features,
            image_url
          )
        `)
        .eq('user_id', user.id)
        .order('purchased_at', { ascending: false })

      if (error) throw error
      
      const machinesWithDetails = (data || []).map(machine => ({
        ...machine,
        machine_types: firstRelation(machine.machine_types) || {
          name: "Unknown Machine",
          daily_earnings: 0,
          monthly_earnings: 0,
          description: "",
          features: [],
          image_url: ""
        },
        total_earned: toNumber(machine.total_earned),
        activated_at: machine.activated_at,
        last_claim_time: machine.last_claim_time
      }))
      
      setUserMachines(machinesWithDetails)
      
    } catch (error) {
      console.error("Failed to load user machines:", error)
      setUserMachines([])
    } finally {
      setLoading(false)
    }
  }

  const handleStartMining = async (machineId: string) => {
    if (!user) return
    setActivatingMachine(machineId)
    
    try {
      const currentTime = new Date().toISOString()
      
      const { error } = await supabase
        .from('user_machines')
        .update({
          is_active: true,
          activated_at: currentTime,
          last_claim_time: currentTime
        })
        .eq('id', machineId)
        .eq('user_id', user.id)

      if (error) throw error

      toast.success('⛏️ Mining started! Come back in 24 hours to claim your earnings.')
      await loadUserMachines()
      if (onRefresh) onRefresh()
      
    } catch (error) {
      console.error('Error starting mining:', error)
      toast.error('Failed to start mining')
    } finally {
      setActivatingMachine(null)
    }
  }

  const handleClaimEarnings = async (machineId: string) => {
    if (!user) return
    setClaimingMachine(machineId)
    
    try {
      console.log('🔄 Claiming earnings for machine:', machineId)
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token
      
      const response = await fetch('/api/machines/claim-earnings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          userMachineId: machineId,
          userId: user.id
        }),
      })

      const result = await response.json()
      console.log('📥 Claim response:', result)

      if (!result.success) {
        throw new Error(result.error || 'Failed to claim earnings')
      }

      toast.success(`💰 ${result.message}`)
      
      await Promise.all([
        refreshUser(),
        loadUserMachines()
      ])
      
      if (onRefresh) onRefresh()
      
    } catch (error: any) {
      console.error('❌ Error claiming earnings:', error)
      toast.error(error.message || 'Failed to claim earnings')
    } finally {
      setClaimingMachine(null)
    }
  }

  // ✅ FIX: Live canClaim check using currentTime state
  const canClaimEarnings = (machine: UserMachine) => {
    if (!machine.last_claim_time || !machine.is_active) return false
    
    const lastClaim = new Date(machine.last_claim_time)
    const hoursSinceClaim = (currentTime.getTime() - lastClaim.getTime()) / (1000 * 60 * 60)
    
    return hoursSinceClaim >= 24
  }

  // ✅ FIX: Live mining progress using currentTime state
  const getMiningProgress = (machine: UserMachine) => {
    if (!machine.last_claim_time || !machine.is_active) return 0
    
    const lastClaim = new Date(machine.last_claim_time)
    const hoursSinceClaim = (currentTime.getTime() - lastClaim.getTime()) / (1000 * 60 * 60)
    
    return Math.min((hoursSinceClaim / 24) * 100, 100)
  }

  // ✅ FIX: Live time remaining that updates every second
  const getTimeRemaining = (machine: UserMachine) => {
    if (!machine.last_claim_time || !machine.is_active) return '24h 0m'
    
    const lastClaim = new Date(machine.last_claim_time)
    const hoursSinceClaim = (currentTime.getTime() - lastClaim.getTime()) / (1000 * 60 * 60)
    const hoursRemaining = Math.max(0, 24 - hoursSinceClaim)
    
    const hours = Math.floor(hoursRemaining)
    const minutes = Math.floor((hoursRemaining % 1) * 60)
    const seconds = Math.floor((hoursRemaining * 3600) % 60)
    
    if (hoursRemaining <= 0) {
      return 'Ready to Claim!'
    }
    
    return `${hours}h ${minutes}m ${seconds}s`
  }

  const isNewMachine = (machine: UserMachine) => {
    return !machine.activated_at && !machine.is_active
  }

  const getGradientClass = (machineId: string) => {
    const gradients: Record<string, string> = {
      "1": "from-cyan-500 to-emerald-500",
      "2": "from-indigo-500 to-fuchsia-500", 
      "3": "from-emerald-500 to-teal-500",
      "4": "from-amber-500 to-orange-500",
      "5": "from-rose-500 to-pink-500",
      "6": "from-amber-400 to-yellow-500",
      "7": "from-cyan-500 to-blue-500",
      "8": "from-pink-500 to-rose-500"
    }
    return gradients[machineId] || gradients["1"]
  }

  const getMachineIcon = (index: number) => {
    const icons = [Zap, Cpu, BarChart3, DollarSign, Zap, Cpu, BarChart3, DollarSign]
    const IconComponent = icons[index % icons.length]
    return <IconComponent className="h-6 w-6 text-white" />
  }

  if (loading) {
    return (
      <Card className="cr-glass">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-emerald-300" />
            <span className="text-white">My CashRise Machines</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="cr-glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-6 w-6 text-emerald-300" />
            <span className="text-xl text-white">My CashRise Machines</span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={loadUserMachines}
            className="border-slate-600 text-slate-300"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <p className="text-slate-300 text-sm">
          Manage your AI-powered gaming machines and track their performance
        </p>
      </CardHeader>
      <CardContent>
        {userMachines.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="bg-slate-900/60 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 border border-cyan-400/20">
              <Zap className="h-10 w-10 opacity-50" />
            </div>
            <p className="text-slate-300 text-lg font-semibold mb-2">No machines owned yet</p>
            <p className="text-sm text-slate-400">
              Purchase your first AI gaming machine to start earning automatically!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {userMachines.map((machine, index) => {
              const machineData = machine.machine_types || {
                name: "Unknown Machine",
                daily_earnings: 0,
                monthly_earnings: 0,
                description: "",
                features: [],
                image_url: ""
              }
              const dailyEarnings = toNumber(machineData.daily_earnings)
              const totalEarned = toNumber(machine.total_earned)
              const gradientClass = getGradientClass(machine.machine_type_id)
              const canClaim = canClaimEarnings(machine)
              const progress = getMiningProgress(machine)
              const timeRemaining = getTimeRemaining(machine)
              const isNew = isNewMachine(machine)
              const isMining = machine.is_active && !canClaim

              return (
                <Card
                  key={machine.id}
                  className="cr-glass cr-card-3d transition-all duration-300"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center space-x-4">
                        <div className={`p-4 bg-gradient-to-r ${gradientClass} rounded-2xl shadow-lg`}>
                          {getMachineIcon(index)}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-xl">{machineData.name}</h3>
                          <p className="text-sm text-slate-300">4K Ultra Gaming AI • Premium Network Access</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Purchased: {new Date(machine.purchased_at).toLocaleDateString()}
                            {machine.activated_at && (
                              <> • Activated: {new Date(machine.activated_at).toLocaleDateString()}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        {isMining ? (
                          <Badge variant="default" className="bg-cyan-500/10 text-cyan-200 border-cyan-500/20 px-3 py-1">
                            <div className="w-2 h-2 bg-cyan-300 rounded-full animate-pulse mr-2"></div>
                            Mining Active
                          </Badge>
                        ) : isNew ? (
                          <Badge variant="default" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 px-3 py-1">
                            <Zap className="h-3 w-3 mr-1" />
                            New Machine
                          </Badge>
                        ) : canClaim ? (
                          <Badge variant="default" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 px-3 py-1 animate-pulse">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Ready to Claim!
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-amber-500/10 text-amber-200 border-amber-500/20 px-3 py-1">
                            <Clock className="h-3 w-3 mr-1" />
                            Ready to Start
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Machine Image */}
                    <div className="aspect-video rounded-2xl overflow-hidden mb-6 shadow-lg relative">
                      {machineData.image_url ? (
                        <img
                          src={machineData.image_url}
                          alt={machineData.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${gradientClass} flex items-center justify-center`}>
                          <ImageIcon className="h-12 w-12 text-white opacity-50" />
                        </div>
                      )}
                      
                      {/* ✅ FIX: Live Mining Progress Overlay */}
                      {isMining && (
                        <div className="absolute bottom-0 left-0 right-0 bg-slate-950/70 backdrop-blur-sm p-3">
                          <div className="flex items-center justify-between text-sm text-white mb-2">
                            <div className="flex items-center space-x-2">
                              <Timer className="h-4 w-4 animate-pulse" />
                              <span className="font-mono">{timeRemaining}</span>
                            </div>
                            <span className="text-emerald-300 font-bold">{Math.round(progress)}%</span>
                          </div>
                          <div className="w-full bg-slate-600 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {/* ✅ FIX: Ready to Claim Overlay */}
                      {canClaim && (
                        <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-sm flex items-center justify-center">
                          <div className="bg-emerald-500/30 rounded-full p-4 animate-pulse">
                            <CheckCircle className="h-12 w-12 text-emerald-300" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                      <div className="bg-slate-900/60 rounded-2xl p-4 text-center border border-cyan-400/10">
                        <div className="text-xs text-slate-400 mb-1">Available Now</div>
                        <div className="text-lg font-bold text-emerald-300">
                          {canClaim ? formatNumber(dailyEarnings) : '0'} XAF
                        </div>
                      </div>

                      <div className="bg-slate-900/60 rounded-2xl p-4 text-center border border-cyan-400/10">
                        <div className="text-xs text-slate-400 mb-1">Daily Rate</div>
                        <div className="text-lg font-bold text-amber-300">
                          {formatNumber(dailyEarnings)} XAF
                        </div>
                      </div>

                      <div className="bg-slate-900/60 rounded-2xl p-4 text-center border border-cyan-400/10">
                        <div className="text-xs text-slate-400 mb-1">Total Earned</div>
                        <div className="text-lg font-bold text-amber-200">
                          {formatNumber(totalEarned)} XAF
                        </div>
                      </div>

                      <div className="bg-slate-900/60 rounded-2xl p-4 text-center border border-cyan-400/10">
                        <div className="text-xs text-slate-400 mb-1">Status</div>
                        <div className={`text-lg font-bold ${
                          canClaim ? 'text-emerald-300' : 
                          isMining ? 'text-cyan-300' : 
                          isNew ? 'text-emerald-200' : 'text-amber-300'
                        }`}>
                          {canClaim ? 'Ready!' : 
                           isMining ? 'Mining' : 
                           isNew ? 'New' : 'Ready'}
                        </div>
                      </div>
                    </div>

                    {/* Mining Action Buttons */}
                    <div className="pt-4 border-t border-slate-800/80">
                      {canClaim ? (
                        <Button
                          size="lg"
                          onClick={() => handleClaimEarnings(machine.id)}
                          disabled={claimingMachine === machine.id}
                          className="w-full cr-button text-slate-950 font-bold text-lg py-6 shadow-lg"
                        >
                          {claimingMachine === machine.id ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              Claiming...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-5 w-5 mr-2" />
                              Claim {formatNumber(dailyEarnings)} XAF
                            </>
                          )}
                        </Button>
                      ) : isMining ? (
                        <Button
                          size="lg"
                          disabled
                          className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 font-bold text-lg py-6 shadow-lg cursor-not-allowed text-slate-950"
                        >
                          <Timer className="h-5 w-5 mr-2 animate-pulse" />
                          Mining... {timeRemaining}
                        </Button>
                      ) : (
                        <Button
                          size="lg"
                          onClick={() => handleStartMining(machine.id)}
                          disabled={activatingMachine === machine.id}
                          className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 font-bold text-lg py-6 shadow-lg text-slate-950"
                        >
                          {activatingMachine === machine.id ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            <>
                              <Zap className="h-5 w-5 mr-2" />
                              Start Mining
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
