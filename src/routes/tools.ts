import { Router, Request, Response } from 'express';
import { ToolCallingService } from '../services/tools/ToolCallingService.js';

export const toolsRouter = Router();
const toolCallingService = new ToolCallingService();

/**
 * @swagger
 * tags:
 *   name: Tools
 *   description: Tool Calling & AI Agent function calling capabilities
 */

/**
 * @swagger
 * /api/tools:
 *   get:
 *     summary: List all registered tools and their schemas
 *     description: Returns the definitions and JSON Schemas of all tools available to the AI agent.
 *     tags:
 *       - Tools
 *     responses:
 *       200:
 *         description: Successfully retrieved registered tools
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalTools:
 *                   type: integer
 *                   example: 2
 *                 tools:
 *                   type: array
 *                   items:
 *                     type: object
 */
toolsRouter.get('/tools', (_req: Request, res: Response): void => {
  const registry = toolCallingService.getRegistry();
  const declarations = registry.getDeclarations();

  res.json({
    totalTools: declarations.length,
    tools: declarations,
  });
});

/**
 * @swagger
 * /api/tools/chat:
 *   post:
 *     summary: Chat with AI Agent using autonomous Tool Calling
 *     description: Sends a prompt to the LLM equipped with tools. The AI evaluates whether to call tools (such as counting database files or querying the RAG knowledge base), executes them, and returns both the final synthesized answer and the full tool execution trace.
 *     tags:
 *       - Tools
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
 *                 description: The user inquiry or task
 *                 example: "How many different files are in our database, and what are their names?"
 *               model:
 *                 type: string
 *                 default: gemini-3.1-flash-lite
 *                 description: Gemini model identifier
 *               temperature:
 *                 type: number
 *                 default: 0.2
 *                 description: Temperature setting for LLM sampling
 *               maxSteps:
 *                 type: integer
 *                 default: 5
 *                 description: Maximum tool calling iterations
 *               systemInstruction:
 *                 type: string
 *                 description: Optional custom system persona instruction
 *               allowedTools:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional whitelist of tool names (e.g. ["count_database_files", "query_rag_knowledge_base"])
 *     responses:
 *       200:
 *         description: Agent response containing final grounded text and complete tool execution trace
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 prompt:
 *                   type: string
 *                 answer:
 *                   type: string
 *                 toolCalls:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       toolName:
 *                         type: string
 *                       args:
 *                         type: object
 *                       result:
 *                         type: object
 *                       executionTimeMs:
 *                         type: number
 *                 stepsCount:
 *                   type: integer
 *                 metadata:
 *                   type: object
 *       400:
 *         description: Bad request (missing prompt)
 *       500:
 *         description: Internal server error
 */
toolsRouter.post('/tools/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      prompt,
      model = 'gemini-3.1-flash-lite',
      temperature = 0.2,
      maxSteps = 5,
      systemInstruction,
      allowedTools,
    } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Field "prompt" is required and must be a non-empty string.' });
      return;
    }

    const result = await toolCallingService.chat({
      prompt,
      model,
      temperature: Number(temperature),
      maxSteps: Number(maxSteps),
      systemInstruction,
      allowedTools,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error in /api/tools/chat:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/tools/execute-direct:
 *   post:
 *     summary: Directly test execution of a specific tool
 *     description: Bypasses the LLM and runs a tool directly by name with provided arguments. Useful for debugging and unit testing tools.
 *     tags:
 *       - Tools
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - toolName
 *             properties:
 *               toolName:
 *                 type: string
 *                 enum: [count_database_files, query_rag_knowledge_base]
 *                 example: count_database_files
 *               args:
 *                 type: object
 *                 example: {}
 *     responses:
 *       200:
 *         description: Direct tool execution result
 *       400:
 *         description: Invalid tool name or arguments
 */
toolsRouter.post('/tools/execute-direct', async (req: Request, res: Response): Promise<void> => {
  try {
    const { toolName, args = {} } = req.body;

    if (!toolName || typeof toolName !== 'string') {
      res.status(400).json({ error: 'Field "toolName" is required.' });
      return;
    }

    const tool = toolCallingService.getRegistry().get(toolName);
    if (!tool) {
      res.status(404).json({ error: `Tool "${toolName}" not found.` });
      return;
    }

    const startTime = Date.now();
    const result = await tool.execute(args);
    const durationMs = Date.now() - startTime;

    res.json({
      toolName,
      args,
      result,
      durationMs,
    });
  } catch (error: any) {
    console.error('Error in /api/tools/execute-direct:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
