import { GoogleGenAI } from '@google/genai';
import { ToolRegistry } from './ToolRegistry.js';
import {
  ToolCallingOptions,
  ToolCallingResult,
  ToolCallTrace,
} from './types.js';
import { DatabaseFilesTool } from './definitions/DatabaseFilesTool.js';
import { RagSearchTool } from './definitions/RagSearchTool.js';

export class ToolCallingService {
  private ai: GoogleGenAI;
  private registry: ToolRegistry;

  constructor(registry?: ToolRegistry) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      console.warn('Warning: GEMINI_API_KEY environment variable is not set.');
    }
    this.ai = new GoogleGenAI({ apiKey });

    if (registry) {
      this.registry = registry;
    } else {
      this.registry = new ToolRegistry();
      // Register default tools
      this.registry.register(new DatabaseFilesTool());
      this.registry.register(new RagSearchTool());
    }
  }

  getRegistry(): ToolRegistry {
    return this.registry;
  }

  async chat(options: ToolCallingOptions): Promise<ToolCallingResult> {
    const startTime = Date.now();
    const {
      prompt,
      systemInstruction,
      model = 'gemini-3.1-flash-lite',
      temperature = 0.2,
      maxSteps = 5,
      allowedTools,
    } = options;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error('Prompt must be a non-empty string.');
    }

    // Get active tool declarations
    const declarations = this.registry.getDeclarations(allowedTools);

    const defaultSystemInstruction =
      'You are a helpful and intelligent enterprise AI assistant equipped with specialized tools.\n' +
      'Rules:\n' +
      '1. If answering the user inquiry requires checking the database files, counting files, or retrieving policy knowledge, call the appropriate tool.\n' +
      '2. You can call multiple tools or make sequential tool calls if necessary to answer complex multi-part questions.\n' +
      '3. Ground your final answer strictly in the facts and data returned by the tools.\n' +
      '4. Cite filenames, chunk indices, and numbers clearly and concisely.';

    const effectiveSystemInstruction = systemInstruction || defaultSystemInstruction;

    const contents: any[] = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    const config: Record<string, any> = {
      systemInstruction: effectiveSystemInstruction,
      temperature: Number(temperature),
    };

    if (declarations.length > 0) {
      config.tools = [{ functionDeclarations: declarations }];
    }

    const toolCallsTrace: ToolCallTrace[] = [];
    let step = 0;
    let finalAnswer = '';

    while (step < maxSteps) {
      step++;

      const response = await this.ai.models.generateContent({
        model,
        contents,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      const functionCalls = response.functionCalls;

      // If the model did not request any function call, we have our final text answer
      if (!functionCalls || functionCalls.length === 0) {
        finalAnswer =
          response.text ||
          response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text ||
          '';
        break;
      }

      // If there are function calls:
      // 1. Append model's response parts to conversation history
      const modelParts = response.candidates?.[0]?.content?.parts || [];
      contents.push({
        role: 'model',
        parts: modelParts,
      });

      // 2. Execute each tool and collect responses
      const functionResponses: any[] = [];

      for (const call of functionCalls) {
        const toolName = call.name || 'unknown_tool';
        const toolStart = Date.now();
        const tool = this.registry.get(toolName);

        let toolOutput: any;
        if (!tool) {
          toolOutput = { error: `Tool "${toolName}" is not registered.` };
        } else {
          try {
            toolOutput = await tool.execute(call.args || {});
          } catch (err: any) {
            toolOutput = { error: err.message || 'Error executing tool.' };
          }
        }

        const executionDuration = Date.now() - toolStart;

        toolCallsTrace.push({
          toolName,
          args: (call.args as Record<string, any>) || {},
          result: toolOutput,
          executionTimeMs: executionDuration,
        });

        functionResponses.push({
          functionResponse: {
            id: (call as any).id,
            name: toolName,
            response: { output: toolOutput },
          },
        });
      }

      // 3. Send tool results back to the model in the next turn
      contents.push({
        role: 'user',
        parts: functionResponses,
      });
    }

    if (!finalAnswer && step >= maxSteps) {
      finalAnswer =
        'Agent reached the maximum number of tool call steps without producing a final answer.';
    }

    return {
      prompt,
      answer: finalAnswer,
      toolCalls: toolCallsTrace,
      stepsCount: step,
      metadata: {
        modelUsed: model,
        provider: 'gemini',
        totalToolCalls: toolCallsTrace.length,
        durationMs: Date.now() - startTime,
      },
    };
  }
}
