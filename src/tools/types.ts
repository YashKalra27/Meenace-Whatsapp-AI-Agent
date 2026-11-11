import { FunctionDeclaration } from '@google/genai';

// One capability Gemini can call. `declaration` is what the model sees; `run` executes it.
// Return plain JSON. Return { error } instead of throwing for problems the model should explain.
export interface AgentTool {
  declaration: FunctionDeclaration;
  run(args: Record<string, any>): Promise<unknown>;
}
