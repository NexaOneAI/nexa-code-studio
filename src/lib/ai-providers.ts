/**
 * Catálogo de proveedores y modelos disponibles.
 * SAFE para importarse desde el cliente (no contiene API keys ni lógica de red).
 */
export type AIProvider = "openai" | "gemini" | "claude" | "grok";

export interface AIModel {
  id: string;
  label: string;
  description?: string;
}

export interface AIProviderInfo {
  id: AIProvider;
  label: string;
  color: string; // clase tailwind para el badge
  models: AIModel[];
  defaultModel: string;
}

export const AI_PROVIDERS: Record<AIProvider, AIProviderInfo> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    color: "from-emerald-500 to-teal-500",
    defaultModel: "gpt-4o-mini",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", description: "Rápido y económico" },
      { id: "gpt-4o", label: "GPT-4o", description: "Máxima calidad" },
    ],
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    color: "from-blue-500 to-cyan-500",
    defaultModel: "gemini-1.5-flash",
    models: [
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", description: "Rápido" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", description: "Razonamiento avanzado" },
    ],
  },
  claude: {
    id: "claude",
    label: "Claude",
    color: "from-orange-500 to-amber-500",
    defaultModel: "claude-3-5-sonnet-latest",
    models: [
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", description: "Premium" },
      { id: "claude-3-haiku-20240307", label: "Claude 3 Haiku", description: "Económico" },
    ],
  },
  grok: {
    id: "grok",
    label: "Grok",
    color: "from-fuchsia-500 to-pink-500",
    defaultModel: "grok-beta",
    models: [{ id: "grok-beta", label: "Grok Beta", description: "xAI" }],
  },
};

export const PROVIDER_LIST: AIProviderInfo[] = Object.values(AI_PROVIDERS);

export function getModel(provider: AIProvider, modelId?: string): string {
  const p = AI_PROVIDERS[provider];
  if (!p) return AI_PROVIDERS.openai.defaultModel;
  if (modelId && p.models.some((m) => m.id === modelId)) return modelId;
  return p.defaultModel;
}

/** Proveedor por defecto. Persistido en localStorage para overrides de admin. */
const DEFAULT_PROVIDER_KEY = "nexa.defaultProvider";
export function getDefaultProvider(): AIProvider {
  if (typeof window === "undefined") return "openai";
  const v = window.localStorage.getItem(DEFAULT_PROVIDER_KEY) as AIProvider | null;
  return v && AI_PROVIDERS[v] ? v : "openai";
}
export function setDefaultProvider(p: AIProvider) {
  if (typeof window !== "undefined") window.localStorage.setItem(DEFAULT_PROVIDER_KEY, p);
}