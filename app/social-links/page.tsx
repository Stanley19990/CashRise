// app/social-links/page.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, CheckCircle, ArrowLeft, Users } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { FloatingParticles } from "@/components/floating-particles"
import { useCurrency } from "@/contexts/CurrencyContext"

const SOCIAL_MEDIA_LINKS = [
  {
    id: "telegram",
    name: "Telegram Official Channel",
    url: "https://t.me/AiGaming_public",
    description: "Get official updates and announcements",
    required: true
  },
  {
    id: "tiktok",
    name: "TikTok Official Account", 
    url: "https://www.tiktok.com/@ai_gaming_hq",
    description: "Follow for daily updates and tips",
    required: true
  },
  {
    id: "youtube1",
    name: "YouTube - Smart Money Moves",
    url: "https://youtube.com/@smartmoneymoves-i3r",
    description: "Our financial partner channel",
    required: false
  },
  {
    id: "youtube2", 
    name: "YouTube - Funny Frenzy",
    url: "https://youtube.com/@funnyfrenzy237",
    description: "Entertainment partner",
    required: false
  },
  {
    id: "youtube3",
    name: "YouTube - Lifestyle Ambassador", 
    url: "https://youtube.com/@lifestyleambassador",
    description: "Lifestyle and motivation content",
    required: false
  },
  {
    id: "tiktok2",
    name: "TikTok - TrendScope World",
    url: "https://www.tiktok.com/@trendscope_world_action",
    description: "Trending content partner",
    required: false
  }
]

// Function to record social media bonus transaction
const recordSocialMediaBonus = async (userId: string, amount: number) => {
  try {
    const { error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'social_bonus',
        description: 'Social media completion bonus',
        amount: amount,
        currency: 'XAF',
        status: 'completed',
        metadata: {
          bonus_type: 'social_media_completion'
        }
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error recording social media bonus:', error)
    return false
  }
}

export default function SocialLinksPage() {
  const { user, refreshUser } = useAuth()
  const { formatMoney } = useCurrency()
  const router = useRouter()
  // ✅ FIX: Keep completed state only in local React state (not in database)
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [userData, setUserData] = useState<any>(null)

  // Load user data with social links completion status
  useEffect(() => {
    if (user) {
      loadUserData()
    }
  }, [user])

  // ✅ FIX: Removed completed_social_links from query
  const loadUserData = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('social_media_completed, social_media_bonus_paid, wallet_balance')
        .eq('id', user?.id)
        .single()

      if (error) throw error

      setUserData(data)
      
      // ✅ FIX: Removed initialization from database
      // Completed state is now only stored locally in component
      
    } catch (error) {
      console.error('Error loading user data:', error)
      toast.error("Failed to load user data")
    }
  }

  // ✅ FIX: Only update local state, don't save to database
  const handleLinkClick = async (linkId: string, url: string) => {
    if (!user) return

    // Open in new tab
    window.open(url, '_blank', 'noopener,noreferrer')
    
    // Mark as completed locally only
    setCompleted(prev => ({ ...prev, [linkId]: true }))
    
    toast.success("Link opened! Click 'Complete Task' when done.")
  }

  const handleSaveProgress = async () => {
    if (!user) return

    setLoading(true)
    
    try {
      // Check if all required links are completed (in local state)
      const requiredLinks = SOCIAL_MEDIA_LINKS.filter(link => link.required)
      const allRequiredCompleted = requiredLinks.every(link => completed[link.id])

      if (!allRequiredCompleted) {
        toast.error("Please follow all required channels first!")
        setLoading(false)
        return
      }

      // Check if already completed
      if (userData?.social_media_completed) {
        toast.info("You've already completed this task!")
        setLoading(false)
        return
      }

      // Mark social media as completed and award bonus
      const bonusAmount = 500
      const newBalance = (userData?.wallet_balance || 0) + bonusAmount

      const { error } = await supabase
        .from('users')
        .update({ 
          social_media_completed: true,
          social_media_bonus_paid: true,
          wallet_balance: newBalance
        })
        .eq('id', user.id)

      if (error) throw error

      // ✅ RECORD THE TRANSACTION
      await recordSocialMediaBonus(user.id, bonusAmount)
      
      toast.success(`Congratulations! You earned ${formatMoney(bonusAmount)} bonus!`)

      // Reload user data
      await loadUserData()
      await refreshUser()
      
    } catch (error: any) {
      console.error('Error saving progress:', error)
      toast.error("Failed to complete task. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const requiredLinks = SOCIAL_MEDIA_LINKS.filter(link => link.required)
  const optionalLinks = SOCIAL_MEDIA_LINKS.filter(link => !link.required)
  const completedCount = Object.keys(completed).filter(key => completed[key]).length
  const totalLinks = SOCIAL_MEDIA_LINKS.length

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="cr-backdrop cr-grid"></div>
      <FloatingParticles />
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white flex items-center justify-center">
              <Users className="h-8 w-8 mr-3 text-cyan-400" />
              Follow Our Socials
            </h1>
            <p className="text-slate-400 mt-2">
              Stay updated and earn bonus rewards!
            </p>
          </div>

          <div className="w-20"></div>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Progress Card */}
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">Your Progress</h3>
                  <p className="text-slate-400">
                    {completedCount} of {totalLinks} channels followed
                  </p>
                  {userData?.social_media_completed && (
                    <p className="text-green-400 text-sm mt-1">
                      ✅ Task completed! {userData?.social_media_bonus_paid && "Bonus awarded! 🎉"}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-cyan-400">
                    {Math.round((completedCount / totalLinks) * 100)}%
                  </div>
                  <p className="text-slate-400 text-sm">Completed</p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-4 w-full bg-slate-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${(completedCount / totalLinks) * 100}%` }}
                ></div>
              </div>
            </CardContent>
          </Card>

          {/* Required Channels */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <CheckCircle className="h-6 w-6 text-green-400 mr-2" />
                Required Channels
                <span className="text-sm text-slate-400 ml-2">
                  ({requiredLinks.filter(link => completed[link.id]).length}/{requiredLinks.length})
                </span>
              </CardTitle>
              <p className="text-slate-400">
                Follow these channels to stay updated with AI Gaming
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {requiredLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="flex-1">
                    <p className="font-medium text-white">{link.name}</p>
                    <p className="text-sm text-slate-400">{link.description}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {completed[link.id] ? (
                      <div className="flex items-center text-green-400">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Followed
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleLinkClick(link.id, link.url)}
                        className="bg-cyan-500 hover:bg-cyan-600 text-white"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Follow Now
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Optional Partners */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Bonus Partners</CardTitle>
              <p className="text-slate-400">
                Follow our partners for extra tips and content (optional)
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {optionalLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                  <div className="flex-1">
                    <p className="font-medium text-slate-300">{link.name}</p>
                    <p className="text-sm text-slate-500">{link.description}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleLinkClick(link.id, link.url)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {completed[link.id] ? "Visited" : "Visit"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="text-center">
            <Button
              onClick={handleSaveProgress}
              disabled={loading || userData?.social_media_completed}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 px-8 py-3 text-lg font-bold disabled:opacity-50"
              size="lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : userData?.social_media_completed ? (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Task Completed ✓
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Complete Task & Claim {formatMoney(500)}
                </>
              )}
            </Button>
            <p className="text-slate-400 mt-3 text-sm">
              {userData?.social_media_completed 
                ? "You've already completed this task and received your bonus!"
                : `Follow all required channels, then click to claim your ${formatMoney(500)} bonus!`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
