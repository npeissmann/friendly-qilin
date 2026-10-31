import { Annotation } from '@langchain/langgraph';
import { DEFAULT_GEMINI_MODEL, LangChainToolCallTrace } from '../types.js';

export type CommitteeAgentRole =
  | 'supervisor'
  | 'policy_researcher'
  | 'risk_analyst'
  | 'compliance_critic'
  | 'final_synthesizer';

export type NextCommitteeNode =
  | 'policy_researcher'
  | 'risk_analyst'
  | 'compliance_critic'
  | 'final_synthesizer';

export interface ComplianceAuditResult {
  approved: boolean;
  complianceScore: number;
  feedback: string;
  missingRequirements: string[];
  targetAgentForRevision?: 'policy_researcher' | 'risk_analyst';
}

export interface AgentStepTrace {
  stepOrder: number;
  agent: CommitteeAgentRole;
  decisionOrSummary: string;
  toolCalls: LangChainToolCallTrace[];
  durationMs: number;
}

/**
 * Shared LangGraph State Annotation for the Multi-Agent Credit & Risk Committee.
 */
export const CreditCommitteeState = Annotation.Root({
  userPrompt: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  modelName: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => DEFAULT_GEMINI_MODEL,
  }),
  temperature: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0.2,
  }),
  maxRevisions: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 1,
  }),
  nextAgent: Annotation<NextCommitteeNode>({
    reducer: (_prev, next) => next,
    default: () => 'risk_analyst',
  }),
  policyFindings: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  riskAnalysis: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  complianceAudit: Annotation<ComplianceAuditResult | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  revisionCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  finalDecision: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  agentTrace: Annotation<AgentStepTrace[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

export type CreditCommitteeStateType = typeof CreditCommitteeState.State;
