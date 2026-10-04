// 5-year earnings simulator. Expected monthly earnings for three paths a family is
// usually weighing after school. Every assumption is listed so the UI can show it.
import { getDistrict } from '../data/districts.js'
import { getTrade } from '../data/trades.js'
import { bestProvider } from '../data/outcomes.js'

export const PATH_KEYS = ['trade', 'degree', 'now']

export const ASSUMPTIONS = {
  tradeGrowth: 0.09,
  degreeGrowth: 0.08,
  unskilledGrowth: 0.04,
  unskilledStart: 8500,
  unskilledRegularity: 0.75, // casual work is available roughly 3 weeks in 4
  gradStart: 12000,
  gradEmployment: 0.62,
  interFee: 9000,
  degreeFee: 15000,
}

export function simulate({ tradeId, districtId, edu = 'class10', apprenticeship = true, years = 5 }) {
  const trade = getTrade(tradeId)
  const district = getDistrict(districtId)
  const prov = bestProvider(district.id, trade.id)
  const A = ASSUMPTIONS
  const n = years * 12

  const unskilled = (m) => A.unskilledStart * A.unskilledRegularity * district.wage * Math.pow(1 + A.unskilledGrowth, Math.floor(m / 12))

  // Path 1: trade
  const tradeStart = (prov.earnLow + prov.earnHigh) / 2
  const p = prov.placement / 100
  const stipendStep = trade.staircase.find((s) => s.stipend)
  const useApp = apprenticeship && !!stipendStep
  const trade_ = []
  for (let m = 0; m < n; m++) {
    if (m < trade.months) {
      trade_.push(-(prov.fee / 12))
    } else if (useApp && m < trade.months + 12) {
      trade_.push(prov.stipend)
    } else {
      const startM = trade.months + (useApp ? 12 : 0)
      const yrs = Math.floor((m - startM) / 12)
      const pay = tradeStart * (useApp ? 1.08 : 1) * Math.pow(1 + A.tradeGrowth, yrs)
      trade_.push(p * pay + (1 - p) * unskilled(m))
    }
  }

  // Path 2: general degree first (Inter first if only Class 10)
  const studyYears = edu === 'class12' ? 3 : 5
  const degree_ = []
  for (let m = 0; m < n; m++) {
    if (m < studyYears * 12) {
      const fee = edu !== 'class12' && m < 24 ? A.interFee : A.degreeFee
      degree_.push(-(fee / 12))
    } else {
      const yrs = Math.floor((m - studyYears * 12) / 12)
      const pay = A.gradStart * district.wage * Math.pow(1 + A.degreeGrowth, yrs)
      degree_.push(A.gradEmployment * pay + (1 - A.gradEmployment) * unskilled(m))
    }
  }

  // Path 3: start unskilled work now
  const now_ = Array.from({ length: n }, (_, m) => unskilled(m))

  const sum = (arr) => arr.reduce((a, b) => a + b, 0)
  const cumulative = (arr) => arr.reduce((acc, v) => (acc.push((acc.at(-1) ?? 0) + v), acc), [])
  const round100 = (x) => Math.round(x / 100) * 100

  return {
    trade,
    district,
    provider: prov,
    usedApprenticeship: useApp,
    studyYears,
    months: n,
    monthly: { trade: trade_, degree: degree_, now: now_ },
    cumulative: { trade: cumulative(trade_), degree: cumulative(degree_), now: cumulative(now_) },
    totals: {
      trade: round100(sum(trade_)),
      degree: round100(sum(degree_)),
      now: round100(sum(now_)),
    },
    finalMonthly: {
      trade: round100(trade_.at(-1)),
      degree: round100(degree_.at(-1)),
      now: round100(now_.at(-1)),
    },
  }
}
