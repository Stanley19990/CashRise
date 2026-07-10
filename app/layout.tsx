import type React from "react"
import type { Metadata } from "next"
import type { Viewport } from "next"
import "./globals.css"
import { AuthProvider } from "@/hooks/use-auth"
import { LanguageProvider } from "@/components/language-provider"
import { ServiceWorkerRegister } from "@/components/service-worker-register"
import { CurrencyProvider } from "@/contexts/CurrencyContext"

export const metadata: Metadata = {
  title: "CashRise - World's First AI Investment Platform",
  description: "Invest in AI-powered earning machines, watch ads, and grow your earnings with CashRise.",
  generator: "v0.dev",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/cashrise-logo.svg",
    shortcut: "/cashrise-logo.svg",
    apple: "/cashrise-logo.svg"
  },
  appleWebApp: {
    capable: true,
    title: "CashRise",
    statusBarStyle: "black-translucent"
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0f0f1a"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased cr-theme" suppressHydrationWarning>
        <LanguageProvider>
          <AuthProvider>
            <CurrencyProvider>
              <ServiceWorkerRegister />
              {children}
            </CurrencyProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
