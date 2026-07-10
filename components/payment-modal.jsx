"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CreditCard, Loader2, Phone, Smartphone, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { CashRiseLogo } from "@/components/cashrise-logo"
import { supabase } from "@/lib/supabase"
import { useCurrency } from "@/contexts/CurrencyContext"
import { PaymentSelector } from "@/components/PaymentSelector"

export function PaymentModal({ open, onOpenChange, machine, user, onPaymentSuccess }) {
  const { country, formatMoney } = useCurrency()
  const [processing, setProcessing] = useState(false)
  const [phone, setPhone] = useState("")
  const [selectedMethod, setSelectedMethod] = useState("auto")
  const [errorMessage, setErrorMessage] = useState("")
  const [paymentMode, setPaymentMode] = useState("select")

  const getDiscountedPrice = (price) => {
    const discountMachines = [50000, 100000, 150000]
    return discountMachines.includes(price) ? Math.round(price * 0.95) : price
  }

  const isDiscounted = (price) => [50000, 100000, 150000].includes(price)

  const finalPrice = getDiscountedPrice(machine?.price || 0)
  const hasDiscount = isDiscounted(machine?.price || 0)
  const discountAmount = (machine?.price || 0) - finalPrice

  useEffect(() => {
    if (open) {
      setPaymentMode("select")
      setErrorMessage("")
      setPhone("")
      setSelectedMethod("auto")
    }
  }, [open])

  const validatePhone = (phoneNumber) => {
    const clean = phoneNumber.replace(/\D/g, "")
    return (clean.length === 9 && clean.startsWith("6")) || (clean.length === 11 && clean.startsWith("2376"))
  }

  const formatPhoneForAPI = (phoneNumber) => phoneNumber.replace(/\D/g, "").slice(-9)

  const handlePayment = async () => {
    setErrorMessage("")

    if (!phone.trim()) {
      setErrorMessage("Please enter your phone number")
      toast.error("Please enter your phone number")
      return
    }

    if (!validatePhone(phone)) {
      setErrorMessage("Please enter a valid Cameroon number, for example 677123456 or 237677123456")
      toast.error("Invalid phone number format")
      return
    }

    if (processing) return

    setProcessing(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      const response = await fetch("/api/payments/direct-pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          amount: finalPrice,
          machineId: machine.id,
          userId: user.id,
          machineName: machine.name,
          phone: formatPhoneForAPI(phone),
          ...(selectedMethod !== "auto" && {
            medium: selectedMethod === "mobile_money" ? "mobile money" : "orange money"
          })
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error?.toLowerCase().includes("insufficient") || data.error?.toLowerCase().includes("balance")) {
          throw new Error("Insufficient balance in your mobile money account. Please recharge and try again.")
        }

        if (data.error?.toLowerCase().includes("phone") || data.error?.toLowerCase().includes("number")) {
          throw new Error("This phone number is not registered with mobile money. Please check and try again.")
        }

        throw new Error(data.error || "Payment failed. Please try again.")
      }

      onPaymentSuccess?.(data.transId, data.externalId)
      toast.success("Payment request sent to your phone!")
      toast.info("Please check your phone and enter your PIN to complete the payment")
      onOpenChange(false)
    } catch (error) {
      console.error("Payment error:", error)
      const errorMsg = error.message || "Payment failed. Please try again."
      setErrorMessage(errorMsg)
      toast.error(errorMsg)
    } finally {
      setProcessing(false)
    }
  }

  const handlePhoneChange = (event) => {
    const cleanValue = event.target.value.replace(/[^\d+]/g, "")
    setPhone(cleanValue)
    setErrorMessage("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cr-glass border border-cyan-400/30 max-w-md">
        <DialogHeader>
          <div className="flex justify-center">
            <CashRiseLogo size={36} />
          </div>
          <DialogTitle className="text-xl text-white text-center">
            Purchase {machine?.name || "Machine"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose a payment option for this machine purchase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {paymentMode === "select" && (
            <PaymentSelector
              amountXAF={finalPrice}
              description={`Purchase ${machine?.name || "Machine"}`}
              purpose="machine_purchase"
              transactionType="machine_purchase"
              metadata={{
                machine_id: machine?.id,
                machine_name: machine?.name,
                original_price: machine?.price,
                discounted_price: finalPrice,
                discount_applied: hasDiscount
              }}
              onFapshiSelect={() => setPaymentMode("mobile_money")}
              onSuccess={(transactionId) => {
                toast.success("Payment confirmed.")
                onOpenChange(false)
                onPaymentSuccess?.(transactionId || "", transactionId || "", "futurapay")
              }}
            />
          )}

          {paymentMode === "mobile_money" && (
            <>
              {hasDiscount && (
                <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300 font-bold">5% DISCOUNT</span>
                    <span className="text-white font-bold">Save {formatMoney(discountAmount || 0)}</span>
                  </div>
                </div>
              )}

              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-3">
                <div className="flex items-start text-cyan-200 text-sm">
                  <Smartphone className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Complete payment with Mobile Money</p>
                    <p className="text-xs mt-1">
                      Dial <span className="font-bold">#150*50#</span> for Orange Money
                      <br />
                      Dial <span className="font-bold">*126#</span> for MTN Mobile Money
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-200">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={handlePhoneChange}
                      className={`pl-10 bg-slate-900/70 border-slate-700 text-white ${errorMessage ? "border-red-500" : ""}`}
                      placeholder="677123456 or 237677123456"
                      type="tel"
                      disabled={processing}
                    />
                  </div>
                  {errorMessage && (
                    <div className="flex items-center gap-1 text-red-400 text-xs mt-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                  <p className="text-xs text-slate-400">
                    Enter Cameroon number, 9 digits starting with 6 or 11 digits with 237.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Payment Method</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={selectedMethod === "auto" ? "default" : "outline"}
                      onClick={() => setSelectedMethod("auto")}
                      disabled={processing}
                      className={selectedMethod === "auto" ? "bg-cyan-400 hover:bg-cyan-500 text-slate-950" : "bg-slate-900/70 hover:bg-slate-800"}
                    >
                      Auto
                    </Button>
                    <Button
                      type="button"
                      variant={selectedMethod === "mobile_money" ? "default" : "outline"}
                      onClick={() => setSelectedMethod("mobile_money")}
                      disabled={processing}
                      className={selectedMethod === "mobile_money" ? "bg-emerald-400 hover:bg-emerald-500 text-slate-950" : "bg-slate-900/70 hover:bg-slate-800"}
                    >
                      MTN
                    </Button>
                    <Button
                      type="button"
                      variant={selectedMethod === "orange_money" ? "default" : "outline"}
                      onClick={() => setSelectedMethod("orange_money")}
                      disabled={processing}
                      className={selectedMethod === "orange_money" ? "bg-amber-400 hover:bg-amber-500 text-slate-950" : "bg-slate-900/70 hover:bg-slate-800"}
                    >
                      Orange
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/60 rounded-2xl p-4 border border-cyan-400/10">
                {hasDiscount ? (
                  <>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-400">Original Price:</span>
                      <span className="text-sm text-rose-300 line-through">
                        {formatMoney(machine?.price || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-400">Discounted Price:</span>
                      <span className="text-2xl font-bold text-emerald-300">
                        {formatMoney(finalPrice || 0)}
                      </span>
                    </div>
                    <div className="text-xs text-amber-300 font-bold text-center mt-1">
                      You save {formatMoney(discountAmount || 0)}.
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400">Amount:</span>
                    <span className="text-2xl font-bold text-emerald-300">
                      {formatMoney(machine?.price || 0)}
                    </span>
                  </div>
                )}
                {machine?.description && (
                  <div className="text-sm text-slate-400 mt-2">
                    {machine.description}
                  </div>
                )}
              </div>

              <Button
                onClick={handlePayment}
                disabled={processing || !phone.trim()}
                className="w-full font-semibold py-3 cr-button text-slate-950 disabled:bg-slate-700 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending Payment Request...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pay {formatMoney(finalPrice || 0)}
                  </>
                )}
              </Button>

              <div className="text-xs text-slate-400 text-center">
                Payment request sent to your phone. Complete it with your PIN or USSD code.
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  if (country.code === "CM") {
                    setPaymentMode("select")
                  } else {
                    onOpenChange(false)
                  }
                }}
                disabled={processing}
                className="w-full cr-outline-button hover:text-cyan-100"
              >
                {country.code === "CM" ? "Back" : "Cancel"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
