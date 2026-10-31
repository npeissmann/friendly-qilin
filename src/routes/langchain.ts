import { Router, Request, Response } from 'express';
import { DEFAULT_GEMINI_MODEL } from '../services/langchain/types.js';
import { LangChainAgentService } from '../services/langchain/LangChainAgentService.js';
import { CreditCommitteeService } from '../services/langchain/multiagent/CreditCommitteeService.js';
import {
  MOCK_CUSTOMERS,
  PREDEFINED_SCENARIOS,
} from '../services/langchain/data/mockCustomers.js';

export const langchainRouter = Router();
const langChainAgentService = new LangChainAgentService();
const creditCommitteeService = new CreditCommitteeService();

/**
 * @swagger
 * tags:
 *   name: LangChain & Multi-Agent
 *   description: Phase 3 (LangChain Tools & Single Agent) and Phase 4 (LangGraph Multi-Agent Credit & Risk Committee)
 */

/**
 * @swagger
 * /api/langchain/scenarios:
 *   get:
 *     summary: List pre-seeded customer personas, scenarios, and LangChain tools
 *     description: Returns the 4 simulated Credit & Collections customer profiles (CUST-001 to CUST-004), ready-to-test prompts, and registered LangChain tools.
 *     tags:
 *       - LangChain & Multi-Agent
 *     responses:
 *       200:
 *         description: Successfully retrieved test scenarios and customer personas
 */
langchainRouter.get('/langchain/scenarios', (_req: Request, res: Response): void => {
  res.json({
    tools: langChainAgentService.getAvailableTools(),
    scenarios: PREDEFINED_SCENARIOS,
    customers: Object.values(MOCK_CUSTOMERS),
  });
});

/**
 * @swagger
 * /api/langchain/agent:
 *   post:
 *     summary: "Phase 3: Run Single LangChain Agent with Structured Tools"
 *     description: Uses LangChain.js (@langchain/core + @langchain/google-genai) bound with 4 Zod tools (RAG policy search, DB file counter, Mock Credit Bureau/Open Finance lookup, and Deterministic Financial Calculator).
 *     tags:
 *       - LangChain & Multi-Agent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: User inquiry or credit/collections case to analyze
 *                 example: "Evaluate customer CUST-001 (Alice Silva) for her requested $14,000 EV Auto Loan. Check our 2026 credit concession policy, calculate her DTI and ESG rate discount, and determine the approval pathway and SLA."
 *               model:
 *                 type: string
 *                 default: gemini-3.1-flash-lite
 *                 description: Gemini model name
 *               temperature:
 *                 type: number
 *                 default: 0.2
 *               maxSteps:
 *                 type: integer
 *                 default: 6
 *               systemInstruction:
 *                 type: string
 *                 description: Optional custom system prompt override
 *     responses:
 *       200:
 *         description: LangChain single-agent response with full tool execution trace
 *       400:
 *         description: Missing prompt
 *       500:
 *         description: Internal server error
 */
langchainRouter.post('/langchain/agent', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      prompt,
      model = DEFAULT_GEMINI_MODEL,
      temperature = 0.2,
      maxSteps = 6,
      systemInstruction,
    } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Field "prompt" is required and must be a non-empty string.' });
      return;
    }

    const result = await langChainAgentService.runAgent({
      prompt,
      model,
      temperature: Number(temperature),
      maxSteps: Number(maxSteps),
      systemInstruction,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error in /api/langchain/agent:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/langchain/committee:
 *   post:
 *     summary: "Phase 4: Run LangGraph Multi-Agent Credit & Risk Committee"
 *     description: >
 *       Executes a cyclic LangGraph StateGraph where a Supervisor coordinates specialized agents:
 *       1. **Financial & Risk Analyst Agent** (retrieves customer bureau profile & runs deterministic DTI/DSCR/ESG/DPD math)
 *       2. **Policy Researcher Agent** (queries pgvector RAG for 2025/2026 Credit & Collections policies)
 *       3. **Compliance Critic Agent** (audits findings against mandatory policy checklists and can loop back for revisions)
 *       4. **Final Synthesizer Agent** (issues the official Executive Committee Decision Memo)
 *     tags:
 *       - LangChain & Multi-Agent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: The customer credit or collections case for the multi-agent committee
 *                 example: "Assess customer CUST-002 (GreenTech Solar Ltda) requesting $250,000 in Equipment Finance. Verify SME underwriting criteria, ESG discount eligibility, Open Finance requirements, and approval workflow level."
 *               model:
 *                 type: string
 *                 default: gemini-3.1-flash-lite
 *                 description: Gemini model identifier
 *               temperature:
 *                 type: number
 *                 default: 0.2
 *               maxRevisions:
 *                 type: integer
 *                 default: 1
 *                 description: Maximum cyclic revision loops if the Compliance Critic flags missing items
 *     responses:
 *       200:
 *         description: Multi-agent committee decision, specialist reports, compliance audit, and node-by-node execution trace
 *       400:
 *         description: Missing prompt
 *       500:
 *         description: Internal server error
 */
langchainRouter.post('/langchain/committee', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      prompt,
      model = DEFAULT_GEMINI_MODEL,
      temperature = 0.2,
      maxRevisions = 1,
    } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Field "prompt" is required and must be a non-empty string.' });
      return;
    }

    const result = await creditCommitteeService.evaluateCase({
      prompt,
      model,
      temperature: Number(temperature),
      maxRevisions: Number(maxRevisions),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error in /api/langchain/committee:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
