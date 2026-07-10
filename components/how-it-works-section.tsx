"use client"

import { Card } from "@/components/ui/card"
import { useState } from "react"
import { useCurrency } from "@/contexts/CurrencyContext"

const steps = [
  {
    title: "AI Account Setup",
    description: "Create your AI-powered earning profile with smart wallet integration",
    icon: "🤖",
    animation: "AI avatar materializes with holographic data streams",
    aiFeature: "Personalized earning algorithms",
  },
  {
    title: "Smart Machine Selection",
    description: "AI recommends optimal ad-watching machines based on your profile",
    icon: "🏭",
    animation: "Holographic machine catalog with AI recommendations",
    aiFeature: "Machine performance prediction",
  },
  {
    title: "Targeted Ad Experience",
    description: "Watch AI-curated ads that match your interests and maximize earnings",
    icon: "📺",
    animation: "Immersive ad display with earning particles",
    aiFeature: "Real-time earning optimization",
  },
  {
    title: "Automated Payouts",
    description: "AI processes your earnings and handles secure withdrawals",
    icon: "💎",
    animation: "Digital currency flows with blockchain verification",
    aiFeature: "Smart payout scheduling",
  },
]

export function HowItWorksSection() {
  const { formatMoney } = useCurrency()
  const [activeStep, setActiveStep] = useState<number | null>(null)

  return (
    <section id="how-it-works" className="py-20 px-4 relative z-10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-emerald-200 text-xs md:text-sm font-mono tracking-[0.35em]">CASHRISE FLOW</span>
          <h2 className="text-4xl md:text-6xl font-bold mt-4 cr-title cr-hero-text">
            How CashRise Multiplies Your Earnings
          </h2>
          <p className="text-slate-300 text-lg mt-4 max-w-2xl mx-auto">
            Your machines run continuously, collecting ad revenue and compounding your daily earnings while you stay in
            control.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <Card
              key={index}
              className="cr-glass cr-card-3d p-6 text-center cursor-pointer transition-all duration-300 hover:scale-105"
              onClick={() => setActiveStep(activeStep === index ? null : index)}
            >
              <div className="relative">
                <div className="text-5xl mb-4 filter drop-shadow-lg">{step.icon}</div>
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-300 rounded-full animate-pulse"></div>
              </div>

              <h3 className="text-xl font-bold mb-2 text-emerald-200">{step.title}</h3>
              <p className="text-slate-300 mb-4 leading-relaxed">{step.description}</p>

              <div className="text-xs text-cyan-200 font-mono mb-4">{step.aiFeature}</div>

              {activeStep === index && (
                <div className="mt-4 p-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-2xl border border-cyan-400/30 backdrop-blur-sm">
                  <p className="text-sm text-amber-200 italic mb-2">{step.animation}</p>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-2 rounded-full animate-pulse"
                      style={{ width: "75%" }}
                    ></div>
                  </div>
                  <p className="text-xs text-cyan-200 mt-2">CashRise Signal Active</p>
                </div>
              )}
            </Card>
          ))}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-6 cr-glass rounded-2xl border border-cyan-400/20">
            <div className="text-3xl font-bold text-cyan-300">2.4M+</div>
            <div className="text-slate-300">Signals Processed Daily</div>
          </div>
          <div className="text-center p-6 cr-glass rounded-2xl border border-cyan-400/20">
            <div className="text-3xl font-bold text-emerald-300">97.3%</div>
            <div className="text-slate-300">Automation Precision</div>
          </div>
          <div className="text-center p-6 cr-glass rounded-2xl border border-cyan-400/20">
            <div className="text-3xl font-bold text-amber-300">{formatMoney(847000000)}</div>
            <div className="text-slate-300">Machine Earnings Tracked</div>
          </div>
        </div>
      </div>
    </section>
  )
}
