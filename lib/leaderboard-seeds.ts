export type SeededLeaderboardEntry = {
  id: string
  username: string
  total_earned: number
  machines_owned: number
  seeded: true
}

const DAILY_GROWTH_RATE = 0.03
const BASELINE_DATE_UTC = Date.UTC(2026, 6, 11)

const seededTopEarners = [
  ["AlphaKing", 14987520],
  ["DivineCash", 14823441],
  ["LuckyLion", 14602118],
  ["CashNova", 14388771],
  ["StanleyX", 14127394],
  ["WealthGuru", 13986002],
  ["CryptoAce", 13744615],
  ["GoldHunter", 13518931],
  ["ProfitWave", 13277889],
  ["SmartMoney", 13015448],
  ["VisionX", 12864093],
  ["KingProfit", 12657884],
  ["FalconOne", 12483176],
  ["RapidCash", 12265541],
  ["EliteTrader", 12041390],
  ["BrightPath", 11879264],
  ["NovaKing", 11682905],
  ["DreamWealth", 11475020],
  ["SuccessHub", 11292616],
  ["RoyalMint", 11098344],
  ["MaxReturns", 10946553],
  ["BluePhoenix", 10754981],
  ["CrownX", 10563712],
  ["FutureBoss", 10379295],
  ["SilverStorm", 10182940],
  ["SkyProfit", 9996745],
  ["MegaCash", 9845302],
  ["OceanKing", 9688175],
  ["ZenithPro", 9534899],
  ["EliteVision", 9381664],
  ["PrimeFlow", 9226317],
  ["CashMaster", 9094180],
  ["FastGrow", 8952728],
  ["MoneyPeak", 8788411],
  ["VictoryPath", 8624376],
  ["DreamBuilder", 8483109],
  ["ApexRise", 8341728],
  ["AlphaWave", 8189604],
  ["UrbanKing", 8025902],
  ["FireVision", 7889513],
  ["TitanEdge", 7756391],
  ["RoyalCash", 7622985],
  ["SwiftRise", 7495226],
  ["InfinityX", 7349611],
  ["GreenVault", 7211995],
  ["LegacyPro", 7064108],
  ["WealthCore", 6935471],
  ["CashSprint", 6803199],
  ["NovaPeak", 6679520],
  ["EagleOne", 6553842],
  ["ProVision", 6412355],
  ["BrightStar", 6278190],
  ["GoldRush", 6141478],
  ["CashPilot", 6008442],
  ["LionForce", 5894315],
  ["VictoryOne", 5771906],
  ["RisingSun", 5638709],
  ["TitanCash", 5509118],
  ["InfinityGain", 5381500],
  ["SmartVision", 5254821],
  ["FalconRise", 5128716],
  ["ZenithCash", 4998470],
  ["PrimeSuccess", 4874321],
  ["DreamCash", 4751890],
  ["OceanRise", 4639115],
  ["AlphaProfit", 4512903],
  ["FutureStar", 4403571],
  ["VictoryX", 4288334],
  ["RoyalFuture", 4174682],
  ["EagleCash", 4062518],
  ["ProfitZone", 3948174],
  ["EliteSuccess", 3842951],
  ["NovaDream", 3733486],
  ["GreenMoney", 3619200],
  ["SkyLeader", 3505441],
  ["TitanPro", 3388923],
  ["WealthRise", 3274519],
  ["KingVision", 3159716],
  ["CashRocket", 3044280],
  ["BrightFuture", 2938511],
  ["SuccessWay", 2833770],
  ["LuckyStar", 2725991],
  ["SmartLion", 2619884],
  ["GoldFuture", 2518662],
  ["AlphaDream", 2417921],
  ["OceanProfit", 2315086],
  ["VisionMaster", 2208594],
  ["LegacyCash", 2106973],
  ["SilverEdge", 2001850],
  ["DreamRise", 1914430],
  ["ProfitKing", 1829551],
  ["WealthNova", 1744388],
  ["EagleVision", 1659927],
  ["FutureRise", 1576708],
  ["TitanLeader", 1497319],
  ["CashWave", 1421880],
  ["RisingKing", 1344617],
  ["MegaVision", 1269924],
  ["VictoryBoss", 1184705],
  ["SmartPeak", 1098416]
] as const

const getElapsedGrowthDays = (now = new Date()) => {
  const elapsedMs = now.getTime() - BASELINE_DATE_UTC
  return Math.max(0, Math.floor(elapsedMs / 86_400_000))
}

export const getSeededLeaderboardEntries = (now = new Date()): SeededLeaderboardEntry[] => {
  const growthMultiplier = Math.pow(1 + DAILY_GROWTH_RATE, getElapsedGrowthDays(now))

  return seededTopEarners.map(([username, amount], index) => ({
    id: `seeded-${username.toLowerCase()}`,
    username,
    total_earned: Math.round(amount * growthMultiplier),
    machines_owned: Math.max(1, 12 - Math.floor(index / 10)),
    seeded: true
  }))
}
