// components/social-media-gate.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, CheckCircle, Lock } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useCurrency } from "@/contexts/CurrencyContext"

interface SocialMediaGateProps {
  userId: string
  onComplete: () => void
}

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
    url: "https://www.tiktok.com/@ai_gaming_hq?_r=1&_d=ZM-91LemiJYdzA",
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

export function SocialMediaGate({ userId, onComplete }: SocialMediaGateProps) {
  const { formatMoney } = useCurrency()
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [userData, setUserData] = useState<any>(null)

  // Load user data with social links completion status
  useEffect(() => {
    loadUserData()
  }, [userId])

  const loadUserData = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('completed_social_links, social_media_completed, wallet_balance')
        .eq('id', userId)
        .single()

      if (error) throw error

      setUserData(data)
      
      // Initialize completed state from database
      if (data?.completed_social_links) {
        const completedMap: Record<string, boolean> = {}
        data.completed_social_links.forEach((linkId: string) => {
          completedMap[linkId] = true
        })
        setCompleted(completedMap)
      }

      // If already completed, trigger onComplete
      if (data?.social_media_completed) {
        onComplete()
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    }
  }

  const handleLinkClick = async (linkId: string) => {
    // Mark as completed locally
    setCompleted(prev => ({ ...prev, [linkId]: true }))
    
    // Save to database immediately
    try {
      const currentLinks = userData?.completed_social_links || []
      const newLinks = [...new Set([...currentLinks, linkId])]

      const { error } = await supabase
        .from('users')
        .update({ 
          completed_social_links: newLinks
        })
        .eq('id', userId)

      if (error) throw error

      // Reload user data
      await loadUserData()
      
    } catch (error) {
      console.error('Error saving link:', error)
    }
  }

  const handleComplete = async () => {
    const requiredLinks = SOCIAL_MEDIA_LINKS.filter(link => link.required)
    const allRequiredCompleted = requiredLinks.every(link => completed[link.id])
    
    if (!allRequiredCompleted) {
      toast.error("Please follow all required social media channels first")
      return
    }

    setLoading(true)
    
    try {
      // Update user status to completed
      const { error } = await supabase
        .from('users')
        .update({ 
          social_media_completed: true,
          // Add bonus reward
          wallet_balance: (userData?.wallet_balance || 0) + 500,
          social_media_bonus_paid: true
        })
        .eq('id', userId)

      if (error) throw error

      // ✅ RECORD THE TRANSACTION
      await recordSocialMediaBonus(userId, 500)

      toast.success(`Thank you! You earned ${formatMoney(500)} bonus and unlocked full app access!`)
      onComplete()
      
    } catch (error: any) {
      console.error('Error updating social media status:', error)
      toast.error("Failed to save your progress. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const requiredLinks = SOCIAL_MEDIA_LINKS.filter(link => link.required)
  const optionalLinks = SOCIAL_MEDIA_LINKS.filter(link => !link.required)
  const allRequiredCompleted = requiredLinks.every(link => completed[link.id])

  // Don't show gate if already completed
  if (userData?.social_media_completed) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="bg-slate-900 border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader className="text-center border-b border-slate-700">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Lock className="h-6 w-6 text-cyan-400" />
            <CardTitle className="text-2xl text-white">Welcome to AI Gaming!</CardTitle>
          </div>
          <p className="text-slate-400">
            Complete these quick steps to unlock full app access and earn {formatMoney(500)} bonus!
          </p>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Required Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
              Required Steps
              <span className="text-sm text-slate-400 ml-2">
                ({requiredLinks.filter(link => completed[link.id]).length}/{requiredLinks.length} completed)
              </span>
            </h3>
            
            <div className="space-y-3">
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
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.open(link.url, '_blank', 'noopener,noreferrer')
                          handleLinkClick(link.id)
                        }}
                        className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Follow
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Section */}
          {optionalLinks.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Bonus Partners (Optional)</h3>
              <p className="text-sm text-slate-400">
                Follow our partners for extra tips and content
              </p>
              
              <div className="space-y-3">
                {optionalLinks.map((link) => (
                  <div key={link.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                    <div className="flex-1">
                      <p className="font-medium text-slate-300">{link.name}</p>
                      <p className="text-sm text-slate-500">{link.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        window.open(link.url, '_blank', 'noopener,noreferrer')
                        handleLinkClick(link.id)
                      }}
                      className="text-slate-400 hover:text-slate-300"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {completed[link.id] ? "Visited" : "Visit"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completion Bonus Info */}
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-cyan-500/20 rounded-full p-2">
                <CheckCircle className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="font-medium text-cyan-300">Completion Bonus!</p>
                <p className="text-sm text-cyan-200/70">
                  Complete all required steps to unlock full app access and earn {formatMoney(500)} bonus!
                </p>
              </div>
            </div>
          </div>

          {/* Complete Button */}
          <Button
            onClick={handleComplete}
            disabled={!allRequiredCompleted || loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 font-semibold py-3"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Unlocking App...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Unlock Full App Access & Get {formatMoney(500)} Bonus
              </>
            )}
          </Button>

          <p className="text-xs text-slate-500 text-center">
            You can always access these links later from your dashboard
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
