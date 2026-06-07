import type { AdapterModel } from "./types.js";
import { models as codexFallbackModels } from "@paperclipai/adapter-codex-local";
import { readConfigFile } from "../config-file.js";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_MODELS_TIMEOUT_MS = 5000;
const OPENAI_MODELS_CACHE_TTL_MS = 60_000;

let cached: { cacheKey: string; expiresAt: number; models: AdapterModel[] } | null = null;

function fingerprint(input: { apiKey: string | null; baseUrl: string }): string {
  const apiKey = input.apiKey ?? "";
  return `${input.baseUrl}|${apiKey.length}:${apiKey.slice(-6)}`;
}

function normalizeOpenAiBaseUrl(baseUrl: string | undefined | null): string {
  const trimmed = baseUrl?.trim();
  return (trimmed && trimmed.length > 0 ? trimmed : DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
}

function isDefaultOpenAiBaseUrl(baseUrl: string): boolean {
  return baseUrl === DEFAULT_OPENAI_BASE_URL;
}

function openAiModelsEndpoint(baseUrl: string): string {
  return `${baseUrl}/models`;
}

function dedupeModels(models: AdapterModel[]): AdapterModel[] {
  const seen = new Set<string>();
  const deduped: AdapterModel[] = [];
  for (const model of models) {
    const id = model.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push({ id, label: model.label.trim() || id });
  }
  return deduped;
}

function mergedWithFallback(models: AdapterModel[]): AdapterModel[] {
  return dedupeModels([
    ...models,
    ...codexFallbackModels,
  ]).sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true, sensitivity: "base" }));
}

function resolveOpenAiModelDiscoveryConfig(): { apiKey: string | null; baseUrl: string } {
  const envKey = process.env.OPENAI_API_KEY?.trim();
  const envBaseUrl = process.env.OPENAI_BASE_URL?.trim()
    || process.env.OPENAI_API_BASE?.trim()
    || process.env.OPENAI_API_BASE_URL?.trim();

  const config = readConfigFile();
  const configKey = config?.llm?.provider === "openai" ? config.llm.apiKey?.trim() : undefined;
  const configBaseUrl = config?.llm?.provider === "openai" ? config.llm.baseUrl?.trim() : undefined;
  const apiKey = envKey || configKey || null;

  return {
    apiKey: apiKey && apiKey.length > 0 ? apiKey : null,
    baseUrl: normalizeOpenAiBaseUrl(envBaseUrl || configBaseUrl),
  };
}

async function fetchOpenAiModels(input: { apiKey: string | null; baseUrl: string }): Promise<AdapterModel[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_MODELS_TIMEOUT_MS);
  const headers: Record<string, string> = {};
  if (input.apiKey) headers.Authorization = `Bearer ${input.apiKey}`;
  try {
    const response = await fetch(openAiModelsEndpoint(input.baseUrl), {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as { data?: unknown };
    const data = Array.isArray(payload.data) ? payload.data : [];
    const models: AdapterModel[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) continue;
      const id = (item as { id?: unknown }).id;
      if (typeof id !== "string" || id.trim().length === 0) continue;
      models.push({ id, label: id });
    }
    return dedupeModels(models);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function loadCodexModels(options?: { forceRefresh?: boolean }): Promise<AdapterModel[]> {
  const forceRefresh = options?.forceRefresh === true;
  const discovery = resolveOpenAiModelDiscoveryConfig();
  const fallback = dedupeModels(codexFallbackModels);
  if (!discovery.apiKey && isDefaultOpenAiBaseUrl(discovery.baseUrl)) return fallback;

  const now = Date.now();
  const cacheKey = fingerprint(discovery);
  if (!forceRefresh && cached && cached.cacheKey === cacheKey && cached.expiresAt > now) {
    return cached.models;
  }

  const fetched = await fetchOpenAiModels(discovery);
  if (fetched.length > 0) {
    const merged = mergedWithFallback(fetched);
    cached = {
      cacheKey,
      expiresAt: now + OPENAI_MODELS_CACHE_TTL_MS,
      models: merged,
    };
    return merged;
  }

  if (cached && cached.cacheKey === cacheKey && cached.models.length > 0) {
    return cached.models;
  }

  return fallback;
}

export async function listCodexModels(): Promise<AdapterModel[]> {
  return loadCodexModels();
}

export async function refreshCodexModels(): Promise<AdapterModel[]> {
  return loadCodexModels({ forceRefresh: true });
}

export function resetCodexModelsCacheForTests() {
  cached = null;
}
