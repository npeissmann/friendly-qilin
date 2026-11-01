import { CustomerProfile, PredefinedScenario } from '../types.js';

export const MOCK_CUSTOMERS: Record<string, CustomerProfile> = {
  'CUST-001': {
    customerId: 'CUST-001',
    name: 'Alice Silva',
    segment: 'Retail',
    traditionalCreditScore: 780,
    aiBehavioralScorePercentile: 15,
    aiBsTier: 'Tier 1 (Low Risk)',
    monthlyGrossIncome: 8000,
    existingMonthlyDebtPayment: 1200,
    openFinanceConsent: false,
    esgProfile: {
      projectType: 'Electric Vehicle Purchase (Compact EV)',
      isElectricVehicle: true,
      exclusionFlags: [],
    },
    requestedCredit: {
      product: 'Auto Finance (EV)',
      amount: 14000,
      termMonths: 48,
    },
    collectionsStatus: {
      hasActiveDelinquency: false,
      daysPastDue: 0,
      overduePrincipalAmount: 0,
      verifiedHardshipEvent: null,
      missedPaymentsInPrior6Months: 0,
      preferredContactChannel: 'Email',
    },
  },
  'CUST-002': {
    customerId: 'CUST-002',
    name: 'GreenTech Solar Ltda',
    segment: 'SME',
    traditionalCreditScore: 710,
    aiBehavioralScorePercentile: 25,
    aiBsTier: 'Tier 2 (Moderate Risk)',
    annualRevenue: 1200000,
    dscr: 1.45,
    openFinanceConsent: false, // Missing consent for >$100k SME loan
    esgProfile: {
      projectType: 'Solar Panel Manufacturing & Electric Delivery Fleet',
      yoyCarbonReductionPercent: 25,
      exclusionFlags: [],
    },
    requestedCredit: {
      product: 'Equipment Finance (ESG)',
      amount: 250000,
      termMonths: 60,
    },
    collectionsStatus: {
      hasActiveDelinquency: false,
      daysPastDue: 0,
      overduePrincipalAmount: 0,
      verifiedHardshipEvent: null,
      missedPaymentsInPrior6Months: 0,
      preferredContactChannel: 'Email',
    },
  },
  'CUST-003': {
    customerId: 'CUST-003',
    name: 'Carlos Mendes',
    segment: 'Retail',
    traditionalCreditScore: 640,
    aiBehavioralScorePercentile: 38,
    aiBsTier: 'Tier 2 (Moderate Risk)',
    monthlyGrossIncome: 4500,
    existingMonthlyDebtPayment: 950,
    openFinanceConsent: true,
    esgProfile: {
      projectType: 'N/A - Existing Personal Loan Restructuring',
      exclusionFlags: [],
    },
    collectionsStatus: {
      hasActiveDelinquency: true,
      daysPastDue: 45,
      overduePrincipalAmount: 18000,
      verifiedHardshipEvent: 'Documented involuntary job loss 30 days ago',
      missedPaymentsInPrior6Months: 0,
      preferredContactChannel: 'WhatsApp',
    },
  },
  'CUST-004': {
    customerId: 'CUST-004',
    name: 'Amazonia Timber & Extraction Corp',
    segment: 'Corporate',
    traditionalCreditScore: 740,
    aiBehavioralScorePercentile: 30,
    aiBsTier: 'Tier 2 (Moderate Risk)',
    annualRevenue: 25000000,
    dscr: 1.6,
    openFinanceConsent: true,
    esgProfile: {
      projectType: 'Heavy Logging Expansion',
      yoyCarbonReductionPercent: 0,
      exclusionFlags: ['Uncertified deforestation activities'],
    },
    requestedCredit: {
      product: 'Revolving Credit Facility',
      amount: 600000,
      termMonths: 36,
    },
    collectionsStatus: {
      hasActiveDelinquency: false,
      daysPastDue: 0,
      overduePrincipalAmount: 0,
      verifiedHardshipEvent: null,
      missedPaymentsInPrior6Months: 0,
      preferredContactChannel: 'Phone',
    },
  },
};

export const PREDEFINED_SCENARIOS: PredefinedScenario[] = [
  {
    scenarioId: 'SCENARIO-1-RETAIL-STP',
    customerId: 'CUST-001',
    title: 'Retail EV Auto Loan — Straight-Through Processing (Level 1)',
    suggestedPrompt:
      'Evaluate customer CUST-001 (Alice Silva) for her requested $14,000 EV Auto Loan. Check our 2026 credit concession policy, calculate her DTI and ESG rate discount, and determine the approval pathway and SLA.',
  },
  {
    scenarioId: 'SCENARIO-2-SME-OPEN-FINANCE',
    customerId: 'CUST-002',
    title: 'SME Equipment Finance — Conditional on Open Finance Consent (Level 3)',
    suggestedPrompt:
      'Assess customer CUST-002 (GreenTech Solar Ltda) requesting $250,000 in Equipment Finance. Verify SME underwriting criteria, ESG discount eligibility, Open Finance requirements, and approval workflow level.',
  },
  {
    scenarioId: 'SCENARIO-3-COLLECTIONS-HARDSHIP',
    customerId: 'CUST-003',
    title: 'Collections & Hardship Recovery — 45 DPD Restructuring',
    suggestedPrompt:
      'Customer CUST-003 (Carlos Mendes) is 45 days past due on an $18,000 balance and reported job loss. Check our 2026 Collections Recovery Policy, calculate accrued penalty interest, and determine if he qualifies for the Compassionate Restructuring Program and how agents may contact him.',
  },
  {
    scenarioId: 'SCENARIO-4-ESG-EXCLUSION',
    customerId: 'CUST-004',
    title: 'Corporate Credit Facility — ESG Exclusion List Rejection',
    suggestedPrompt:
      'Evaluate corporate loan application for CUST-004 (Amazonia Timber & Extraction Corp) requesting $600,000. Check 2026 ESG directives and underwriting rules to provide a committee recommendation.',
  },
];
