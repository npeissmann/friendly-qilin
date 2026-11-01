import { z } from 'zod';
import { CreditCommitteeStateType } from './state.js';

export const RISK_ANALYST_SYSTEM_PROMPT =
  'You are the Financial & Risk Analyst Agent on the Credit & Collections Committee.\n' +
  'Your strict responsibilities:\n' +
  '1. Call `lookup_customer_profile` if any customer ID (e.g., CUST-001, CUST-002, CUST-003, CUST-004) or customer name is mentioned.\n' +
  '2. Call `calculate_credit_and_collections_metrics` using the exact numbers from the customer profile or user request so all financial ratios (DTI, DSCR, ESG discount, effective interest rate, monthly installment, Open Finance requirement, Approval Workflow Level, and Delinquency Penalty Interest) are deterministically calculated.\n' +
  '3. Report a structured quantitative summary of the customer profile and all calculated metrics.';

export const POLICY_RESEARCHER_SYSTEM_PROMPT =
  'You are the Policy Researcher Agent on the Credit & Collections Committee.\n' +
  'Your strict responsibilities:\n' +
  '1. Use `query_rag_knowledge_base` to search the vector database for the exact 2026 (or 2025) Credit Concession Policy and/or 2026 Collections Recovery Policy rules relevant to the customer case.\n' +
  '2. Specifically verify underwriting thresholds (Score, DTI, DSCR, Open Finance consent limits), ESG discounts & Exclusion List (Zero Credit Policy), Approval Workflow Levels (Level 1 STP, Level 2 Hybrid, Level 3 Committee & SLAs), or Collections DPD stages, Compassionate Restructuring criteria, and Agent Contact Compliance rules.\n' +
  '3. Always cite the source filename (e.g., `credit_concession_policy_2026.md` or `collections_recovery_policy_2026.md`) and section rules.';

export const ComplianceAuditSchema = z.object({
  approved: z
    .boolean()
    .describe('True if both quantitative metrics and policy citations are complete and accurate.'),
  complianceScore: z
    .number()
    .min(0)
    .max(100)
    .describe('Compliance quality score from 0 to 100.'),
  feedback: z
    .string()
    .describe('Concise audit explanation of why the analysis passed or what must be corrected.'),
  missingRequirements: z
    .array(z.string())
    .describe('List of any missing policy checks, calculations, or document citations.'),
  targetAgentForRevision: z
    .enum(['policy_researcher', 'risk_analyst'])
    .optional()
    .describe('If approved is false, which specialist agent should run next to fix the gaps.'),
});

export function formatRevisionFeedback(state: CreditCommitteeStateType): string {
  if (!state.complianceAudit || state.complianceAudit.approved) {
    return '';
  }

  return (
    `\n\nIMPORTANT REVISION REQUEST FROM COMPLIANCE CRITIC:\n` +
    `${state.complianceAudit.feedback}\n` +
    `Missing items: ${state.complianceAudit.missingRequirements.join(', ')}`
  );
}

export function buildComplianceAuditPrompt(state: CreditCommitteeStateType): string {
  return (
    `You are the Chief Compliance & Audit Critic for the Credit & Risk Committee.\n` +
    `Review the following specialist reports for the user request:\n\n` +
    `--- USER REQUEST ---\n${state.userPrompt}\n\n` +
    `--- FINANCIAL & RISK ANALYST REPORT ---\n${state.riskAnalysis}\n\n` +
    `--- POLICY RESEARCHER REPORT (RAG) ---\n${state.policyFindings}\n\n` +
    `Audit Checklist:\n` +
    `1. Were the customer's financial metrics (or delinquency figures) accurately retrieved and calculated?\n` +
    `2. Were specific policy rules from our documents cited (or if the RAG DB is empty, was that clearly noted)?\n` +
    `3. Are critical compliance conditions identified (such as Open Finance consent requirement for Retail > $20k or SME > $100k, ESG Exclusion List Zero Credit Policy for deforestation, Approval Workflow Level & SLA, or Collections contact hours 8 AM - 8 PM & Compassionate Restructuring rules)?\n` +
    `Approve (approved = true) if the reports cover the necessary facts to render a sound decision.`
  );
}

export function buildFinalSynthesisPrompt(state: CreditCommitteeStateType): string {
  return (
    `You are the Chair of the Credit & Risk Committee.\n` +
    `Synthesize the findings from your specialized agents into a clear, well-structured **Executive Committee Decision Memo**.\n\n` +
    `Include the following sections:\n` +
    `1. **Executive Decision**: (e.g., APPROVED - Level 1 STP, CONDITIONAL APPROVAL - Level 3 Committee, REJECTED - ESG Zero Credit Policy, or APPROVED FOR COMPASSIONATE RESTRUCTURING)\n` +
    `2. **Customer & Financial Risk Summary**: Key numbers from the Financial & Risk Analyst (Score, AI-BS, DTI/DSCR, Pricing/ESG Modifier, or DPD & Penalty Interest).\n` +
    `3. **Policy & Regulatory Grounding**: Exact rules, approval workflow level, SLA, and document citations from the Policy Researcher.\n` +
    `4. **Mandatory Conditions & Compliance Sign-Off**: Any required next steps (e.g., obtaining 12-month Open Finance consent, adhering to 8 AM–8 PM contact hours, or waiving penalty interest).\n\n` +
    `--- USER INQUIRY ---\n${state.userPrompt}\n\n` +
    `--- FINANCIAL & RISK ANALYST REPORT ---\n${state.riskAnalysis}\n\n` +
    `--- POLICY RESEARCHER REPORT ---\n${state.policyFindings}\n\n` +
    `--- COMPLIANCE CRITIC AUDIT ---\n${JSON.stringify(state.complianceAudit)}`
  );
}
