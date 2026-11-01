import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// Policy Threshold Constants (2026 Credit Concession & Collections Policies)
const POLICY_THRESHOLDS = {
  MIN_TRADITIONAL_SCORE: 620,
  MAX_AI_BS_PERCENTILE: 40,
  RETAIL_MAX_DTI_PERCENT: 35,
  STP_MAX_DTI_PERCENT: 25,
  STP_MIN_SCORE: 750,
  STP_MAX_LOAN_AMOUNT: 15000,
  RETAIL_OPEN_FINANCE_LIMIT: 20000,
  SME_OPEN_FINANCE_LIMIT: 100000,
  COMMITTEE_REVIEW_LOAN_LIMIT: 100000,
  SME_MIN_DSCR: 1.25,
  SME_MIN_CARBON_REDUCTION_PERCENT: 20,
  RETAIL_EV_ESG_DISCOUNT: 0.5,
  SME_CORP_ESG_DISCOUNT: 1.0,
} as const;

const FinancialCalculatorSchema = z.object({
  segment: z.enum(['Retail', 'SME', 'Corporate']).describe('Customer segment.'),
  traditionalCreditScore: z.number().optional().describe('Traditional bureau credit score.'),
  aiBehavioralScorePercentile: z
    .number()
    .optional()
    .describe('AI-Driven Behavioral Score percentile (e.g., 15 means top 15%).'),
  monthlyGrossIncome: z
    .number()
    .optional()
    .describe('Gross monthly income in USD (for Retail DTI calculation).'),
  existingMonthlyDebtPayment: z
    .number()
    .optional()
    .describe('Existing monthly debt obligations in USD.'),
  dscr: z
    .number()
    .optional()
    .describe('Debt Service Coverage Ratio for SMEs (policy minimum is > 1.25x).'),
  loanAmount: z.number().optional().describe('Requested loan amount in USD.'),
  termMonths: z.number().optional().describe('Requested loan term in months.'),
  openFinanceConsent: z
    .boolean()
    .optional()
    .describe('Whether customer consented to 12 months of Open Finance data sharing.'),
  isElectricVehicle: z
    .boolean()
    .optional()
    .describe('True if Retail loan is for purchasing an electric vehicle (-0.5% ESG discount).'),
  yoyCarbonReductionPercent: z
    .number()
    .optional()
    .describe('Verified YoY carbon emission reduction % for SME/Corporate (-1.0% if >= 20%).'),
  hasEsgExceptions: z
    .boolean()
    .optional()
    .describe('True if the borrower has ESG risk flags or exceptions.'),
  daysPastDue: z
    .number()
    .optional()
    .describe('Days Past Due (DPD) if evaluating a delinquent collections account.'),
  overduePrincipalAmount: z
    .number()
    .optional()
    .describe('Overdue principal balance in USD for collections penalty calculation.'),
  hasVerifiedHardship: z
    .boolean()
    .optional()
    .describe('True if customer provided documented proof of hardship (job loss, medical, etc.).'),
  missedPaymentsInPrior6Months: z
    .number()
    .optional()
    .describe('Number of missed payments in the 6 months prior to the hardship event.'),
  centralBankBaseRatePercent: z
    .number()
    .optional()
    .describe('Central Bank base annual interest rate % (default: 10.5).'),
  baseSpreadPercent: z
    .number()
    .optional()
    .describe('Standard institutional spread % (default: 2.0).'),
});

type FinancialCalculatorInput = z.infer<typeof FinancialCalculatorSchema>;

