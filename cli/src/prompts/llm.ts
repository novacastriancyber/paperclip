import * as p from "@clack/prompts";
import type { LlmConfig } from "../config/schema.js";

const DEFAULT_LOCAL_OPENAI_COMPATIBLE_BASE_URL = "http://localhost:3001/v1";

export async function promptLlm(): Promise<LlmConfig | undefined> {
  const configureLlm = await p.confirm({
    message: "Configure an LLM provider now?",
    initialValue: false,
  });

  if (p.isCancel(configureLlm)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  if (!configureLlm) return undefined;

  const provider = await p.select({
    message: "LLM provider",
    options: [
      { value: "claude" as const, label: "Claude (Anthropic)" },
      { value: "openai" as const, label: "OpenAI" },
    ],
  });

  if (p.isCancel(provider)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  let baseUrl: string | undefined;
  if (provider === "openai") {
    const useCustomBaseUrl = await p.confirm({
      message: "Use a local/OpenAI-compatible base URL?",
      initialValue: false,
    });

    if (p.isCancel(useCustomBaseUrl)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }

    if (useCustomBaseUrl) {
      const baseUrlInput = await p.text({
        message: "OpenAI-compatible base URL",
        defaultValue: DEFAULT_LOCAL_OPENAI_COMPATIBLE_BASE_URL,
        placeholder: DEFAULT_LOCAL_OPENAI_COMPATIBLE_BASE_URL,
        validate: (val) => {
          if (!val) return "Base URL is required";
          try {
            new URL(val);
          } catch {
            return "Enter a valid URL";
          }
        },
      });

      if (p.isCancel(baseUrlInput)) {
        p.cancel("Setup cancelled.");
        process.exit(0);
      }

      baseUrl = baseUrlInput.trim();
    }
  }

  const apiKey = await p.password({
    message: `${provider === "claude" ? "Anthropic" : "OpenAI"} API key`,
    validate: (val) => {
      if (!val && !(provider === "openai" && baseUrl)) return "API key is required";
    },
  });

  if (p.isCancel(apiKey)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  return {
    provider,
    ...(apiKey ? { apiKey } : {}),
    chatCompletionsPath: "/v1/chat/completions",
    responsesPath: "/v1/responses",
    embeddingsPath: "/v1/embeddings",
    embeddingModel: "auto",
    ...(baseUrl
      ? {
          baseUrl,
        }
      : {}),
  };
}
