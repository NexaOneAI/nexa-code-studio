import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callProvider, extractJson, type AIProviderId } from "./aiProviderService.server";

const InputSchema = z.object({
  provider: z.enum(["openai", "gemini", "claude", "grok"]),
  model: z.string().min(1).max(80),
  prompt: z.string().min(3).max(4000),
  context: z.string().max(20000).optional(),
  mode: z.enum(["generate", "improve", "fix", "mobile", "optimize", "netlify"]).default("generate"),
  projectId: z.string().uuid().optional(),
  cost: z.number().int().min(1).max(50),
  reason: z.string().min(1).max(120),
});

const SYSTEM_PROMPT = `Eres Nexa One Builder, un generador experto de aplicaciones web standalone.

Genera SIEMPRE un único archivo HTML completo y autocontenido, listo para abrirse en un navegador.

REGLAS ESTRICTAS:
1. Devuelve SOLO un objeto JSON válido con esta forma exacta:
{
  "name": "Nombre corto del proyecto",
  "description": "Descripción de 1 línea",
  "files": [
    { "path": "index.html", "content": "<!doctype html>...", "language": "html" },
    { "path": "README.md", "content": "...", "language": "markdown" }
  ],
  "suggestions": ["mejora 1", "mejora 2", "mejora 3"]
}

2. El index.html DEBE ser un documento completo, con <html>, <head>, <body>.
3. Usa Tailwind CDN: <script src="https://cdn.tailwindcss.com"></script>.
4. Diseño moderno, responsive, oscuro premium con acentos azul/morado.
5. Funcional de verdad: si es una app, JS embebido que funcione.
6. NO incluyas markdown fences. Devuelve JSON puro.
7. NO uses backticks dentro del HTML que rompan el JSON: usa comillas simples o escapa.`;

const MODE_INSTRUCTIONS: Record<string, string> = {
  generate: "Genera la aplicación desde cero según la petición.",
  improve: "Mejora visualmente la app actual: tipografía, espaciados, gradientes, micro-interacciones.",
  fix: "Detecta y corrige errores de JavaScript, HTML o CSS en el código actual.",
  mobile: "Optimiza la app para móvil: layout responsive, touch targets >=44px.",
  optimize: "Optimiza el rendimiento y la accesibilidad sin cambiar la funcionalidad.",
  netlify: "Prepara el proyecto para deploy en Netlify: añade netlify.toml y un README.",
};

export const generateWithProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const provider = data.provider as AIProviderId;

    // 1. Consumir créditos vía RPC ANTES de llamar al proveedor.
    const { data: consumed, error: consumeErr } = await supabase.rpc("consume_credits", {
      _amount: data.cost,
      _reason: `${data.reason} · ${provider}/${data.model}`,
    });
    if (consumeErr) {
      return { ok: false as const, error: `No se pudo consumir créditos: ${consumeErr.message}` };
    }
    if (!consumed) {
      return {
        ok: false as const,
        error: "Créditos insuficientes",
        code: "INSUFFICIENT_CREDITS" as const,
      };
    }

    // 2. Construir el prompt y llamar al proveedor.
    const userMessage = [
      MODE_INSTRUCTIONS[data.mode],
      data.context ? `\n\n--- CÓDIGO ACTUAL ---\n${data.context}\n--- FIN ---` : "",
      `\n\nPETICIÓN DEL USUARIO:\n${data.prompt}`,
    ].join("");

    const aiResp = await callProvider({
      provider,
      model: data.model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userMessage,
    });

    if (!aiResp.ok) {
      // Reembolso opcional: registrar fallo (no devolvemos créditos automáticamente
      // para evitar abuso; admin puede recargar si fue genuino).
      return { ok: false as const, error: aiResp.error, provider, model: data.model };
    }

    // 3. Parsear la respuesta JSON.
    let parsed: any;
    try {
      parsed = extractJson(aiResp.text);
    } catch (e: any) {
      return {
        ok: false as const,
        error: `${provider} no devolvió JSON válido: ${e.message}`,
        provider,
        model: data.model,
      };
    }

    if (!parsed.files || !Array.isArray(parsed.files) || parsed.files.length === 0) {
      return { ok: false as const, error: "Estructura inválida: falta 'files'", provider, model: data.model };
    }

    // 4. Registrar la generación.
    await supabase.from("generations").insert({
      user_id: userId,
      project_id: data.projectId ?? null,
      prompt: data.prompt,
      response_summary: parsed.description || null,
      response_full: aiResp.text.slice(0, 20000),
      cost: data.cost,
      model: data.model,
      provider,
    });

    return {
      ok: true as const,
      name: parsed.name || "App generada",
      description: parsed.description || "",
      files: parsed.files,
      suggestions: parsed.suggestions || [],
      provider,
      model: data.model,
    };
  });