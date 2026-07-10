"use client"

import { Button } from "@/components/ui/button"
import { MoneyMachine } from "@/components/money-machine"
import { useState } from "react"
import { SignupModal } from "@/components/signup-modal"
import { LoginModal } from "@/components/login-modal"
import { CashRiseLogo } from "@/components/cashrise-logo"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useLanguage } from "@/components/language-provider"
import { useCurrency } from "@/contexts/CurrencyContext"
import { InstallAppButton } from "@/components/install-app-button"

export function HeroSection() {
  const { t } = useLanguage()
  const { formatMoney } = useCurrency()
  const [showSignup, setShowSignup] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 z-10">
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
      {/* AI Character and Holographic Data Overlays */}
      <div className="absolute inset-0 pointer-events-none">
        {/* <div className="absolute top-1/4 right-4 md:right-8 w-48 md:w-64 h-60 md:h-80 opacity-90 z-20">
          <img
            src="/placeholder.svg?height=320&width=256"
            alt="AI Assistant"
            className="w-full h-full object-contain animate-pulse drop-shadow-2xl"
          />
        </div> */}

        <div className="absolute top-20 left-4 md:left-20 bg-emerald-500/10 backdrop-blur-sm border border-emerald-400/30 rounded-2xl p-3 md:p-4 animate-bounce z-10">
          <div className="text-emerald-200 text-xs md:text-sm font-mono">CASHFLOW SIGNAL</div>
          <div className="text-amber-300 font-bold text-sm md:text-base">+{formatMoney(48200)}</div>
        </div>

        <div className="absolute bottom-32 right-4 md:right-32 bg-cyan-500/10 backdrop-blur-sm border border-cyan-400/30 rounded-2xl p-3 md:p-4 animate-pulse z-10">
          <div className="text-cyan-200 text-xs md:text-sm font-mono">LIVE RISE</div>
          <div className="text-amber-300 font-bold text-sm md:text-base">+{formatMoney(312450)}</div>
        </div>

        {/* Floating 3D Money Machines */}
        <div className="absolute inset-0 pointer-events-none z-5">
          <MoneyMachine className="absolute top-20 left-10 money-machine" delay={0} />
          <MoneyMachine className="absolute top-40 right-20 money-machine" delay={2} />
          <MoneyMachine className="absolute bottom-40 left-20 money-machine" delay={4} />
          <MoneyMachine className="absolute bottom-20 right-10 money-machine" delay={1} />
        </div>
      </div>

      <div className="text-center max-w-5xl mx-auto">
        {/* Hero Content */}
        <div className="relative z-10">
          <div className="mb-4">
            <span className="text-emerald-200 text-xs md:text-sm font-mono tracking-[0.26em] sm:tracking-[0.4em]">
              WORLD'S FIRST AI INVESTMENT PLATFORM
            </span>
          </div>

          <div className="flex items-center justify-center mb-5">
            <CashRiseLogo size={52} />
          </div>

          <h1 className="text-4xl md:text-7xl font-bold mb-4 cr-title cr-hero-text">
            {t("heroHeadline")}
          </h1>

          <p className="text-xl md:text-2xl mb-4 text-slate-200 font-semibold">
            AI-powered gaming machines that grow your earnings daily.
          </p>

          <p className="text-lg md:text-xl mb-8 text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Turn attention into income with the{" "}
            <span className="text-emerald-300 font-semibold">CashRise global AI investment platform</span>. Buy machines, earn
            daily profits, and let smart automation{" "}
            <span className="text-amber-300 font-semibold">multiply your earnings</span>.
          </p>

          {/* AI Confidence Score */}
          <div className="mb-8 flex justify-center">
            <div className="bg-slate-900/50 backdrop-blur-sm border border-cyan-400/30 rounded-full px-6 py-3 cr-tilt">
              <span className="text-cyan-200 text-xs font-mono tracking-[0.3em]">PROFIT CONFIDENCE</span>
              <span className="text-amber-300 font-bold text-lg ml-2">96.3%</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={() => setShowSignup(true)}
              className="cr-button text-slate-950 font-bold px-10 py-4 text-lg rounded-full transition-all duration-300 hover:scale-105"
            >
              {t("startYourRise")}
            </Button>
            <Button
              onClick={() => setShowLogin(true)}
              variant="outline"
              className="cr-outline-button px-10 py-4 text-lg rounded-full transition-all duration-300"
            >
              {t("loginToDashboard")}
            </Button>
            <Button
              onClick={scrollToHowItWorks}
              variant="outline"
              className="cr-outline-button px-10 py-4 text-lg rounded-full transition-all duration-300"
            >
              {t("seeHowItWorks")}
            </Button>
            <InstallAppButton className="cr-outline-button px-10 py-4 text-lg rounded-full transition-all duration-300" />
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span>Real-time AI Earnings</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
              <span>Global Payment Support</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
              <span>24/7 Machine Growth</span>
            </div>
          </div>
        </div>
      </div>

      <SignupModal open={showSignup} onOpenChange={setShowSignup} />
      <LoginModal open={showLogin} onOpenChange={setShowLogin} />
    </section>
  )
}
