import { StructuredToolInterface } from '@langchain/core/tools';
import {
  DEFAULT_GEMINI_MODEL,
  LangChainAgentOptions,
  LangChainAgentResult,
} from './types.js';
import {
  createGeminiChatModel,
  executeToolCallingLoop,
} from './utils/toolExecutionLoop.js';
import {
  ragKnowledgeLangChainTool,
  databaseFilesLangChainTool,
} from './tools/ragLangChainTools.js';
import { customerProfileLangChainTool } from './tools/customerProfileTool.js';
import { financialCalculatorLangChainTool } from './tools/financialCalculatorTool.js';

const DEFAULT_SINGLE_AGENT_SYSTEM_PROMPT =
  'You are a Senior Credit & Collections AI Analyst powered by LangChain.\n' +
  'You have access to 4 specialized tools:\n' +
  '1. `lookup_customer_profile`: Look up customer credit scores, income, ESG profile, Open Finance consent, and delinquency status (e.g., CUST-001, CUST-002, CUST-003, CUST-004).\n' +
  '2. `query_rag_knowledge_base`: Search the corporate vector database for 2025/2026 Credit Concession and Collections Recovery policies.\n' +
  '3. `calculate_credit_and_collections_metrics`: Compute exact DTI, DSCR, ESG rate modifiers, approval workflow tier, and delinquency penalties.\n' +
  '4. `count_database_files`: Inspect indexed policy files in PostgreSQL.\n\n' +
  'Always look up the customer profile, retrieve the relevant policy rules from RAG, and run the financial calculator before formulating your final recommendation. Cite specific policy sections and filenames.';

/**
 * Phase 3 Service: Demonstrates LangChain.js (`@langchain/core` + `@langchain/google-genai`)
 * binding structured Zod tools into a single autonomous agent chain.
 */
export class LangChainAgentService {
  private readonly tools: StructuredToolInterface[];

  constructor() {
    this.tools = [
      ragKnowledgeLangChainTool,
      databaseFilesLangChainTool,
      customerProfileLangChainTool,
      financialCalculatorLangChainTool,
    ];
  }

  getAvailableTools() {
    return this.tools.map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }

  async runAgent(options: LangChainAgentOptions): Promise<LangChainAgentResult> {
    const startTime = Date.now();
    const {
      prompt,
      model = DEFAULT_GEMINI_MODEL,
      temperature = 0.2,
      maxSteps = 6,
      systemInstruction,
    } = options;

    const llm = createGeminiChatModel(model, temperature);

    const { outputText, toolCalls, stepsExecuted } = await executeToolCallingLoop({
      llm,
      tools: this.tools,
      systemPrompt: systemInstruction || DEFAULT_SINGLE_AGENT_SYSTEM_PROMPT,
      userPrompt: prompt,
      maxSteps,
    });

    return {
      prompt,
      answer: outputText,
      toolCalls,
      stepsCount: stepsExecuted,
      metadata: {
        framework: 'LangChain (@langchain/core + @langchain/google-genai)',
        modelUsed: model,
        totalToolCalls: toolCalls.length,
        durationMs: Date.now() - startTime,
      },
    };
  }
}
