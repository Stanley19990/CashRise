"use client"

import { useState } from "react"
import { CreditCard, Loader2, Smartphone, WalletCards } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FuturapayWidget } from "@/components/FuturapayWidget"
import { useCurrency } from "@/contexts/CurrencyContext"
import { supabase } from "@/lib/supabase"

type PaymentSelectorProps = {
  amountXAF: number
  description: string
  purpose: string
  transactionType?: string
  metadata?: Record<string, unknown>
  onFapshiSelect?: () => void
  onSuccess?: (transactionId?: string) => void
}

export function PaymentSelector({
  amountXAF,
  description,
  purpose,
  transactionType,
  metadata,
  onFapshiSelect,
  onSuccess
}: PaymentSelectorProps) {
  const { country, currency, convertXAF, formatMoney } = useCurrency()
  const [loadingMethod, setLoadingMethod] = useState<string | null>(null)
  const [widgetOpen, setWidgetOpen] = useState(false)
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null)
  const [transactionId, setTransactionId] = useState<string | null>(null)

  const localAmount = convertXAF(amountXAF)
  const amountLabel = formatMoney(amountXAF)
  const methods = [
    ...(country.code === "CM" || country.currency === "XAF"
      ? [
          {
            id: "fapshi",
            name: "Fapshi",
            description: "Cameroon MTN Mobile Money and Orange Money",
            icon: Smartphone
          }
        ]
      : []),
    {
      id: "futurapay",
      name: "Futurapay",
      description: "Cards, crypto, PayPal, Stripe, and international mobile money",
      icon: CreditCard
    }
  ]

  const startFuturapay = async () => {
    if (!amountXAF || amountXAF <= 0) {
      toast.error("Enter a valid amount first")
      return
    }

    setLoadingMethod("futurapay")
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const response = await fetch("/api/payments/futurapay/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {})
        },
        body: JSON.stringify({
          amount: localAmount,
          currency,
          country,
          description,
          purpose,
          type: transactionType,
          metadata
        })
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to start Futurapay checkout")
      }

      setWidgetUrl(result.widgetUrl)
      setTransactionId(result.transactionId)
      setWidgetOpen(true)
    } catch (error: any) {
      toast.error(error.message || "Unable to start payment")
    } finally {
      setLoadingMethod(null)
    }
  }

  return (
    <>
      <div className="space-y-3">
        {methods.map((method) => {
          const Icon = method.icon
          const loading = loadingMethod === method.id

          return (
            <Card key={method.id} className="cr-glass border border-cyan-400/15">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{method.name}</div>
                    <div className="text-sm text-slate-400">{method.description}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-emerald-300">
                      <WalletCards className="h-3 w-3" />
                      {amountLabel}
                    </div>
                  </div>
                </div>
                <Button
                  className="cr-button min-w-24 text-slate-950"
                  disabled={loading || loadingMethod !== null}
                  onClick={
                    method.id === "fapshi"
                      ? onFapshiSelect || (() => toast.info("Fapshi is available for Cameroon machine purchases. Use Futurapay for wallet deposits."))
                      : startFuturapay
                  }
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Select"}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <FuturapayWidget
        open={widgetOpen}
        onOpenChange={setWidgetOpen}
        widgetUrl={widgetUrl}
        transactionId={transactionId}
        onSuccess={() => onSuccess?.(transactionId ?? undefined)}
      />
    </>
  )
}
