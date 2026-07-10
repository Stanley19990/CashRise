"use client"

import { CountrySelect } from "@/components/CountrySelect"
import { useCurrency } from "@/contexts/CurrencyContext"

export function CountrySelector() {
  const { country, currency, formatMoney, setCountry } = useCurrency()

  return (
    <section className="relative z-30 px-4 py-16 pointer-events-auto">
      <div className="mx-auto max-w-md text-center pointer-events-auto">
        <h3 className="text-xl font-bold mb-3 text-cyan-200">Choose your country and local currency</h3>
        <p className="mb-4 text-sm text-slate-400">
          Prices and earnings update across CashRise using your selected currency.
        </p>
        <CountrySelect value={country} onChange={(nextCountry) => void setCountry(nextCountry)} />
        <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-slate-950/50 p-4 text-left">
          <div className="text-sm text-slate-400">Current selection</div>
          <div className="mt-1 font-semibold text-slate-100">
            {country.name} ({currency})
          </div>
          <div className="mt-2 text-sm text-emerald-300">Example machine price: {formatMoney(2500)}</div>
        </div>
      </div>
    </section>
  )
}
