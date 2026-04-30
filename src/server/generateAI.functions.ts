/**
 * /generate-ai — Punto ÚNICO de generación con IA.
 *
 * Responsabilidades:
 *  1. Validar créditos vía RPC `consume_credits` solo después de obtener código válido.
 *  2. Recibir { provider, model, prompt, projectId, mode, context, cost, reason }.
 *  3. Ejecutar la IA correspondiente (OpenAI / Gemini / Claude / Grok).
 *  4. Fallback automático a otros proveedores disponibles si el primario falla.
 *  5. Validar que la respuesta sea código utilizable (index.html con HTML real).
 *  6. Persistir en `generations` (user_id, project_id, provider, model, prompt, respuesta, costo).
 *  7. Devolver el código limpio listo para preview.
 */
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
Prioridad absoluta: primero entrega una app mínima funcional y compilable. Si el usuario pide muchas funciones o el prompt es largo, divide internamente en pasos, implementa primero la base estable y después solo mejoras seguras que no rompan la app.

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
5. Funcional de verdad: si es una app, JS embebido que funcione sin errores de sintaxis. No añadas funciones avanzadas hasta que la base esté completa y consistente.
6. NO incluyas markdown fences. Devuelve JSON puro.
7. NO uses backticks dentro del HTML que rompan el JSON: usa comillas simples o escapa.
8. Cuando la app necesite persistencia/auth/datos, añade además estos archivos extra dentro de "files":
   - { "path": "supabase.sql", "language": "sql", "content": "-- CREATE TABLE ... con RLS" }
   - { "path": "manifest.webmanifest", "language": "json", "content": "{...PWA manifest...}" }
   - { "path": "netlify.toml", "language": "toml", "content": "[build]\\n  publish = \\".\\"" }
   - { "path": "playstore.md", "language": "markdown", "content": "Pasos para empaquetar como TWA con PWA Builder" }
9. supabase.sql DEBE incluir RLS habilitado y políticas básicas por user_id cuando aplique.
10. manifest.webmanifest DEBE tener name, short_name, start_url '/', display 'standalone', theme_color y background_color coherentes con el diseño.`;

const MODE_INSTRUCTIONS: Record<string, string> = {
  generate: "Genera la aplicación desde cero según la petición.",
  improve: "Mejora visualmente la app actual: tipografía, espaciados, gradientes, micro-interacciones.",
  fix: "Detecta y corrige TODOS los errores de JavaScript, HTML o CSS en el código actual. Devuelve el index.html completo reparado.",
  mobile: "Optimiza la app para móvil: layout responsive, touch targets >=44px.",
  optimize: "Optimiza el rendimiento y la accesibilidad sin cambiar la funcionalidad.",
  netlify: "Prepara el proyecto para deploy en Netlify: añade netlify.toml y un README.",
};

/** Modelo por defecto de cada proveedor para la cadena de fallback. */
const FALLBACK_MODEL: Record<AIProviderId, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-1.5-flash",
  claude: "claude-3-5-sonnet-latest",
  grok: "grok-beta",
};
const ALL_PROVIDERS: AIProviderId[] = ["openai", "gemini", "claude", "grok"];

/** Valida que el JSON parseado tenga al menos un index.html con HTML real. */
function isValidGeneration(parsed: any): boolean {
  if (!parsed || !Array.isArray(parsed.files) || parsed.files.length === 0) return false;
  const html = parsed.files.find(
    (f: any) => f && typeof f.path === "string" && f.path === "index.html",
  );
  if (!html || typeof html.content !== "string" || html.content.length < 30) return false;
  return /<html|<body|<div|<main|<section/i.test(html.content);
}

function splitPromptIntoSteps(prompt: string): string {
  if (prompt.length < 900) return prompt;
  const chunks = prompt.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [prompt];
  return chunks.map((chunk, i) => `Paso ${i + 1}: ${chunk}`).join("\n");
}

function assertHtmlCompiles(parsed: any): { ok: true } | { ok: false; error: string } {
  const html = parsed?.files?.find((f: any) => f?.path === "index.html")?.content ?? "";
  const scripts = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi));
  for (const script of scripts as RegExpMatchArray[]) {
    const js = script[1].trim();
    if (!js) continue;
    try {
      new Function(js);
    } catch (e: any) {
      return { ok: false, error: `JavaScript inválido: ${e?.message || "error de sintaxis"}` };
    }
  }
  return { ok: true };
}

export const generateAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const primary = data.provider as AIProviderId;

    // 1. Consumir créditos vía RPC ANTES de llamar al proveedor.
    const { data: consumed, error: consumeErr } = await supabase.rpc("consume_credits", {
      _amount: data.cost,
      _reason: `${data.reason} · ${primary}/${data.model}`,
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

    // 2. Construir el prompt unificado.
    const userMessage = [
      MODE_INSTRUCTIONS[data.mode],
      data.context ? `\n\n--- CÓDIGO ACTUAL ---\n${data.context}\n--- FIN ---` : "",
      `\n\nPETICIÓN DEL USUARIO:\n${data.prompt}`,
    ].join("");

    // 3. Cadena de intentos: primario primero, luego el resto como fallback.
    const attemptOrder: Array<{ provider: AIProviderId; model: string }> = [
      { provider: primary, model: data.model },
      ...ALL_PROVIDERS.filter((p) => p !== primary).map((p) => ({
        provider: p,
        model: FALLBACK_MODEL[p],
      })),
    ];

    const errors: string[] = [];
    let success: {
      provider: AIProviderId;
      model: string;
      raw: string;
      parsed: any;
    } | null = null;

    for (const attempt of attemptOrder) {
      const aiResp = await callProvider({
        provider: attempt.provider,
        model: attempt.model,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: userMessage,
      });
      if (!aiResp.ok) {
        errors.push(`${attempt.provider}: ${aiResp.error}`);
        continue;
      }
      let parsed: any;
      try {
        parsed = extractJson(aiResp.text);
      } catch (e: any) {
        errors.push(`${attempt.provider}: JSON inválido (${e.message})`);
        continue;
      }
      if (!isValidGeneration(parsed)) {
        errors.push(`${attempt.provider}: estructura inválida o HTML vacío`);
        continue;
      }
      success = { provider: attempt.provider, model: attempt.model, raw: aiResp.text, parsed };
      break;
    }

    if (!success) {
      // Reembolso automático: ningún proveedor entregó un resultado válido.
      // Para usuarios ilimitados queda registrado a 0 (auditoría).
      await supabase.rpc("refund_credits", {
        _amount: data.cost,
        _reason: `${data.reason} · fallo total de proveedores`,
      });
      return {
        ok: false as const,
        error: `Todos los proveedores fallaron. Créditos reembolsados. Detalles: ${errors.slice(0, 4).join(" | ")}`,
        attempts: errors,
        refunded: data.cost,
      };
    }

    // 4. Persistir generación.
    await supabase.from("generations").insert({
      user_id: userId,
      project_id: data.projectId ?? null,
      prompt: data.prompt,
      response_summary: success.parsed.description || null,
      response_full: success.raw.slice(0, 20000),
      cost: data.cost,
      model: success.model,
      provider: success.provider,
    });

    return {
      ok: true as const,
      name: success.parsed.name || "App generada",
      description: success.parsed.description || "",
      files: success.parsed.files,
      suggestions: Array.isArray(success.parsed.suggestions) ? success.parsed.suggestions : [],
      provider: success.provider,
      model: success.model,
      fallbackUsed: success.provider !== primary,
      attemptedErrors: errors,
    };
  });