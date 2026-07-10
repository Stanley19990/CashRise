export const XAF_USD_RATE = 573.9

export type CurrencyCode =
  | "XAF"
  | "USD"
  | "EUR"
  | "GBP"
  | "NGN"
  | "KES"
  | "GHS"
  | "ZAR"
  | "XOF"
  | "MAD"
  | "EGP"
  | "TZS"
  | "UGX"
  | "RWF"
  | "CDF"
  | "MGA"
  | "BRL"
  | "INR"
  | "CNY"

export type CountryInfo = {
  id: number
  code: string
  name: string
  dialCode: string
  flag: string
  currency: CurrencyCode
  currencySymbol: string
  usdExchangeRate: number
}

export const createCustomCountry = (name: string, code = "ZZ"): CountryInfo => {
  const cleanName = name.trim() || "Other country"
  return {
    id: 0,
    code: code.toUpperCase(),
    name: cleanName,
    dialCode: "",
    flag: "🌐",
    currency: "USD",
    currencySymbol: "$",
    usdExchangeRate: 1
  }
}

export type MachineRarity = "common" | "rare" | "epic" | "legendary"

export type MachineCurrencyData = {
  id: string
  numericId: number
  name: string
  priceXAF: number
  hasDiscount: boolean
  discountPercent: number
  priceDiscountedXAF: number
  dailyEarnXAF: number
  monthlyEarnXAF: number
  roiDays: number
  rarity: MachineRarity
  description: string
  features: string[]
}

export const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  XAF: 573.9,
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  NGN: 1500,
  KES: 145,
  GHS: 12,
  ZAR: 18,
  XOF: 573.9,
  MAD: 10,
  EGP: 30,
  TZS: 2500,
  UGX: 3700,
  RWF: 1300,
  CDF: 2700,
  MGA: 4500,
  BRL: 5,
  INR: 83,
  CNY: 7.2
}

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  XAF: "XAF",
  USD: "$",
  EUR: "€",
  GBP: "£",
  NGN: "₦",
  KES: "KSh",
  GHS: "GH₵",
  ZAR: "R",
  XOF: "XOF",
  MAD: "MAD",
  EGP: "E£",
  TZS: "TSh",
  UGX: "USh",
  RWF: "FRw",
  CDF: "FC",
  MGA: "Ar",
  BRL: "R$",
  INR: "₹",
  CNY: "¥"
}

