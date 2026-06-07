import { describe, expect, it } from "vitest";
import {
  DEFAULT_CUSTOM_OPENAI_COMPATIBLE_BASE_URL,
  OLLAMA_OPENAI_BASE_URL,
  applyLocalModelEndpoint,
  inferLocalModelProvider,
  readPlainEnvValue,
} from "./local-model-endpoint";

describe("local model endpoint env helpers", () => {
  it("configures Ollama as an OpenAI-compatible local endpoint", () => {
    const env = applyLocalModelEndpoint({}, { provider: "ollama" });

    expect(readPlainEnvValue(env, "OPENAI_BASE_URL")).toBe(OLLAMA_OPENAI_BASE_URL);
    expect(readPlainEnvValue(env, "OPENAI_API_BASE")).toBe(OLLAMA_OPENAI_BASE_URL);
    expect(readPlainEnvValue(env, "OPENAI_API_KEY")).toBe("ollama");
    expect(inferLocalModelProvider(env)).toBe("ollama");
  });

  it("configures a custom FreeLLM/OpenAI-compatible endpoint", () => {
    const env = applyLocalModelEndpoint({}, {
      provider: "custom",
      baseUrl: ` ${DEFAULT_CUSTOM_OPENAI_COMPATIBLE_BASE_URL} `,
    });

    expect(readPlainEnvValue(env, "OPENAI_BASE_URL")).toBe(DEFAULT_CUSTOM_OPENAI_COMPATIBLE_BASE_URL);
    expect(readPlainEnvValue(env, "OPENAI_API_BASE")).toBe(DEFAULT_CUSTOM_OPENAI_COMPATIBLE_BASE_URL);
    expect(readPlainEnvValue(env, "OPENAI_API_KEY")).toBe("local");
    expect(inferLocalModelProvider(env)).toBe("custom");
  });

  it("does not replace a real configured API key", () => {
    const env = applyLocalModelEndpoint(
      { OPENAI_API_KEY: { type: "plain", value: "real-key" } },
      { provider: "ollama" },
    );

    expect(readPlainEnvValue(env, "OPENAI_API_KEY")).toBe("real-key");
  });

  it("turns off generated endpoint values without deleting real API keys", () => {
    const configured = applyLocalModelEndpoint({}, { provider: "ollama" });
    const disabled = applyLocalModelEndpoint({
      ...configured,
      OPENAI_API_KEY: { type: "plain", value: "real-key" },
    }, { provider: "none" });

    expect(readPlainEnvValue(disabled, "OPENAI_BASE_URL")).toBe("");
    expect(readPlainEnvValue(disabled, "OPENAI_API_BASE")).toBe("");
    expect(readPlainEnvValue(disabled, "OPENAI_API_KEY")).toBe("real-key");
  });
});
