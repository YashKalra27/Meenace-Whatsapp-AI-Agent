import { AgentTool } from './types.js';
import { coreTools } from './core.js';
import { kalvionTools } from './kalvion.js';

// Every tool Meenace can use. Add a new capability by writing an AgentTool and listing it here.
export const agentTools: AgentTool[] = [...coreTools, ...kalvionTools];

export function findTool(name: string): AgentTool | undefined {
  return agentTools.find(t => t.declaration.name === name);
}

export async function executeTool(name: string, args: Record<string, any>): Promise<unknown> {
  const tool = findTool(name);
  if (!tool) return { error: `Unknown tool: ${name}` };
  try {
    return await tool.run(args);
  } catch (err: any) {
    return { error: err.message };
  }
}
