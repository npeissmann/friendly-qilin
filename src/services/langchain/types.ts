export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';

export interface LangChainToolCallTrace {
  step: number;
  toolName: string;
  args: Record<string, any>;
  result: any;
  executionTimeMs: number;
}

export interface LangChainAgentOptions {
  prompt: string;
  model?: string;
  temperature?: number;
  maxSteps?: number;
  systemInstruction?: string;
}

export interface LangChainAgentResult {
  prompt: string;
  answer: string;
  toolCalls: LangChainToolCallTrace[];
  stepsCount: number;
  metadata: {
    framework: string;
    modelUsed: string;
    totalToolCalls: number;
    durationMs: number;
  };
}

export interface CustomerProfile {
  customerId: string;
  name: string;
  segment: 'Retail' | 'SME' | 'Corporate';
  traditionalCreditScore: number;
  aiBehavioralScorePercentile: number; // e.g., 15 means top 15th percentile
  aiBsTier: 'Tier 1 (Low Risk)' | 'Tier 2 (Moderate Risk)' | 'Tier 3 (Elevated Risk)';
  monthlyGrossIncome?: number;
  existingMonthlyDebtPayment?: number;
  annualRevenue?: number;
  dscr?: number; // Debt Service Coverage Ratio for SMEs
  openFinanceConsent: boolean;
  esgProfile: {
    projectType: string;
    isElectricVehicle?: boolean;
    yoyCarbonReductionPercent?: number;
    exclusionFlags: string[];
  };
  requestedCredit?: {
    product: string;
    amount: number;
    termMonths: number;
  };
  collectionsStatus?: {
    hasActiveDelinquency: boolean;
    daysPastDue: number;
    overduePrincipalAmount: number;
    verifiedHardshipEvent: string | null;
    missedPaymentsInPrior6Months: number;
    preferredContactChannel: string;
  };
}

export interface PredefinedScenario {
  scenarioId: string;
  customerId: string;
  title: string;
  suggestedPrompt: string;
}
