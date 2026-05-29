import OpenAI from "openai"

/**
 * Unified AI client. Points at any OpenAI-compatible endpoint (silra.cn,
 * official OpenAI, Anthropic gateway, etc.) — selected via env vars.
 *
 * Swap providers/models without touching business logic.
 */
export function getAIClient() {
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) {
    throw new Error("AI_API_KEY is not set. Add it to .env.local.")
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.AI_BASE_URL || "https://api.silra.cn/v1",
  })
}

/** Default model — override per call if a specific task needs a different one. */
export function getDefaultModel(): string {
  return process.env.AI_MODEL || "glm-5.1"
}
