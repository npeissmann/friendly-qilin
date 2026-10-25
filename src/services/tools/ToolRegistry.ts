import { ITool, FunctionDeclarationSchema } from './types.js';

export class ToolRegistry {
  private tools: Map<string, ITool> = new Map();

  register(tool: ITool): void {
    if (this.tools.has(tool.declaration.name)) {
      console.warn(`Tool with name "${tool.declaration.name}" is already registered. Overwriting.`);
    }
    this.tools.set(tool.declaration.name, tool);
  }

  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getAllTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  getDeclarations(allowedTools?: string[]): FunctionDeclarationSchema[] {
    const list = allowedTools && allowedTools.length > 0
      ? Array.from(this.tools.values()).filter(t => allowedTools.includes(t.declaration.name))
      : Array.from(this.tools.values());

    return list.map(t => t.declaration);
  }
}
