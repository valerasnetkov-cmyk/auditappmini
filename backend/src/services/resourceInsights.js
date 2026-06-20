import { getLimitRiskLevel, isOlderThan } from './resourceCompanies.js'

const number = (value) => Number(value || 0)

export function getBillingSummary(companies, plans = []) {
  const activeCompanies = companies.filter((company) => company.status !== 'inactive')
  const monthlyRevenueRub = activeCompanies.reduce(
    (sum, company) => sum + number(company.billing?.monthlyRevenueRub),
    0,
  )
  const paidCompanies = activeCompanies.filter(
    (company) => number(company.billing?.monthlyRevenueRub) > 0,
  ).length
  const recommendedPlan = [...plans]
    .filter((plan) => plan.status !== 'archived' && number(plan.monthlyPriceRub) > 0)
    .sort((a, b) => number(a.monthlyPriceRub) - number(b.monthlyPriceRub))[0]
  const activeFreeCompanies = activeCompanies.filter(
    (company) => !number(company.billing?.monthlyRevenueRub) && number(company.inspections30d) > 0,
  ).length

  return {
    currency: 'RUB',
    monthlyRevenueRub,
    annualRevenueRub: monthlyRevenueRub * 12,
    paidCompanies,
    freeCompanies: activeCompanies.length - paidCompanies,
    trialCompanies: activeCompanies.length - paidCompanies,
    activeFreeCompanies,
    potentialMrr: activeFreeCompanies * number(recommendedPlan?.monthlyPriceRub),
    recommendedPlanCode: recommendedPlan?.code || null,
    trialToPaidConversionRate: activeCompanies.length
      ? Math.round((paidCompanies / activeCompanies.length) * 100)
      : null,
    averageRevenuePerActiveCompanyRub: activeCompanies.length
      ? Math.round(monthlyRevenueRub / activeCompanies.length)
      : 0,
  }
}

export function buildLimitUsage(companies) {
  const usage = companies.map((company) => ({
    companyId: company.id,
    companyName: company.name,
    planCode: company.limits?.planCode || null,
    vehiclesUsed: company.usage?.vehicles || 0,
    vehiclesLimit: company.vehiclesLimit,
    vehiclesUsagePercent: company.vehiclesUsagePercent,
    usersUsed: company.users || 0,
    usersLimit: company.usersLimit,
    usersUsagePercent: company.usersUsagePercent,
    ocrEnabled: Boolean(company.limits?.ocrEnabled),
    accidentModuleEnabled: Boolean(company.limits?.accidentModuleEnabled),
    analyticsEnabled: Boolean(company.limits?.analyticsEnabled),
    pdfReportEnabled: Boolean(company.limits?.pdfReportEnabled),
    apiAccessEnabled: Boolean(company.limits?.apiAccessEnabled),
    riskLevel: getLimitRiskLevel(company.vehiclesUsagePercent, company.usersUsagePercent),
  }))

  return {
    companiesNearVehicleLimit: usage.filter((company) => (company.vehiclesUsagePercent || 0) >= 80).length,
    companiesNearUserLimit: usage.filter((company) => (company.usersUsagePercent || 0) >= 80).length,
    disabledModules: {
      ocr: usage.filter((company) => !company.ocrEnabled).length,
      accidentModule: usage.filter((company) => !company.accidentModuleEnabled).length,
      analytics: usage.filter((company) => !company.analyticsEnabled).length,
      pdfReport: usage.filter((company) => !company.pdfReportEnabled).length,
      apiAccess: usage.filter((company) => !company.apiAccessEnabled).length,
    },
    usage,
  }
}

export function buildRiskCenter(companies, plans, now = new Date()) {
  const paidPlans = plans
    .filter((plan) => plan.status !== 'archived' && number(plan.monthlyPriceRub) > 0)
    .sort((a, b) => number(a.monthlyPriceRub) - number(b.monthlyPriceRub))
  const fallbackPaidPlan = paidPlans[0] || null

  const churn = companies
    .filter((company) => company.status !== 'inactive' && isOlderThan(company.lastActivityAt, 14, now))
    .map((company) => ({
      companyId: company.id,
      companyName: company.name,
      planCode: company.limits?.planCode || null,
      lastActivityAt: company.lastActivityAt,
      inspections30d: company.inspections30d || 0,
      previousInspections30d: company.previousInspections30d || 0,
      activityDropPercent: company.activityDropPercent,
      riskLevel: company.lastActivityAt ? 'medium' : 'high',
      reasons: company.lastActivityAt ? ['Нет осмотров больше 14 дней'] : ['Не было осмотров'],
      recommendedAction: 'Связаться с владельцем компании и проверить запуск',
    }))

  const upsell = companies
    .filter((company) => {
      const nearLimit = (company.vehiclesUsagePercent || 0) >= 70 || (company.usersUsagePercent || 0) >= 70
      const activeUsage = (company.inspections30d || 0) >= 30 || (company.usage?.accidents || 0) > 0
      const freeActive = !number(company.billing?.monthlyRevenueRub) && (company.inspections30d || 0) > 0
      return company.status !== 'inactive' && (nearLimit || freeActive || activeUsage)
    })
    .map((company) => {
      const currentPrice = number(company.billing?.monthlyPriceRub)
      const recommendedPlan = paidPlans.find((plan) => number(plan.monthlyPriceRub) > currentPrice) || fallbackPaidPlan
      return {
        companyId: company.id,
        companyName: company.name,
        currentPlanCode: company.limits?.planCode || null,
        recommendedPlanCode: recommendedPlan?.code || null,
        reason: (company.vehiclesUsagePercent || 0) >= 80 || (company.usersUsagePercent || 0) >= 80
          ? 'Использование лимитов выше 80%'
          : 'Активная компания без платного MRR',
        potentialMrr: Math.max(0, number(recommendedPlan?.monthlyPriceRub) - currentPrice),
        vehiclesUsagePercent: company.vehiclesUsagePercent,
        usersUsagePercent: company.usersUsagePercent,
        inspections30d: company.inspections30d || 0,
      }
    })

  return {
    churnRiskCompanies: churn.length,
    upsellCandidates: upsell.length,
    churn,
    upsell,
  }
}
