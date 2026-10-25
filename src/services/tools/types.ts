export interface FunctionParameterProperty {
  type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: FunctionParameterProperty;
  properties?: Record<string, FunctionParameterProperty>;
  required?: string[];
}

export interface FunctionDeclarationSchema {
  name: string;
  description: string;
  parameters?: {
    type: 'OBJECT' | 'object';
    properties?: Record<string, FunctionParameterProperty>;
    required?: string[];
  };
}

export interface ITool {
  declaration: FunctionDeclarationSchema;
  execute(args: any): Promise<any>;
}

export interface ToolCallTrace {
  toolName: string;
  args: Record<string, any>;
  result: any;
  executionTimeMs: number;
}

export interface ToolCallingOptions {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  temperature?: number;
  maxSteps?: number;
  allowedTools?: string[];
}

export interface ToolCallingResult {
  prompt: string;
  answer: string;
  toolCalls: ToolCallTrace[];
  stepsCount: number;
  metadata: {
    modelUsed: string;
    provider: string;
    totalToolCalls: number;
    durationMs: number;
  };
}
