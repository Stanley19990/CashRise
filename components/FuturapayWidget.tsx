"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

type FuturapayWidgetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  widgetUrl: string | null
  transactionId: string | null
  onSuccess?: () => void
}

export function FuturapayWidget({
  open,
  onOpenChange,
  widgetUrl,
  transactionId,
  onSuccess
}: FuturapayWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("pending")
  const [openedExternally, setOpenedExternally] = useState(false)

  useEffect(() => {
    if (!open) {
      setLoading(true)
      setError("")
      setStatus("pending")
      setOpenedExternally(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || !widgetUrl || openedExternally) return

    const checkoutWindow = window.open(widgetUrl, "_blank", "noopener,noreferrer")
    if (checkoutWindow) {
      setOpenedExternally(true)
      setLoading(false)
    } else {
      setError("Your browser blocked the checkout window. Use the button below to open it.")
      setLoading(false)
    }
  }, [open, widgetUrl, openedExternally])

  useEffect(() => {
    if (!open || !transactionId) return

    let stopped = false
    const pollStatus = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const response = await fetch("/api/payments/futurapay/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
          },
          body: JSON.stringify({ transactionId })
        })

        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "Unable to verify payment")

        const nextStatus = String(result.status || "pending").toLowerCase()
        if (stopped) return
        setStatus(nextStatus)

        if (["completed", "success", "successful"].includes(nextStatus)) {
          onSuccess?.()
          onOpenChange(false)
        }

        if (["failed", "cancelled", "canceled", "expired"].includes(nextStatus)) {
          setError("Payment was not completed. Please try again.")
        }
      } catch (error: any) {
        if (!stopped) setError(error.message || "Unable to verify payment")
      }
    }

    const interval = window.setInterval(pollStatus, 5000)
    pollStatus()

    return () => {
      stopped = true
      window.clearInterval(interval)
    }
  }, [open, transactionId, onOpenChange, onSuccess])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cr-glass max-w-3xl border border-cyan-400/30 p-0 text-slate-100">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Secure Checkout</DialogTitle>
          <DialogDescription className="text-slate-400">
            Complete your payment in the secure checkout window.
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-b-lg bg-slate-950 px-6 text-center">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
            </div>
          )}

          {widgetUrl ? (
            <div className="max-w-md space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                <ExternalLink className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Checkout opened in a new tab</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Choose your preferred card, wallet, crypto, or mobile payment option there. Keep this window open while we verify your payment.
                </p>
              </div>
              <Button className="cr-button text-slate-950" onClick={() => window.open(widgetUrl, "_blank", "noopener,noreferrer")}>
                Open Checkout
              </Button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">Secure checkout unavailable.</div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-5 py-4">
          <p className="text-sm text-slate-400">
            Status: <span className="text-cyan-200">{status}</span>
            {error ? <span className="ml-2 text-red-300">{error}</span> : null}
          </p>
          <Button variant="outline" className="cr-outline-button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
