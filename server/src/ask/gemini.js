import { GoogleGenAI } from '@google/genai';

/**
 * @typedef {object} LlmClient
 * @property {string} model
 * @property {(input: { systemInstruction: string, prompt: string }) => Promise<string>} generate
 */

/**
 * Thin wrapper around the Gemini API so the rest of the code depends only on `generate()`.
 * @param {{ apiKey: string, model: string, timeoutMs?: number, client?: { models: { generateContent: Function } } }} options
 * @returns {LlmClient}
 */
export function createGeminiClient({ apiKey, model, timeoutMs = 45_000, client }) {
  const ai = client ?? new GoogleGenAI({ apiKey });
  return {
    model,
    async generate({ systemInstruction, prompt }) {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });
      return response.text ?? '';
    },
  };
}