function calculatePricingAndInstallment(input: FinancialCalculatorInput) {
  const baseRatePercent = input.centralBankBaseRatePercent ?? 10.5;
  const baseSpreadPercent = input.baseSpreadPercent ?? 2.0;

  let riskPremiumPercent = 1.5;
  if (input.aiBehavioralScorePercentile !== undefined) {
    if (input.aiBehavioralScorePercentile <= 20) {
      riskPremiumPercent = 0.5;
    } else if (input.aiBehavioralScorePercentile <= POLICY_THRESHOLDS.MAX_AI_BS_PERCENTILE) {
      riskPremiumPercent = 1.5;
    } else {
      riskPremiumPercent = 3.5;
    }
  }

  let esgDiscountPercent = 0;
  const esgNotes: string[] = [];

  if (input.segment === 'Retail' && input.isElectricVehicle) {
    esgDiscountPercent = POLICY_THRESHOLDS.RETAIL_EV_ESG_DISCOUNT;
    esgNotes.push('Applied -0.5% Retail Green Modifier for Electric Vehicle purchase.');
  } else if (
    (input.segment === 'SME' || input.segment === 'Corporate') &&
    (input.yoyCarbonReductionPercent ?? 0) >= POLICY_THRESHOLDS.SME_MIN_CARBON_REDUCTION_PERCENT
  ) {
    esgDiscountPercent = POLICY_THRESHOLDS.SME_CORP_ESG_DISCOUNT;
    esgNotes.push(
      `Applied -1.0% SME/Corporate Green Modifier for ${input.yoyCarbonReductionPercent}% YoY carbon reduction (>= 20% threshold).`
    );
  }

  const effectiveAnnualInterestRatePercent = Number(
    (baseRatePercent + baseSpreadPercent + riskPremiumPercent - esgDiscountPercent).toFixed(2)
  );

  const loanAmount = input.loanAmount ?? 0;
  const termMonths = input.termMonths ?? 36;
  const monthlyRate = effectiveAnnualInterestRatePercent / 100 / 12;

  let estimatedMonthlyInstallment = 0;
  if (loanAmount > 0 && termMonths > 0) {
    estimatedMonthlyInstallment =
      monthlyRate > 0
        ? (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths))
        : loanAmount / termMonths;
  }

  return {
    effectiveAnnualInterestRatePercent,
    rateBreakdown: {
      baseRatePercent,
      baseSpreadPercent,
      riskPremiumPercent,
      esgDiscountPercent,
      esgNotes,
    },
    loanAmount,
    termMonths,
    estimatedMonthlyInstallment: Number(estimatedMonthlyInstallment.toFixed(2)),
  };
}

function evaluateUnderwriting(
  input: FinancialCalculatorInput,
  estimatedMonthlyInstallment: number
) {
  const loanAmount = input.loanAmount ?? 0;
  let currentDtiPercent: number | null = null;
  let projectedDtiPercent: number | null = null;
  let dtiCompliant: boolean | null = null;

  if (input.monthlyGrossIncome && input.monthlyGrossIncome > 0) {
    const existingDebt = input.existingMonthlyDebtPayment ?? 0;
    currentDtiPercent = Number(((existingDebt / input.monthlyGrossIncome) * 100).toFixed(2));
    projectedDtiPercent = Number(
      (((existingDebt + estimatedMonthlyInstallment) / input.monthlyGrossIncome) * 100).toFixed(2)
    );
    dtiCompliant = projectedDtiPercent <= POLICY_THRESHOLDS.RETAIL_MAX_DTI_PERCENT;
  }

  const scorePasses =
    (input.traditionalCreditScore ?? 0) >= POLICY_THRESHOLDS.MIN_TRADITIONAL_SCORE ||
    (input.aiBehavioralScorePercentile !== undefined &&
      input.aiBehavioralScorePercentile <= POLICY_THRESHOLDS.MAX_AI_BS_PERCENTILE);

  const openFinanceRequired =
    (input.segment === 'Retail' && loanAmount > POLICY_THRESHOLDS.RETAIL_OPEN_FINANCE_LIMIT) ||
    (input.segment === 'SME' && loanAmount > POLICY_THRESHOLDS.SME_OPEN_FINANCE_LIMIT);

  return {
    scorePassesMinimum620OrTop40AiBs: scorePasses,
    currentDtiPercent,
    projectedDtiPercent,
    retailDtiWithin35PercentLimit: dtiCompliant,
    smeDscrValue: input.dscr ?? null,
    smeDscrPassesMinimum1_25x:
      input.dscr !== undefined ? input.dscr > POLICY_THRESHOLDS.SME_MIN_DSCR : null,
    openFinanceRequired,
    openFinanceConsentProvided: Boolean(input.openFinanceConsent),
    openFinanceCompliant: !openFinanceRequired || Boolean(input.openFinanceConsent),
  };
}

