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

  useEffect(() => {
    if (!open) {
      setLoading(true)
      setError("")
      setStatus("pending")
    }
  }, [open])

  useEffect(() => {
    if (open && widgetUrl) {
      setLoading(true)
      setError("")
    }
  }, [open, widgetUrl])

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
        if (!stopped) setError("Waiting for payment confirmation.")
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

        <div className="relative h-[620px] overflow-hidden rounded-b-lg bg-slate-950">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
            </div>
          )}

          {widgetUrl ? (
            <iframe
              id="futurapay-widget"
              title="Secure payment widget"
              src={widgetUrl}
              width="100%"
              height="600"
              frameBorder="0"
              className="h-full w-full bg-white"
              onLoad={() => setLoading(false)}
              allow="payment *; clipboard-write"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              Secure checkout unavailable.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-5 py-4">
          <p className="text-sm text-slate-400">
            Status: <span className="text-cyan-200">{status}</span>
            {error ? <span className="ml-2 text-red-300">{error}</span> : null}
          </p>
          <div className="flex items-center gap-2">
            {widgetUrl ? (
              <Button
                variant="outline"
                className="cr-outline-button"
                onClick={() => window.open(widgetUrl, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Tab
              </Button>
            ) : null}
            <Button variant="outline" className="cr-outline-button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