export const MACHINES_DATA: MachineCurrencyData[] = [
  {
    id: "ai_starter_engine",
    numericId: 1,
    name: "AI Starter Engine",
    priceXAF: 2500,
    hasDiscount: false,
    discountPercent: 0,
    priceDiscountedXAF: 2500,
    dailyEarnXAF: 900,
    monthlyEarnXAF: 27000,
    roiDays: 3,
    rarity: "common",
    description:
      "Perfect entry-level AI machine for beginners. Features blue holographic displays and smart learning algorithms.",
    features: ["Smart Learning AI", "Blue Holographic Display", "Auto-Optimization", "24/7 Operation", "Beginner Friendly"]
  },
  {
    id: "smart_gaming_engine",
    numericId: 2,
    name: "Smart Gaming Engine",
    priceXAF: 5000,
    hasDiscount: false,
    discountPercent: 0,
    priceDiscountedXAF: 5000,
    dailyEarnXAF: 1650,
    monthlyEarnXAF: 49500,
    roiDays: 4,
    rarity: "common",
    description: "Advanced purple-themed gaming AI with enhanced processing power.",
    features: ["Purple Smart Interface", "Enhanced Processing", "Gaming Optimization", "Ad Targeting AI", "Consistent Earnings"]
  },
  {
    id: "quantum_processor",
    numericId: 3,
    name: "Quantum Processor",
    priceXAF: 10000,
    hasDiscount: false,
    discountPercent: 0,
    priceDiscountedXAF: 10000,
    dailyEarnXAF: 3500,
    monthlyEarnXAF: 105000,
    roiDays: 3,
    rarity: "rare",
    description: "Green quantum-powered AI machine with advanced neural networks.",
    features: ["Quantum Processing", "Green Energy Core", "Neural Networks", "Multi-Stream Revenue", "Advanced Analytics"]
  },
  {
    id: "neural_maximizer",
    numericId: 4,
    name: "Neural Maximizer",
    priceXAF: 15000,
    hasDiscount: false,
    discountPercent: 0,
    priceDiscountedXAF: 15000,
    dailyEarnXAF: 5000,
    monthlyEarnXAF: 150000,
    roiDays: 3,
    rarity: "rare",
    description: "Orange-themed neural AI maximizer with deep learning capabilities.",
    features: ["Deep Learning AI", "Orange Neural Core", "Predictive Algorithms", "Engagement Maximizer", "Revenue Optimization"]
  },
  {
    id: "hyper_intelligence",
    numericId: 5,
    name: "Hyper Intelligence",
    priceXAF: 25000,
    hasDiscount: false,
    discountPercent: 0,
    priceDiscountedXAF: 25000,
    dailyEarnXAF: 8333,
    monthlyEarnXAF: 250000,
    roiDays: 4,
    rarity: "epic",
    description: "Red-powered hyper-intelligent AI system with advanced machine learning.",
    features: ["Hyper Intelligence", "Red Power Core", "Market Analysis", "Premium Earnings", "Sophisticated AI"]
  },
  {
    id: "elite_matrix",
    numericId: 6,
    name: "Elite Matrix",
    priceXAF: 50000,
    hasDiscount: true,
    discountPercent: 5,
    priceDiscountedXAF: 47500,
    dailyEarnXAF: 16666,
    monthlyEarnXAF: 500000,
    roiDays: 4,
    rarity: "epic",
    description: "Golden elite-class AI matrix with supreme processing power.",
    features: ["Elite Class AI", "Golden Matrix Core", "Supreme Processing", "Maximum Revenue", "Professional Grade"]
  },
  {
    id: "omega_core",
    numericId: 7,
    name: "Omega Core",
    priceXAF: 100000,
    hasDiscount: true,
    discountPercent: 5,
    priceDiscountedXAF: 95000,
    dailyEarnXAF: 33333,
    monthlyEarnXAF: 1000000,
    roiDays: 4,
    rarity: "legendary",
    description: "Cosmic silver omega-class AI core with unlimited potential.",
    features: ["Omega Class AI", "Cosmic Silver Core", "Unlimited Potential", "Revolutionary Tech", "Coming Soon"]
  },
  {
    id: "genesis_machine",
    numericId: 8,
    name: "Genesis Machine",
    priceXAF: 150000,
    hasDiscount: true,
    discountPercent: 5,
    priceDiscountedXAF: 142500,
    dailyEarnXAF: 50000,
    monthlyEarnXAF: 1500000,
    roiDays: 3,
    rarity: "legendary",
    description: "Divine white and gold genesis-class AI machine. The ultimate AI earning system.",
    features: ["Genesis Class AI", "Divine Gold Core", "Godlike Processing", "Ultimate System", "Future Technology"]
  }
]

