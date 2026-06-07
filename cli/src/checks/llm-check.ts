import type { PaperclipConfig } from "../config/schema.js";
import type { CheckResult } from "./index.js";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

function normalizeOpenAiBaseUrl(baseUrl: string | undefined): string {
  const trimmed = baseUrl?.trim();
  return (trimmed && trimmed.length > 0 ? trimmed : DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
}

export async function llmCheck(config: PaperclipConfig): Promise<CheckResult> {
  if (!config.llm) {
    return {
      name: "LLM provider",
      status: "pass",
      message: "No LLM provider configured (optional)",
    };
  }

  if (!config.llm.apiKey && !(config.llm.provider === "openai" && config.llm.baseUrl)) {
    return {
      name: "LLM provider",
      status: "pass",
      message: `${config.llm.provider} configured but no API key set (optional)`,
    };
  }

  try {
    if (config.llm.provider === "claude") {
      const apiKey = config.llm.apiKey ?? "";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (res.ok || res.status === 400) {
        return { name: "LLM provider", status: "pass", message: "Claude API key is valid" };
      }
      if (res.status === 401) {
        return {
          name: "LLM provider",
          status: "fail",
          message: "Claude API key is invalid (401)",
          canRepair: false,
          repairHint: "Run `paperclipai configure --section llm`",
        };
      }
      return {
        name: "LLM provider",
        status: "warn",
        message: `Claude API returned status ${res.status}`,
      };
    } else {
      const baseUrl = normalizeOpenAiBaseUrl(config.llm.baseUrl);
      const headers: Record<string, string> = {};
      if (config.llm.apiKey) headers.Authorization = `Bearer ${config.llm.apiKey}`;
      const res = await fetch(`${baseUrl}/models`, { headers });
      if (res.ok) {
        return {
          name: "LLM provider",
          status: "pass",
          message: config.llm.baseUrl ? "OpenAI-compatible endpoint is reachable" : "OpenAI API key is valid",
        };
      }
      if (res.status === 401) {
        return {
          name: "LLM provider",
          status: "fail",
          message: "OpenAI API key is invalid (401)",
          canRepair: false,
          repairHint: "Run `paperclipai configure --section llm`",
        };
      }
      return {
        name: "LLM provider",
        status: "warn",
        message: `${config.llm.baseUrl ? "OpenAI-compatible endpoint" : "OpenAI API"} returned status ${res.status}`,
      };
    }
  } catch {
    return {
      name: "LLM provider",
      status: "warn",
      message: "Could not reach LLM API to validate configuration",
    };
  }
}
