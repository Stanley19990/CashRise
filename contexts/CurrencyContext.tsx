"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import {
  CountryInfo,
  CurrencyCode,
  MACHINES_DATA,
  convertFromXAF,
  formatCurrency,
  getAvailablePaymentMethods,
  getMachineDailyEarn,
  getMachineMonthlyEarn,
  getMachinePrice,
  getPreferredLanguageForCountry,
  normalizeCountry
} from "@/lib/currency"
import { supabase } from "@/lib/supabase"
import { safeStorageGet, safeStorageSet } from "@/lib/safe-data"

type CurrencyContextValue = {
  country: CountryInfo
  currency: CurrencyCode
  symbol: string
  loading: boolean
  setCountry: (country: CountryInfo | string) => Promise<void>
  refreshCurrency: () => Promise<void>
  convertXAF: (amount: number) => number
  formatMoney: (amountXAF: number) => string
  getMachinePrice: typeof getMachinePrice
  getMachineDailyEarn: typeof getMachineDailyEarn
  getMachineMonthlyEarn: typeof getMachineMonthlyEarn
  getMachines: () => Array<
    (typeof MACHINES_DATA)[number] & {
      price: number
      originalPrice: number | null
      dailyEarn: number
      monthlyEarn: number
      formattedPrice: string
      formattedOriginalPrice: string | null
      formattedDailyEarn: string
      formattedMonthlyEarn: string
    }
  >
  paymentMethods: ReturnType<typeof getAvailablePaymentMethods>
}

const defaultCountry = normalizeCountry("CM")
const CurrencyContext = createContext<CurrencyContextValue | null>(null)

const COUNTRY_STORAGE_KEY = "cashrise_country"

const detectBrowserCountry = () => {
  if (typeof navigator === "undefined") return defaultCountry

  const locale = navigator.languages?.[0] || navigator.language || ""
  const region = locale.match(/-([A-Z]{2})\b/i)?.[1]
  return region ? normalizeCountry(region.toUpperCase()) : defaultCountry
}

const readStoredCountry = () => {
  if (typeof window === "undefined") return null

  const stored = safeStorageGet(window.localStorage, COUNTRY_STORAGE_KEY)
  if (!stored) return null

  try {
    return normalizeCountry(JSON.parse(stored))
  } catch {
    return normalizeCountry(stored)
  }
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [country, setCountry] = useState<CountryInfo>(defaultCountry)
  const [loading, setLoading] = useState(true)

  const applyCountry = useCallback(
    async (nextCountryInput: CountryInfo | string) => {
      const nextCountry = normalizeCountry(nextCountryInput)
      setCountry(nextCountry)

      if (typeof window !== "undefined") {
        safeStorageSet(window.localStorage, COUNTRY_STORAGE_KEY, JSON.stringify(nextCountry))
      }

      if (user) {
        const { error } = await supabase
          .from("users")
          .update({
            country: nextCountry,
            preferredLanguage: getPreferredLanguageForCountry(nextCountry.code),
            lastCurrencyUpdate: new Date().toISOString()
          })
          .eq("id", user.id)

        if (error) {
          console.error("Country profile update error:", error)
        }
      }
    },
    [user]
  )

  const refreshCurrency = useCallback(async () => {
    if (!user) {
      setCountry(readStoredCountry() || detectBrowserCountry())
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("users")
        .select("country")
        .eq("id", user.id)
        .maybeSingle()

      if (error) throw error
      setCountry(normalizeCountry(data?.country || user.user_metadata?.country || readStoredCountry() || detectBrowserCountry()))
    } catch (error) {
      console.error("Currency profile load error:", error)
      setCountry(normalizeCountry(user.user_metadata?.country || readStoredCountry() || detectBrowserCountry()))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refreshCurrency()
  }, [refreshCurrency])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`currency-profile-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          setCountry(normalizeCountry((payload.new as { country?: unknown })?.country))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const value = useMemo<CurrencyContextValue>(() => {
    const currency = country.currency
    const formatMoney = (amountXAF: number) => formatCurrency(convertFromXAF(amountXAF, currency), currency)

    return {
      country,
      currency,
      symbol: country.currencySymbol,
      loading,
      setCountry: applyCountry,
      refreshCurrency,
      convertXAF: (amount: number) => convertFromXAF(amount, currency),
      formatMoney,
      getMachinePrice: (machineId, targetCurrency = currency) => getMachinePrice(machineId, targetCurrency),
      getMachineDailyEarn: (machineId, targetCurrency = currency) => getMachineDailyEarn(machineId, targetCurrency),
      getMachineMonthlyEarn: (machineId, targetCurrency = currency) => getMachineMonthlyEarn(machineId, targetCurrency),
      getMachines: () =>
        MACHINES_DATA.map((machine) => {
          const priceInfo = getMachinePrice(machine.id, currency)
          const dailyEarn = getMachineDailyEarn(machine.id, currency)
          const monthlyEarn = getMachineMonthlyEarn(machine.id, currency)

          return {
            ...machine,
            price: priceInfo.price,
            originalPrice: priceInfo.originalPrice,
            dailyEarn,
            monthlyEarn,
            formattedPrice: formatCurrency(priceInfo.price, currency),
            formattedOriginalPrice:
              priceInfo.originalPrice === null ? null : formatCurrency(priceInfo.originalPrice, currency),
            formattedDailyEarn: formatCurrency(dailyEarn, currency),
            formattedMonthlyEarn: formatCurrency(monthlyEarn, currency)
          }
        }),
      paymentMethods: getAvailablePaymentMethods(country)
    }
  }, [country, loading, applyCountry, refreshCurrency])

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error("useCurrency must be used within CurrencyProvider")
  }
  return context
}
