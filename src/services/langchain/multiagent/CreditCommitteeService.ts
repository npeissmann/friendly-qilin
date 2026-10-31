import { StateGraph, START, END } from '@langchain/langgraph';
import { DEFAULT_GEMINI_MODEL } from '../types.js';
import { CreditCommitteeState } from './state.js';
import {
  supervisorNode,
  riskAnalystNode,
  policyResearcherNode,
  complianceCriticNode,
  finalSynthesizerNode,
} from './nodes.js';

export interface CreditCommitteeOptions {
  prompt: string;
  model?: string;
  temperature?: number;
  maxRevisions?: number;
}

/**
 * Phase 4 Service: LangGraph Cyclic Multi-Agent Architecture
 * ("Autonomous Credit & Risk Committee")
 */
export class CreditCommitteeService {
  /**
   * Builds and compiles the cyclic LangGraph StateGraph.
   */
  private buildGraph() {
    return new StateGraph(CreditCommitteeState)
      .addNode('supervisor', supervisorNode)
      .addNode('risk_analyst', riskAnalystNode)
      .addNode('policy_researcher', policyResearcherNode)
      .addNode('compliance_critic', complianceCriticNode)
      .addNode('final_synthesizer', finalSynthesizerNode)
      // Entry point -> Supervisor
      .addEdge(START, 'supervisor')
      // Supervisor conditional routing to specialists or synthesizer
      .addConditionalEdges('supervisor', (state) => state.nextAgent, {
        risk_analyst: 'risk_analyst',
        policy_researcher: 'policy_researcher',
        compliance_critic: 'compliance_critic',
        final_synthesizer: 'final_synthesizer',
      })
      // Specialists always report back to the Supervisor
      .addEdge('risk_analyst', 'supervisor')
      .addEdge('policy_researcher', 'supervisor')
      .addEdge('compliance_critic', 'supervisor')
      // Final Synthesizer ends the graph
      .addEdge('final_synthesizer', END)
      .compile();
  }

  /**
   * Executes the Multi-Agent Credit & Risk Committee workflow.
   */
  async evaluateCase(options: CreditCommitteeOptions) {
    const startTime = Date.now();
    const {
      prompt,
      model = DEFAULT_GEMINI_MODEL,
      temperature = 0.2,
      maxRevisions = 1,
    } = options;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error('Prompt must be a non-empty string.');
    }

    const compiledGraph = this.buildGraph();

    const finalState = await compiledGraph.invoke({
      userPrompt: prompt,
      modelName: model,
      temperature: Number(temperature),
      maxRevisions: Number(maxRevisions),
    });

    const totalToolCalls = finalState.agentTrace.reduce(
      (sum, step) => sum + step.toolCalls.length,
      0
    );

    return {
      prompt,
      finalDecision: finalState.finalDecision,
      specialistReports: {
        riskAnalysis: finalState.riskAnalysis,
        policyFindings: finalState.policyFindings,
        complianceAudit: finalState.complianceAudit,
      },
      agentTrace: finalState.agentTrace,
      metadata: {
        framework: 'LangGraph (@langchain/langgraph StateGraph)',
        modelUsed: model,
        totalGraphSteps: finalState.agentTrace.length,
        totalToolCalls,
        revisionsTriggered: finalState.revisionCount,
        durationMs: Date.now() - startTime,
      },
    };
  }
}
