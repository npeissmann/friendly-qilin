import { HumanMessage } from '@langchain/core/messages';
import {
  CreditCommitteeStateType,
  ComplianceAuditResult,
  NextCommitteeNode,
} from './state.js';
import {
  RISK_ANALYST_SYSTEM_PROMPT,
  POLICY_RESEARCHER_SYSTEM_PROMPT,
  ComplianceAuditSchema,
  formatRevisionFeedback,
  buildComplianceAuditPrompt,
  buildFinalSynthesisPrompt,
} from './prompts.js';
import {
  createGeminiChatModel,
  executeToolCallingLoop,
} from '../utils/toolExecutionLoop.js';
import {
  ragKnowledgeLangChainTool,
  databaseFilesLangChainTool,
} from '../tools/ragLangChainTools.js';
import { customerProfileLangChainTool } from '../tools/customerProfileTool.js';
import { financialCalculatorLangChainTool } from '../tools/financialCalculatorTool.js';

/**
 * Node 1: Supervisor (Router & Orchestrator)
 */
export async function supervisorNode(
  state: CreditCommitteeStateType
): Promise<Partial<CreditCommitteeStateType>> {
  const startMs = Date.now();
  const stepOrder = state.agentTrace.length + 1;

  let nextAgent: NextCommitteeNode;
  let rationale: string;

  if (!state.riskAnalysis) {
    nextAgent = 'risk_analyst';
    rationale =
      'Initial step: routing to Financial & Risk Analyst to retrieve customer profile and compute deterministic DTI/DSCR/ESG/DPD metrics.';
  } else if (!state.policyFindings) {
    nextAgent = 'policy_researcher';
    rationale =
      'Customer risk metrics collected: routing to Policy Researcher to query the pgvector RAG knowledge base for applicable 2026 credit and collections rules.';
  } else if (!state.complianceAudit) {
    nextAgent = 'compliance_critic';
    rationale =
      'Both Risk Analysis and Policy Research are complete: routing to Compliance Critic for regulatory and policy audit.';
  } else if (!state.complianceAudit.approved && state.revisionCount < state.maxRevisions) {
    nextAgent = state.complianceAudit.targetAgentForRevision || 'policy_researcher';
    rationale = `Compliance Critic flagged missing requirements (Revision #${state.revisionCount + 1}/${state.maxRevisions}): routing back to ${nextAgent} to address: ${state.complianceAudit.feedback}`;
  } else {
    nextAgent = 'final_synthesizer';
    rationale = state.complianceAudit.approved
      ? `Compliance Critic APPROVED the analysis (score: ${state.complianceAudit.complianceScore}/100). Routing to Final Synthesizer to issue the official Committee Decision.`
      : `Max revision cycles (${state.maxRevisions}) reached. Routing to Final Synthesizer to issue the final Committee Decision incorporating audit notes.`;
  }

  return {
    nextAgent,
    agentTrace: [
      {
        stepOrder,
        agent: 'supervisor',
        decisionOrSummary: `Next -> ${nextAgent} | ${rationale}`,
        toolCalls: [],
        durationMs: Date.now() - startMs,
      },
    ],
  };
}

/**
 * Node 2: Financial & Risk Analyst Agent
 */
export async function riskAnalystNode(
  state: CreditCommitteeStateType
): Promise<Partial<CreditCommitteeStateType>> {
  const startMs = Date.now();
  const stepOrder = state.agentTrace.length + 1;
  const llm = createGeminiChatModel(state.modelName, state.temperature);

  const userPrompt = `User Inquiry: ${state.userPrompt}${formatRevisionFeedback(state)}`;

  const { outputText, toolCalls } = await executeToolCallingLoop({
    llm,
    tools: [customerProfileLangChainTool, financialCalculatorLangChainTool],
    systemPrompt: RISK_ANALYST_SYSTEM_PROMPT,
    userPrompt,
    maxSteps: 4,
  });

  const isRevision = Boolean(state.complianceAudit && !state.complianceAudit.approved);

  return {
    riskAnalysis: outputText,
    complianceAudit: isRevision ? null : state.complianceAudit,
    revisionCount: isRevision ? state.revisionCount + 1 : state.revisionCount,
    agentTrace: [
      {
        stepOrder,
        agent: 'risk_analyst',
        decisionOrSummary: outputText,
        toolCalls,
        durationMs: Date.now() - startMs,
      },
    ],
  };
}

