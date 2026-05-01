/**
 * Servicio multi-proveedor de IA — SERVER ONLY.
 * No importar desde el cliente. Lee API keys vía process.env.
 */

export type AIProviderId = "openai" | "gemini" | "claude" | "grok";

export interface ProviderRequest {
  provider: AIProviderId;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
}

export interface ProviderResponse {
  ok: true;
  text: string;
  provider: AIProviderId;
  model: string;
}
export interface ProviderError {
  ok: false;
  error: string;
  provider: AIProviderId;
  model: string;
  status?: number;
}

function envFor(provider: AIProviderId): string | undefined {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "gemini":
      return process.env.GEMINI_API_KEY;
    case "claude":
      return process.env.ANTHROPIC_API_KEY;
    case "grok":
      return process.env.XAI_API_KEY;
  }
}

/* -------------- OpenAI -------------- */
async function callOpenAI(req: ProviderRequest, key: string) {
  console.log(`[AI] OpenAI → model=${req.model} promptChars=${req.userPrompt.length}`);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    signal: req.signal,
    body: JSON.stringify({
      model: req.model,
      messages: [
        { role: "system", content: req.systemPrompt },
        { role: "user", content: req.userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 12000,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false as const,
      status: res.status,
      error: `OpenAI ${res.status}: ${t.slice(0, 200)}`,
    };
  }
  const j = await res.json();
  const text = j.choices?.[0]?.message?.content;
  if (!text) return { ok: false as const, status: 500, error: "OpenAI: respuesta vacía" };
  return { ok: true as const, text };
}

/* -------------- Gemini (Google) -------------- */
async function callGemini(req: ProviderRequest, key: string) {
  console.log(`[AI] Gemini → model=${req.model} promptChars=${req.userPrompt.length}`);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    req.model,
  )}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: req.signal,
    body: JSON.stringify({
      systemInstruction: { role: "system", parts: [{ text: req.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: req.userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 12000,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false as const,
      status: res.status,
      error: `Gemini ${res.status}: ${t.slice(0, 200)}`,
    };
  }
  const j = await res.json();
  const text = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
  if (!text) return { ok: false as const, status: 500, error: "Gemini: respuesta vacía" };
  return { ok: true as const, text };
}

/* -------------- Claude (Anthropic) -------------- */
async function callClaude(req: ProviderRequest, key: string) {
  console.log(`[AI] Claude → model=${req.model} promptChars=${req.userPrompt.length}`);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    signal: req.signal,
    body: JSON.stringify({
      model: req.model,
      max_tokens: 12000,
      temperature: 0.7,
      system:
        req.systemPrompt +
        "\n\nIMPORTANTE: devuelve SOLO JSON válido sin texto adicional ni markdown.",
      messages: [{ role: "user", content: req.userPrompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false as const,
      status: res.status,
      error: `Claude ${res.status}: ${t.slice(0, 200)}`,
    };
  }
  const j = await res.json();
  const text =
    j.content
      ?.map((c: any) => c.text)
      .filter(Boolean)
      .join("") || "";
  if (!text) return { ok: false as const, status: 500, error: "Claude: respuesta vacía" };
  return { ok: true as const, text };
}

/* -------------- Grok (xAI) -------------- */
async function callGrok(req: ProviderRequest, key: string) {
  console.log(`[AI] Grok → model=${req.model} promptChars=${req.userPrompt.length}`);
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    signal: req.signal,
    body: JSON.stringify({
      model: req.model,
      messages: [
        { role: "system", content: req.systemPrompt + "\n\nDevuelve SOLO JSON válido." },
        { role: "user", content: req.userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 12000,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false as const,
      status: res.status,
      error: `Grok ${res.status}: ${t.slice(0, 200)}`,
    };
  }
  const j = await res.json();
  const text = j.choices?.[0]?.message?.content;
  if (!text) return { ok: false as const, status: 500, error: "Grok: respuesta vacía" };
  return { ok: true as const, text };
}

/**
 * Punto único de entrada. Enruta al proveedor correspondiente.
 */
export async function callProvider(
  req: ProviderRequest,
): Promise<ProviderResponse | ProviderError> {
  const key = envFor(req.provider);
  if (!key) {
    console.error(`[AI] Falta API key para ${req.provider}`);
    return {
      ok: false,
      provider: req.provider,
      model: req.model,
      error: `Falta la API key del proveedor ${req.provider}. Configúrala en los secretos del backend.`,
    };
  }
  try {
    let r;
    if (req.provider === "openai") r = await callOpenAI(req, key);
    else if (req.provider === "gemini") r = await callGemini(req, key);
    else if (req.provider === "claude") r = await callClaude(req, key);
    else r = await callGrok(req, key);

    if (!r.ok) {
      console.error(`[AI] ${req.provider}/${req.model} falló: ${r.error}`);
      return {
        ok: false,
        provider: req.provider,
        model: req.model,
        error: r.error,
        status: r.status,
      };
    }
    console.log(`[AI] ${req.provider}/${req.model} OK textChars=${r.text.length}`);
    return { ok: true, provider: req.provider, model: req.model, text: r.text };
  } catch (e: any) {
    console.error(`[AI] ${req.provider}/${req.model} excepción:`, e?.message);
    return {
      ok: false,
      provider: req.provider,
      model: req.model,
      error:
        e?.name === "AbortError"
          ? "Timeout de generación"
          : e?.message || `Error desconocido contactando ${req.provider}`,
    };
  }
}

/**
 * Limpia respuestas que vienen envueltas en ```json ... ``` (común en Claude/Grok).
 * Si JSON.parse falla, intenta extraer un index.html embebido del texto crudo.
 */
export function extractJson(raw: string): any {
  if (!raw) throw new Error("Respuesta vacía");
  let txt = raw.trim();
  // Quitar fences de markdown
  const fence = txt.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) txt = fence[1].trim();
  // Recortar al primer { y último }
  const start = txt.indexOf("{");
  const end = txt.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    txt = txt.slice(start, end + 1);
    try {
      return JSON.parse(txt);
    } catch (parseErr) {
      console.warn("[AI] JSON.parse falló, intentando extraer HTML del texto crudo");
    }
  }
  // Fallback: la IA devolvió texto sin JSON válido. Intentamos rescatar HTML.
  const htmlMatch = raw.match(/<!doctype html[\s\S]*?<\/html>/i) || raw.match(/<html[\s\S]*?<\/html>/i);
  if (htmlMatch) {
    console.warn("[AI] HTML rescatado del texto crudo (sin JSON envoltorio)");
    return {
      name: "App generada",
      description: "Recuperada del texto crudo de la IA.",
      files: [{ path: "index.html", content: htmlMatch[0], language: "html" }],
      suggestions: [],
    };
  }
  throw new Error("La IA no devolvió JSON ni HTML válido");
}