function determineApprovalWorkflowLevel(
  input: FinancialCalculatorInput,
  projectedDtiPercent: number | null
): string {
  const loanAmount = input.loanAmount ?? 0;

  if (
    input.segment === 'Corporate' ||
    loanAmount > POLICY_THRESHOLDS.COMMITTEE_REVIEW_LOAN_LIMIT ||
    Boolean(input.hasEsgExceptions)
  ) {
    return 'Level 3 - Committee Review (Manual Underwriting, SLA: 3-5 business days)';
  }

  if (
    (input.traditionalCreditScore ?? 0) > POLICY_THRESHOLDS.STP_MIN_SCORE &&
    projectedDtiPercent !== null &&
    projectedDtiPercent < POLICY_THRESHOLDS.STP_MAX_DTI_PERCENT &&
    loanAmount > 0 &&
    loanAmount < POLICY_THRESHOLDS.STP_MAX_LOAN_AMOUNT
  ) {
    return 'Level 1 - Fully Automated (Straight-Through Processing - STP, SLA: Instant approval)';
  }

  return 'Level 2 - Hybrid (AI Analysis + Junior Analyst Review, SLA: 4 hours)';
}

function calculateCollectionsStageAndPenalties(input: FinancialCalculatorInput) {
  const dpd = input.daysPastDue ?? 0;
  if (dpd <= 0) {
    return null;
  }

  const overdueBalance = input.overduePrincipalAmount ?? 0;
  // 2% flat + 1% pro-rata per month after 5-day grace period
  const standardPenalty = Number((overdueBalance * (0.02 + 0.01 * (dpd / 30))).toFixed(2));
  const penaltyInterestAmount = dpd <= 5 ? 0 : standardPenalty;

  let delinquencyStage: string;
  if (dpd <= 15) {
    delinquencyStage = 'Stage 2.1: Pre-Collections (1 to 15 DPD - Grace Period / Oversight)';
  } else if (dpd <= 60) {
    delinquencyStage = 'Stage 2.2: Soft Collections (16 to 60 DPD - Past Due)';
  } else if (dpd <= 120) {
    delinquencyStage = 'Stage 2.3: Hard Collections (61 to 120 DPD - Default Risk)';
  } else {
    delinquencyStage = 'Stage 2.4: Late Stage & Legal (121+ DPD - Non-Performing Loan / NPL)';
  }

  const compassionateRestructuringEligible =
    Boolean(input.hasVerifiedHardship) && (input.missedPaymentsInPrior6Months ?? 0) === 0;

  return {
    daysPastDue: dpd,
    delinquencyStage,
    overduePrincipalAmount: overdueBalance,
    accruedPenaltyInterest: penaltyInterestAmount,
    totalBalanceWithPenalty: Number((overdueBalance + penaltyInterestAmount).toFixed(2)),
    creditBureauReportedToSerasaSpc: dpd >= 30,
    compassionateRestructuringEligible,
    restructuringBenefitsIfEligible: compassionateRestructuringEligible
      ? [
          'Up to 90 days of payment holiday (interest deferred)',
          `100% waiver of late fees and penalty interest ($${penaltyInterestAmount} waived)`,
          'Restructuring of principal over up to 72 months at reduced Cost of Funds rate',
        ]
      : [],
  };
}

/**
 * Deterministic financial calculator for 2026 Credit Concession & Collections policies.
 */
export const financialCalculatorLangChainTool = tool(
  async (input) => {
    const pricingAndInstallment = calculatePricingAndInstallment(input);
    const underwritingChecks = evaluateUnderwriting(
      input,
      pricingAndInstallment.estimatedMonthlyInstallment
    );
    const approvalWorkflowLevel = determineApprovalWorkflowLevel(
      input,
      underwritingChecks.projectedDtiPercent
    );
    const collectionsMetrics = calculateCollectionsStageAndPenalties(input);

    return JSON.stringify({
      segment: input.segment,
      underwritingChecks,
      pricingAndInstallment,
      approvalWorkflowLevel,
      collectionsMetrics,
    });
  },
  {
    name: 'calculate_credit_and_collections_metrics',
    description:
      'Performs deterministic financial calculations for credit underwriting and debt collections: computes DTI ratio, monthly installment, ESG Green Modifier rate discounts, Open Finance compliance, Approval Workflow Level (Level 1 STP, Level 2 Hybrid, Level 3 Committee), and Delinquency Penalty Interest (2% + 1% pro-rata/month) plus Compassionate Restructuring eligibility.',
    schema: FinancialCalculatorSchema,
  }
);
