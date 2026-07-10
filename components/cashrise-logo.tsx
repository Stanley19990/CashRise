import * as React from "react"

interface CashRiseLogoProps {
  className?: string
  size?: number
  withText?: boolean
}

export function CashRiseLogo({ className = "", size = 36, withText = true }: CashRiseLogoProps) {
  const id = React.useId().replace(/:/g, "")
  const shellId = `cr-shell-${id}`
  const faceId = `cr-face-${id}`
  const shineId = `cr-shine-${id}`
  const shadowId = `cr-shadow-${id}`

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={shellId} x1="7" y1="5" x2="57" y2="59" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#37C7FF" />
            <stop offset="48%" stopColor="#16D9B6" />
            <stop offset="100%" stopColor="#FFB454" />
          </linearGradient>
          <linearGradient id={faceId} x1="14" y1="10" x2="50" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E9FBFF" stopOpacity="0.96" />
            <stop offset="58%" stopColor="#12243A" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#07121F" stopOpacity="0.98" />
          </linearGradient>
          <radialGradient
            id={shineId}
            cx="0"
            cy="0"
            r="1"
            gradientTransform="matrix(26 34 -34 26 20 13)"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <filter id={shadowId} x="-12" y="-10" width="88" height="88" colorInterpolationFilters="sRGB">
            <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#16D9B6" floodOpacity="0.22" />
          </filter>
        </defs>
        <rect x="5" y="5" width="54" height="54" rx="18" fill={`url(#${shellId})`} filter={`url(#${shadowId})`} />
        <rect x="10" y="10" width="44" height="44" rx="15" fill={`url(#${faceId})`} />
        <rect x="10" y="10" width="44" height="44" rx="15" fill={`url(#${shineId})`} />
        <path
          d="M17 40.5L27 30.5L35 37.5L48 23"
          stroke="#F8FAFC"
          strokeWidth="4.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M18 46H48" stroke="#37C7FF" strokeWidth="3.25" strokeLinecap="round" opacity="0.9" />
        <path
          d="M42.5 23H48V28.5"
          stroke="#FFB454"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="22" cy="21" r="3.5" fill="#16D9B6" />
        <circle cx="31" cy="18" r="2.25" fill="#37C7FF" opacity="0.9" />
      </svg>
      {withText && (
        <div className="leading-none">
          <div className="cr-title text-xl tracking-wide text-white">CashRise</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Invest | Play | Earn</div>
        </div>
      )}
    </div>
  )
}