const COUNTRIES: CountryInfo[] = [
  { id: 1, code: "CM", name: "Cameroon", dialCode: "237", currency: "XAF", currencySymbol: "XAF", flag: "🇨🇲", usdExchangeRate: 573.9 },
  { id: 2, code: "US", name: "United States", dialCode: "1", currency: "USD", currencySymbol: "$", flag: "🇺🇸", usdExchangeRate: 1 },
  { id: 3, code: "NG", name: "Nigeria", dialCode: "234", currency: "NGN", currencySymbol: "₦", flag: "🇳🇬", usdExchangeRate: 1500 },
  { id: 4, code: "KE", name: "Kenya", dialCode: "254", currency: "KES", currencySymbol: "KSh", flag: "🇰🇪", usdExchangeRate: 145 },
  { id: 5, code: "GH", name: "Ghana", dialCode: "233", currency: "GHS", currencySymbol: "GH₵", flag: "🇬🇭", usdExchangeRate: 12 },
  { id: 6, code: "ZA", name: "South Africa", dialCode: "27", currency: "ZAR", currencySymbol: "R", flag: "🇿🇦", usdExchangeRate: 18 },
  { id: 7, code: "GB", name: "United Kingdom", dialCode: "44", currency: "GBP", currencySymbol: "£", flag: "🇬🇧", usdExchangeRate: 0.78 },
  { id: 8, code: "DE", name: "Germany", dialCode: "49", currency: "EUR", currencySymbol: "€", flag: "🇩🇪", usdExchangeRate: 0.92 },
  { id: 9, code: "FR", name: "France", dialCode: "33", currency: "EUR", currencySymbol: "€", flag: "🇫🇷", usdExchangeRate: 0.92 },
  { id: 10, code: "SN", name: "Senegal", dialCode: "221", currency: "XOF", currencySymbol: "XOF", flag: "🇸🇳", usdExchangeRate: 573.9 },
  { id: 11, code: "CI", name: "Côte d'Ivoire", dialCode: "225", currency: "XOF", currencySymbol: "XOF", flag: "🇨🇮", usdExchangeRate: 573.9 },
  { id: 12, code: "MA", name: "Morocco", dialCode: "212", currency: "MAD", currencySymbol: "MAD", flag: "🇲🇦", usdExchangeRate: 10 },
  { id: 13, code: "EG", name: "Egypt", dialCode: "20", currency: "EGP", currencySymbol: "E£", flag: "🇪🇬", usdExchangeRate: 30 },
  { id: 14, code: "TZ", name: "Tanzania", dialCode: "255", currency: "TZS", currencySymbol: "TSh", flag: "🇹🇿", usdExchangeRate: 2500 },
  { id: 15, code: "UG", name: "Uganda", dialCode: "256", currency: "UGX", currencySymbol: "USh", flag: "🇺🇬", usdExchangeRate: 3700 },
  { id: 16, code: "RW", name: "Rwanda", dialCode: "250", currency: "RWF", currencySymbol: "FRw", flag: "🇷🇼", usdExchangeRate: 1300 },
  { id: 17, code: "CD", name: "DR Congo", dialCode: "243", currency: "CDF", currencySymbol: "FC", flag: "🇨🇩", usdExchangeRate: 2700 },
  { id: 18, code: "MG", name: "Madagascar", dialCode: "261", currency: "MGA", currencySymbol: "Ar", flag: "🇲🇬", usdExchangeRate: 4500 },
  { id: 19, code: "BR", name: "Brazil", dialCode: "55", currency: "BRL", currencySymbol: "R$", flag: "🇧🇷", usdExchangeRate: 5 },
  { id: 20, code: "IN", name: "India", dialCode: "91", currency: "INR", currencySymbol: "₹", flag: "🇮🇳", usdExchangeRate: 83 },
  { id: 21, code: "CN", name: "China", dialCode: "86", currency: "CNY", currencySymbol: "¥", flag: "🇨🇳", usdExchangeRate: 7.2 }
]

export function convertFromXAF(xafAmount: number, targetCurrency: string): number {
  const targetRate = EXCHANGE_RATES[targetCurrency as CurrencyCode]
  if (!targetRate) return xafAmount

  const usdAmount = xafAmount / XAF_USD_RATE
  const converted = usdAmount * targetRate
  return Math.round(converted * 100) / 100
}

export function convertToXAF(amount: number, sourceCurrency: string): number {
  const sourceRate = EXCHANGE_RATES[sourceCurrency as CurrencyCode]
  if (!sourceRate) return amount

  const usdAmount = amount / sourceRate
  return Math.round(usdAmount * XAF_USD_RATE * 100) / 100
}

export function getMachineById(machineId: string | number) {
  return MACHINES_DATA.find((machine) => machine.id === String(machineId) || machine.numericId === Number(machineId))
}

