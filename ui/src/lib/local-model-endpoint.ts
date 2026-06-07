import type { EnvBinding } from "@paperclipai/shared";

export type LocalModelEndpointProvider = "none" | "ollama" | "custom";

export const OLLAMA_OPENAI_BASE_URL = "http://localhost:11434/v1";

const LOCAL_MODEL_PLACEHOLDER_API_KEYS = new Set(["ollama", "local", "freellm"]);

export function readPlainEnvValue(env: Record<string, EnvBinding>, key: string): string {
  const value = env[key];
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && value.type === "plain") return value.value;
  return "";
}

function withPlainEnvValue(
  env: Record<string, EnvBinding>,
  key: string,
  value: string | null,
): Record<string, EnvBinding> {
  const next = { ...env };
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    delete next[key];
    return next;
  }
  next[key] = { type: "plain", value: trimmed };
  return next;
}

export function inferLocalModelProvider(env: Record<string, EnvBinding>): LocalModelEndpointProvider {
  const baseUrl = readPlainEnvValue(env, "OPENAI_BASE_URL") || readPlainEnvValue(env, "OPENAI_API_BASE");
  if (!baseUrl) return "none";
  return baseUrl.replace(/\/+$/, "") === OLLAMA_OPENAI_BASE_URL ? "ollama" : "custom";
}

export function shouldReplaceLocalPlaceholderApiKey(env: Record<string, EnvBinding>): boolean {
  const current = readPlainEnvValue(env, "OPENAI_API_KEY").trim().toLowerCase();
  return !current || LOCAL_MODEL_PLACEHOLDER_API_KEYS.has(current);
}

export function applyLocalModelEndpoint(
  env: Record<string, EnvBinding>,
  input: {
    provider: LocalModelEndpointProvider;
    baseUrl?: string;
    apiKey?: string;
  },
): Record<string, EnvBinding> {
  let next = { ...env };
  if (input.provider === "none") {
    next = withPlainEnvValue(next, "OPENAI_BASE_URL", null);
    next = withPlainEnvValue(next, "OPENAI_API_BASE", null);
    const currentKey = readPlainEnvValue(next, "OPENAI_API_KEY").trim().toLowerCase();
    if (LOCAL_MODEL_PLACEHOLDER_API_KEYS.has(currentKey)) {
      next = withPlainEnvValue(next, "OPENAI_API_KEY", null);
    }
    return next;
  }

  const baseUrl = input.provider === "ollama"
    ? OLLAMA_OPENAI_BASE_URL
    : input.baseUrl?.trim() ?? "";
  next = withPlainEnvValue(next, "OPENAI_BASE_URL", baseUrl);
  next = withPlainEnvValue(next, "OPENAI_API_BASE", baseUrl);
  if (input.apiKey !== undefined) {
    next = withPlainEnvValue(next, "OPENAI_API_KEY", input.apiKey);
  } else if (shouldReplaceLocalPlaceholderApiKey(next)) {
    next = withPlainEnvValue(next, "OPENAI_API_KEY", input.provider === "ollama" ? "ollama" : "local");
  }
  return next;
}
