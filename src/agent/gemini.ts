import { GoogleGenAI, ApiError, Content } from '@google/genai';
import dotenv from 'dotenv';
import { agentTools, executeTool } from '../tools/index.js';
import { buildSystemPrompt } from './prompt.js';

dotenv.config();

const geminiApiKey = process.env.GEMINI_API_KEY || '';
export const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const gemini = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// Guards against a model stuck calling tools in a loop; normal replies need one or two rounds
const MAX_TOOL_ROUNDS = 5;

export const NOT_CONFIGURED_REPLY = "Meenace isn't connected to Gemini yet (GEMINI_API_KEY is not set), so I can't answer right now.";
export const QUOTA_EXHAUSTED_REPLY = "Sorry, I've used up my AI quota for now, so I can't answer properly at the moment. 🙏 Please try again a little later and I'll be right here!";
export const AGENT_UNAVAILABLE_REPLY = "Sorry, I'm having trouble thinking right now. 🙏 Please send your message again in a minute.";

export async function processWithAgent(params: {
  incomingText: string;
  ownerName: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<{ reply: string; toolsUsed: string[]; reasoningTrace?: string }> {
  const toolsUsed: string[] = [];

  if (!gemini) {
    return { reply: NOT_CONFIGURED_REPLY, toolsUsed, reasoningTrace: 'GEMINI_API_KEY is not set' };
  }

  try {
    const contents: Content[] = (params.conversationHistory || []).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    contents.push({ role: 'user', parts: [{ text: params.incomingText }] });

    const config = {
      systemInstruction: buildSystemPrompt(params.ownerName),
      tools: [{ functionDeclarations: agentTools.map(t => t.declaration) }],
      maxOutputTokens: 1024
    };

    let response = await gemini.models.generateContent({ model: geminiModel, contents, config });

    // Handle tool call iterations
    for (let round = 0; round < MAX_TOOL_ROUNDS && response.functionCalls?.length; round++) {
      // Send the model turn back unchanged so its thought signatures are preserved
      const modelTurn = response.candidates?.[0]?.content;
      if (modelTurn) contents.push(modelTurn);

      const responseParts = [];
      for (const call of response.functionCalls) {
        const name = call.name || '';
        toolsUsed.push(name);
        const result = await executeTool(name, call.args || {});
        responseParts.push({ functionResponse: { id: call.id, name, response: { result } } });
      }
      contents.push({ role: 'user', parts: responseParts });

      response = await gemini.models.generateContent({ model: geminiModel, contents, config });
    }

    const reply = response.text?.trim() || 'Done.';
    return { reply, toolsUsed };
  } catch (apiError: any) {
    console.warn('[GEMINI API ERROR]', apiError.message);
    const quotaExhausted = apiError instanceof ApiError && apiError.status === 429;
    return {
      reply: quotaExhausted ? QUOTA_EXHAUSTED_REPLY : AGENT_UNAVAILABLE_REPLY,
      toolsUsed,
      reasoningTrace: `Gemini API error: ${apiError.message}`
    };
  }
}
