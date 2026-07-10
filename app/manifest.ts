import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CashRise",
    short_name: "CashRise",
    description: "CashRise AI investment platform",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0f0f1a",
    theme_color: "#0f0f1a",
    icons: [
      {
        src: "/cashrise-logo.svg",
        sizes: "any",
        type: "image/svg+xml"
      },
      {
        src: "/cashrise-logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  }
}