export function getMachinePrice(
  machineId: string | number,
  targetCurrency: string
): { price: number; originalPrice: number | null; hasDiscount: boolean } {
  const machine = getMachineById(machineId)
  if (!machine) return { price: 0, originalPrice: null, hasDiscount: false }

  const effectivePrice = machine.hasDiscount ? machine.priceDiscountedXAF : machine.priceXAF
  const price = convertFromXAF(effectivePrice, targetCurrency)

  if (machine.hasDiscount) {
    const originalPrice = convertFromXAF(machine.priceXAF, targetCurrency)
    return { price, originalPrice, hasDiscount: true }
  }

  return { price, originalPrice: null, hasDiscount: false }
}

export function getMachineDailyEarn(machineId: string | number, targetCurrency: string): number {
  const machine = getMachineById(machineId)
  if (!machine) return 0
  return convertFromXAF(machine.dailyEarnXAF, targetCurrency)
}

export function getMachineMonthlyEarn(machineId: string | number, targetCurrency: string): number {
  const machine = getMachineById(machineId)
  if (!machine) return 0
  return convertFromXAF(machine.monthlyEarnXAF, targetCurrency)
}

export function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency as CurrencyCode] || currency
  const normalized = Number.isFinite(amount) ? amount : 0
  const formatted = normalized.toLocaleString(undefined, {
    minimumFractionDigits: currency === "USD" || currency === "EUR" || currency === "GBP" ? 2 : 0,
    maximumFractionDigits: 2
  })

  if (["XAF", "XOF", "MAD", "TZS", "UGX", "RWF", "CDF", "MGA"].includes(currency)) {
    return `${formatted} ${symbol}`
  }

  return `${symbol}${formatted}`
}

export function getSupportedCountries() {
  return COUNTRIES
}

export function getCountryByCode(code?: string | null) {
  if (!code) return null
  return COUNTRIES.find((country) => country.code.toLowerCase() === code.toLowerCase()) || null
}

export function getCountryByName(name?: string | null) {
  if (!name) return null
  return COUNTRIES.find((country) => country.name.toLowerCase() === name.toLowerCase()) || null
}

export function normalizeCountry(input: unknown): CountryInfo {
  if (typeof input === "object" && input !== null) {
    const country = input as Partial<CountryInfo>
    const byCode = getCountryByCode(country.code)
    if (byCode) return byCode
    const currency = country.currency ? EXCHANGE_RATES[country.currency as CurrencyCode] : null
    if (country.name && country.code && country.currency && currency) {
      return {
        id: country.id || 0,
        code: country.code,
        name: country.name,
        dialCode: country.dialCode || "",
        flag: country.flag || "",
        currency: country.currency,
        currencySymbol: country.currencySymbol || CURRENCY_SYMBOLS[country.currency] || country.currency,
        usdExchangeRate: country.usdExchangeRate || currency
      }
    }
  }

  if (typeof input === "string") {
    return getCountryByCode(input) || getCountryByName(input) || createCustomCountry(input)
  }

  return COUNTRIES[0]
}

export function getPreferredLanguageForCountry(countryCode: string) {
  const code = countryCode.toUpperCase()

  if (["CM", "SN", "CI", "FR", "CD", "MG", "RW"].includes(code)) return "fr"
  if (["MA", "EG"].includes(code)) return "ar"
  if (code === "BR") return "pt"
  if (code === "IN") return "hi"
  if (code === "CN") return "zh"

  return "en"
}

export function getAvailablePaymentMethods(country: CountryInfo) {
  const methods = [
    {
      id: "futurapay",
      name: "Futurapay",
      description: "Cards, crypto, PayPal, Stripe, and international mobile money",
      available: true
    }
  ]

  if (country.code === "CM" || country.currency === "XAF") {
    return [
      {
        id: "fapshi",
        name: "Fapshi",
        description: "Cameroon MTN Mobile Money and Orange Money",
        available: true
      },
      ...methods
    ]
  }

  return methods
}
