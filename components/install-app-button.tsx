"use client"

import { useEffect, useState } from "react"
import type React from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

type InstallAppButtonProps = {
  className?: string
  compact?: boolean
  fullWidth?: boolean
  variant?: React.ComponentProps<typeof Button>["variant"]
}

const isRunningStandalone = () => {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as any).standalone)
}

const isIOS = () => {
  if (typeof window === "undefined") return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export function InstallAppButton({
  className = "",
  compact = false,
  fullWidth = false,
  variant = "outline"
}: InstallAppButtonProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setInstalled(isRunningStandalone())

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
      toast.success("CashRise is installed on this device.")
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (installed) {
      toast.success("CashRise is already installed on this device.")
      return
    }

    if (installPrompt) {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === "accepted") {
        setInstalled(true)
      }
      setInstallPrompt(null)
      return
    }

    if (isIOS()) {
      toast.info("On iPhone, tap Share in Safari, then choose Add to Home Screen.", { duration: 7000 })
      return
    }

    toast.info("Open your browser menu and choose Install app or Add to Home Screen.", { duration: 7000 })
  }

  if (installed) return null

  return (
    <Button
      type="button"
      variant={variant}
      onClick={handleInstall}
      className={`${fullWidth ? "w-full" : ""} ${className}`}
    >
      <Download className={compact ? "h-4 w-4" : "h-4 w-4 mr-2"} />
      {!compact && <span>Download App</span>}
    </Button>
  )
}
