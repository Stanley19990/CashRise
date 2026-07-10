import type { CountryInfo } from "@/lib/currency"

const PHONE_EXAMPLES: Record<string, string> = {
  CM: "6 77 12 34 56",
  US: "(555) 123-4567",
  NG: "080 1234 5678",
  KE: "0712 345 678",
  GH: "024 123 4567",
  ZA: "071 123 4567",
  GB: "07123 456789",
  DE: "01512 3456789",
  FR: "06 12 34 56 78",
  SN: "77 123 45 67",
  CI: "07 12 34 56 78",
  MA: "0612 345678",
  EG: "010 1234 5678",
  TZ: "0712 345 678",
  UG: "0700 123456",
  RW: "078 123 4567",
  CD: "081 234 5678",
  MG: "032 12 345 67",
  BR: "(11) 91234-5678",
  IN: "98765 43210",
  CN: "131 2345 6789"
}

export function getPhoneDialPrefix(country: CountryInfo) {
  return country.dialCode ? `+${country.dialCode}` : "+"
}

export function getPhonePlaceholder(country: CountryInfo) {
  return PHONE_EXAMPLES[country.code] || "Phone number"
}

export function formatPhoneForCountry(phone: string, country: CountryInfo) {
  const trimmed = phone.trim()
  if (!trimmed) return ""

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`
  }

  const digits = trimmed.replace(/\D/g, "")
  if (!digits) return ""

  if (!country.dialCode) {
    return digits
  }

  if (digits.startsWith(country.dialCode)) {
    return `+${digits}`
  }

  return `+${country.dialCode}${digits}`
}
