"use client"

import { Input } from "@/components/ui/input"
import type { CountryInfo } from "@/lib/currency"
import { getPhoneDialPrefix, getPhonePlaceholder } from "@/lib/phone"

type CountryPhoneInputProps = {
  id?: string
  country: CountryInfo
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function CountryPhoneInput({
  id = "phone",
  country,
  value,
  onChange,
  disabled,
  className
}: CountryPhoneInputProps) {
  return (
    <div className="flex overflow-hidden rounded-md border border-cyan-500/40 bg-slate-900/70 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20">
      <div className="flex min-w-[4.5rem] items-center justify-center border-r border-cyan-500/20 bg-slate-950/60 px-3 text-sm font-medium text-cyan-100">
        {getPhoneDialPrefix(country)}
      </div>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={getPhonePlaceholder(country)}
        className={`h-10 rounded-none border-0 bg-transparent text-slate-100 focus-visible:ring-0 ${className || ""}`}
      />
    </div>
  )
}
