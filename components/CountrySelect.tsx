"use client"

import { useMemo, useState } from "react"
import { Check, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { CountryInfo, createCustomCountry, getSupportedCountries, normalizeCountry } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/language-provider"

type CountrySelectProps = {
  value?: CountryInfo | string
  onChange: (country: CountryInfo) => void
  disabled?: boolean
  className?: string
}

export function CountrySelect({ value, onChange, disabled, className }: CountrySelectProps) {
  const { t } = useLanguage()
  const [query, setQuery] = useState("")
  const countries = getSupportedCountries()
  const selectedCountry = normalizeCountry(value || "CM")

  const filteredCountries = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return countries

    return countries.filter((country) => {
      return (
        country.name.toLowerCase().includes(search) ||
        country.code.toLowerCase().includes(search) ||
        country.currency.toLowerCase().includes(search) ||
        country.currencySymbol.toLowerCase().includes(search) ||
        country.dialCode.includes(search.replace(/\D/g, ""))
      )
    })
  }, [countries, query])

  const canUseCustomCountry =
    query.trim().length >= 2 &&
    !countries.some((country) => country.name.toLowerCase() === query.trim().toLowerCase())

  const handleSelectCountry = (country: CountryInfo) => {
    if (disabled) return
    onChange(country)
  }

  return (
    <div className="relative z-20 space-y-2 pointer-events-auto">
      <div className="rounded-md border border-cyan-400/30 bg-slate-950/70 p-3 text-left">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Selected country</div>
        <div className="mt-1 flex items-center justify-between gap-3 text-sm text-slate-100">
          <span className="min-w-0 truncate font-semibold">
            {selectedCountry.flag} {selectedCountry.name}
          </span>
          <span className="shrink-0 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-100">
            {selectedCountry.currency}
          </span>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled}
          placeholder={t("searchCountry")}
          className={cn(
            "h-10 border-cyan-500/40 bg-slate-900/80 pl-9 text-slate-100 placeholder:text-slate-500",
            className
          )}
        />
      </div>

      <div className="max-h-64 overflow-y-auto rounded-md border border-slate-700/80 bg-slate-950/90 p-1">
        {canUseCustomCountry ? (
          <button
            type="button"
            disabled={disabled}
            className="mb-1 flex min-h-11 w-full items-center justify-between rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-left text-sm text-emerald-100 transition hover:bg-emerald-400/15 active:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => handleSelectCountry(createCustomCountry(query))}
          >
            <span className="min-w-0 truncate">Use "{query.trim()}" (USD)</span>
            <Check className="h-4 w-4 shrink-0 text-emerald-300" />
          </button>
        ) : null}

        {filteredCountries.length > 0 ? (
          filteredCountries.map((country) => {
            const isSelected = selectedCountry.code === country.code

            return (
              <button
                key={country.code}
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
                  isSelected
                    ? "border border-cyan-400/35 bg-cyan-400/15 text-cyan-50"
                    : "text-slate-100 hover:bg-cyan-400/10 active:bg-cyan-400/15"
                )}
                onClick={() => handleSelectCountry(country)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-base">{country.flag}</span>
                  <span className="min-w-0 truncate">{country.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
                  <span>{country.currency}</span>
                  {isSelected ? <Check className="h-4 w-4 text-emerald-300" /> : null}
                </span>
              </button>
            )
          })
        ) : (
          <div className="px-3 py-6 text-center text-sm text-slate-400">{t("noCountryFound")}</div>
        )}
      </div>
    </div>
  )
}