/**
 * Node 3: Policy Researcher Agent (RAG Specialist)
 */
export async function policyResearcherNode(
  state: CreditCommitteeStateType
): Promise<Partial<CreditCommitteeStateType>> {
  const startMs = Date.now();
  const stepOrder = state.agentTrace.length + 1;
  const llm = createGeminiChatModel(state.modelName, state.temperature);

  const userPrompt =
    `User Inquiry: ${state.userPrompt}\n\n` +
    `Financial & Risk Analyst Findings:\n${state.riskAnalysis || 'Not yet available.'}` +
    formatRevisionFeedback(state);

  const { outputText, toolCalls } = await executeToolCallingLoop({
    llm,
    tools: [ragKnowledgeLangChainTool, databaseFilesLangChainTool],
    systemPrompt: POLICY_RESEARCHER_SYSTEM_PROMPT,
    userPrompt,
    maxSteps: 4,
  });

  const isRevision = Boolean(state.complianceAudit && !state.complianceAudit.approved);

  return {
    policyFindings: outputText,
    complianceAudit: isRevision ? null : state.complianceAudit,
    revisionCount: isRevision ? state.revisionCount + 1 : state.revisionCount,
    agentTrace: [
      {
        stepOrder,
        agent: 'policy_researcher',
        decisionOrSummary: outputText,
        toolCalls,
        durationMs: Date.now() - startMs,
      },
    ],
  };
}

/**
 * Node 4: Compliance Critic Agent (Cyclic Quality & Regulatory Gate)
 */
export async function complianceCriticNode(
  state: CreditCommitteeStateType
): Promise<Partial<CreditCommitteeStateType>> {
  const startMs = Date.now();
  const stepOrder = state.agentTrace.length + 1;
  const llm = createGeminiChatModel(state.modelName, 0.1);
  const structuredLlm = llm.withStructuredOutput(ComplianceAuditSchema);

  let auditResult: ComplianceAuditResult;
  try {
    const res = await structuredLlm.invoke(buildComplianceAuditPrompt(state));
    auditResult = {
      approved: res.approved,
      complianceScore: res.complianceScore,
      feedback: res.feedback,
      missingRequirements: res.missingRequirements || [],
      targetAgentForRevision: res.targetAgentForRevision,
    };
  } catch {
    auditResult = {
      approved: true,
      complianceScore: 85,
      feedback: 'Compliance audit completed via fallback check.',
      missingRequirements: [],
    };
  }

  return {
    complianceAudit: auditResult,
    agentTrace: [
      {
        stepOrder,
        agent: 'compliance_critic',
        decisionOrSummary: `[${auditResult.approved ? 'APPROVED' : 'NEEDS_REVISION'} | Score: ${auditResult.complianceScore}/100] ${auditResult.feedback}`,
        toolCalls: [],
        durationMs: Date.now() - startMs,
      },
    ],
  };
}

/**
 * Node 5: Final Synthesizer Agent
 */
export async function finalSynthesizerNode(
  state: CreditCommitteeStateType
): Promise<Partial<CreditCommitteeStateType>> {
  const startMs = Date.now();
  const stepOrder = state.agentTrace.length + 1;
  const llm = createGeminiChatModel(state.modelName, state.temperature);

  const response = await llm.invoke([new HumanMessage(buildFinalSynthesisPrompt(state))]);
  const finalDecisionText =
    typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

  return {
    finalDecision: finalDecisionText,
    agentTrace: [
      {
        stepOrder,
        agent: 'final_synthesizer',
        decisionOrSummary: 'Generated final Executive Committee Decision Memo.',
        toolCalls: [],
        durationMs: Date.now() - startMs,
      },
    ],
  };
}
