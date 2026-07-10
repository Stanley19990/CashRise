"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { TrendingUp, Calendar, Zap, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { toNumber } from "@/lib/safe-data"
import { useCurrency } from "@/contexts/CurrencyContext"

interface EarningsData {
  date: string
  earnings_xaf: number
  earnings_usd: number
  machine_count: number
}

interface ChartStats {
  sevenDayTotal: number
  thirtyDayTotal: number
  bestDay: number
  dailyAverage: number
  activeDays: number
}

export function EarningsChart() {
  const { user } = useAuth()
  const { formatMoney } = useCurrency()
  const [earningsData, setEarningsData] = useState<EarningsData[]>([])
  const [chartStats, setChartStats] = useState<ChartStats>({
    sevenDayTotal: 0,
    thirtyDayTotal: 0,
    bestDay: 0,
    dailyAverage: 0,
    activeDays: 0
  })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7days' | '30days'>('7days')

  const fetchEarningsData = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - (timeRange === '7days' ? 7 : 30))

      // Fetch earnings data from database
      const { data, error } = await supabase
        .from('earnings')
        .select('amount, earned_at, machine_id')
        .eq('user_id', user.id)
        .gte('earned_at', startDate.toISOString())
        .lte('earned_at', endDate.toISOString())
        .order('earned_at', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        // Group earnings by date and convert to XAF
        const dailyEarnings: { [key: string]: { earnings_xaf: number, earnings_usd: number, machine_count: Set<string> } } = {}
        
        data.forEach(earning => {
          const date = new Date(earning.earned_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })
          const earningsXAF = toNumber(earning.amount)
          
          if (dailyEarnings[date]) {
            dailyEarnings[date].earnings_xaf += earningsXAF
            dailyEarnings[date].earnings_usd += earningsXAF / 600
            dailyEarnings[date].machine_count.add(earning.machine_id)
          } else {
            dailyEarnings[date] = {
              earnings_xaf: earningsXAF,
              earnings_usd: earningsXAF / 600,
              machine_count: new Set([earning.machine_id])
            }
          }
        })

        // Format data for chart and fill missing dates
        const chartData: EarningsData[] = []
        const currentDate = new Date(startDate)
        
        while (currentDate <= endDate) {
          const dateStr = currentDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })
          
          const dayData = dailyEarnings[dateStr]
          chartData.push({
            date: dateStr,
            earnings_xaf: dayData ? Math.round(dayData.earnings_xaf) : 0,
            earnings_usd: dayData ? dayData.earnings_usd : 0,
            machine_count: dayData ? dayData.machine_count.size : 0
          })
          
          currentDate.setDate(currentDate.getDate() + 1)
        }

        setEarningsData(chartData)

        // Calculate statistics
        const sevenDayTotal = chartData.slice(-7).reduce((sum, day) => sum + toNumber(day.earnings_xaf), 0)
        const thirtyDayTotal = chartData.reduce((sum, day) => sum + toNumber(day.earnings_xaf), 0)
        const bestDay = Math.max(0, ...chartData.map(day => toNumber(day.earnings_xaf)))
        const activeDays = chartData.filter(day => toNumber(day.earnings_xaf) > 0).length
        const dailyAverage = activeDays > 0 ? thirtyDayTotal / activeDays : 0

        setChartStats({
          sevenDayTotal,
          thirtyDayTotal,
          bestDay,
          dailyAverage,
          activeDays
        })

      } else {
        // No earnings data, create empty chart
        const emptyData: EarningsData[] = []
        const currentDate = new Date(startDate)
        
        while (currentDate <= endDate) {
          const dateStr = currentDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })
          
          emptyData.push({
            date: dateStr,
            earnings_xaf: 0,
            earnings_usd: 0,
            machine_count: 0
          })
          
          currentDate.setDate(currentDate.getDate() + 1)
        }

        setEarningsData(emptyData)
        setChartStats({
          sevenDayTotal: 0,
          thirtyDayTotal: 0,
          bestDay: 0,
          dailyAverage: 0,
          activeDays: 0
        })
      }
    } catch (error) {
      console.error('Error fetching earnings data:', error)
      toast.error('Failed to load earnings data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEarningsData()
  }, [user, timeRange])

  const handleRefresh = async () => {
    await fetchEarningsData()
    toast.success('Earnings data updated!')
  }

  if (loading) {
    return (
      <Card className="cr-glass">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-emerald-300" />
            <span>Earnings Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
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
            <TrendingUp className="h-5 w-5 text-emerald-300" />
            <span>Earnings Overview</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as '7days' | '30days')}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-sm text-slate-200"
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
            <RefreshCw 
              className={`h-4 w-4 text-cyan-200 cursor-pointer ${loading ? 'animate-spin' : ''}`}
              onClick={handleRefresh}
            />
          </div>
        </div>
        <p className="text-slate-300 text-sm">
          Your earnings growth from machines and ad watching
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] min-h-[300px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={earningsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={12} 
                tick={{ fill: '#cbd5e1' }}
                interval={timeRange === '7days' ? 0 : 'preserveStartEnd'}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={12} 
                tick={{ fill: '#cbd5e1' }}
                tickFormatter={(value) => formatMoney(toNumber(value))}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                }}
                formatter={(value: number) => [
                  formatMoney(toNumber(value)),
                  "Earnings"
                ]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Bar
                dataKey="earnings_xaf"
                fill="#16d9b6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="text-center bg-slate-900/60 rounded-2xl p-3 border border-cyan-400/10">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Calendar className="h-4 w-4 text-emerald-300" />
              <div className="text-lg font-bold text-emerald-300">
                {timeRange === '7days' 
                  ? formatMoney(chartStats.sevenDayTotal)
                  : formatMoney(chartStats.thirtyDayTotal)
                }
              </div>
            </div>
            <div className="text-xs text-slate-400">
              {timeRange === '7days' ? '7-Day' : '30-Day'} Total
            </div>
          </div>
          
          <div className="text-center bg-slate-900/60 rounded-2xl p-3 border border-cyan-400/10">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Zap className="h-4 w-4 text-cyan-300" />
              <div className="text-lg font-bold text-cyan-300">
                {formatMoney(chartStats.bestDay)}
              </div>
            </div>
            <div className="text-xs text-slate-400">Best Day</div>
          </div>
          
          <div className="text-center bg-slate-900/60 rounded-2xl p-3 border border-cyan-400/10">
            <div className="text-lg font-bold text-amber-300 mb-1">
              {formatMoney(Math.round(chartStats.dailyAverage))}
            </div>
            <div className="text-xs text-slate-400">Daily Average</div>
          </div>
          
          <div className="text-center bg-slate-900/60 rounded-2xl p-3 border border-cyan-400/10">
            <div className="text-lg font-bold text-amber-200 mb-1">
              {chartStats.activeDays}
            </div>
            <div className="text-xs text-slate-400">Active Days</div>
          </div>
        </div>

        {/* Additional Info */}
        {earningsData.some(day => day.earnings_xaf > 0) && (
          <div className="mt-4 text-xs text-slate-400 text-center">
            Showing earnings from {earningsData.filter(day => day.machine_count > 0).length} days with active machines
          </div>
        )}
      </CardContent>
    </Card>
  )
}
