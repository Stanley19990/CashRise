export const locales = ["en", "fr"] as const
export type AppLocale = (typeof locales)[number]
export const defaultLocale: AppLocale = "en"

export function isAppLocale(locale: string | null | undefined): locale is AppLocale {
  return Boolean(locale && locales.includes(locale as AppLocale))
}
