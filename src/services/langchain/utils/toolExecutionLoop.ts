import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { DEFAULT_GEMINI_MODEL, LangChainToolCallTrace } from '../types.js';

export interface ToolLoopParams {
  llm: ChatGoogleGenerativeAI;
  tools: StructuredToolInterface[];
  systemPrompt: string;
  userPrompt: string;
  maxSteps?: number;
}

export interface ToolLoopResult {
  outputText: string;
  toolCalls: LangChainToolCallTrace[];
  stepsExecuted: number;
}

/**
 * Factory for creating a configured ChatGoogleGenerativeAI instance.
 */
export function createGeminiChatModel(
  modelName: string = DEFAULT_GEMINI_MODEL,
  temperature: number = 0.2
): ChatGoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  return new ChatGoogleGenerativeAI({
    apiKey,
    model: modelName,
    temperature: Number(temperature),
  });
}

/**
 * Shared ReAct tool-calling execution loop used by both the Phase 3 Single Agent
 * and the Phase 4 Multi-Agent specialist nodes.
 */
export async function executeToolCallingLoop(
  params: ToolLoopParams
): Promise<ToolLoopResult> {
  const { llm, tools, systemPrompt, userPrompt, maxSteps = 5 } = params;
  const toolsByName = new Map(tools.map((t) => [t.name, t]));
  const llmWithTools = llm.bindTools(tools);

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ];

  const toolCallsTrace: LangChainToolCallTrace[] = [];
  let step = 0;
  let outputText = '';

  while (step < maxSteps) {
    step++;
    const aiResponse = (await llmWithTools.invoke(messages)) as AIMessage;
    messages.push(aiResponse);

    const requestedCalls = aiResponse.tool_calls || [];
    if (requestedCalls.length === 0) {
      outputText = extractTextFromMessageContent(aiResponse.content);
      break;
    }

    for (const call of requestedCalls) {
      const toolName = call.name;
      const toolArgs = (call.args as Record<string, any>) || {};
      const selectedTool = toolsByName.get(toolName);
      const startMs = Date.now();

      const rawOutput = await invokeSingleToolSafely(selectedTool, toolName, toolArgs);
      const executionTimeMs = Date.now() - startMs;

      toolCallsTrace.push({
        step,
        toolName,
        args: toolArgs,
        result: tryParseJson(rawOutput),
        executionTimeMs,
      });

      messages.push(
        new ToolMessage({
          tool_call_id: call.id || `${toolName}_${step}`,
          name: toolName,
          content: rawOutput,
        })
      );
    }
  }

  // Fallback synthesis if maxSteps was reached while still calling tools
  if (!outputText) {
    const synthesisResponse = await llm.invoke([
      ...messages,
      new HumanMessage(
        'Based on all tool outputs gathered so far, provide your final structured response now.'
      ),
    ]);
    outputText = extractTextFromMessageContent(synthesisResponse.content);
  }

  return {
    outputText,
    toolCalls: toolCallsTrace,
    stepsExecuted: step,
  };
}

async function invokeSingleToolSafely(
  toolInstance: StructuredToolInterface | undefined,
  toolName: string,
  toolArgs: Record<string, any>
): Promise<string> {
  if (!toolInstance) {
    return JSON.stringify({ error: `Tool "${toolName}" is not registered for this agent.` });
  }

  try {
    const output = await toolInstance.invoke(toolArgs);
    return typeof output === 'string' ? output : JSON.stringify(output);
  } catch (err: any) {
    return JSON.stringify({
      error: err.message || `Error executing tool "${toolName}".`,
    });
  }
}

function extractTextFromMessageContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  return JSON.stringify(content);
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
