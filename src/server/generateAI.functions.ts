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
  prompt: z.string().min(3).max(12000),
  context: z.string().max(20000).optional(),
  mode: z.enum(["generate", "improve", "fix", "mobile", "optimize", "netlify"]).default("generate"),
  projectId: z.string().uuid().optional(),
  cost: z.number().int().min(1).max(50),
  reason: z.string().min(1).max(120),
});

const SYSTEM_PROMPT = `Eres Nexa One Builder, un generador experto de aplicaciones web standalone en un solo archivo.

Genera SIEMPRE un único archivo HTML completo y autocontenido con HTML, CSS y JavaScript puro (vanilla). NO uses React, Vue, Angular, Supabase, backend, APIs privadas ni frameworks JS. Solo HTML/CSS/JS puro dentro de index.html.
Prioridad absoluta: primero entrega una app mínima funcional y compilable. Si el usuario pide muchas funciones o el prompt es largo, divide internamente en pasos, implementa primero la base estable y después solo mejoras seguras que no rompan la app.

FASES DE GENERACIÓN (aplica siempre en este orden interno):
1. ESTRUCTURA BASE: HTML semántico completo con layout y navegación.
2. UI: Estilos responsive, colores, tipografía y espaciado.
3. FUNCIONALIDADES: Lógica JS, interactividad, formularios, datos.
Nunca saltes a la fase 3 sin que las fases 1 y 2 estén completas y estables.

REGLAS ESTRICTAS:
1. Devuelve SOLO un objeto JSON válido con esta forma exacta:
{
  "name": "Nombre corto del proyecto",
  "description": "Descripción de 1 línea",
  "files": [
    { "path": "index.html", "content": "<!doctype html>...", "language": "html" }
  ],
  "suggestions": ["mejora 1", "mejora 2", "mejora 3"]
}

2. El index.html DEBE incluir estos bloques reales: <!doctype html>, <html>, <head>, <body> y al menos un <script> embebido sin src.
3. Todo el CSS debe ir dentro de <style> o clases inline/Tailwind CDN. Todo el JS debe ir dentro de <script> en el mismo archivo.
4. Diseño moderno, responsive y usable. Botones visibles con estados y acciones reales.
5. Funcional de verdad: JS vanilla embebido que funcione sin errores de sintaxis. NO uses import/export, módulos ES, JSX ni transpilación. No dejes botones sin listener/acción.
6. NO incluyas markdown fences. Devuelve JSON puro.
7. NO uses backticks dentro del HTML que rompan el JSON: usa comillas simples o escapa.
8. Si la app necesita guardar datos, usa localStorage. No uses base de datos ni backend.
9. La respuesta debe contener SOLO files[0].path = "index.html". No generes README, SQL, manifest, netlify ni otros archivos.`;

const MODE_INSTRUCTIONS: Record<string, string> = {
  generate: "Genera la aplicación desde cero según la petición.",
  improve:
    "Mejora visualmente la app actual: tipografía, espaciados, gradientes, micro-interacciones.",
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

/** Valida que el JSON parseado tenga un único index.html completo. */
function validateStandaloneHtml(parsed: any): { ok: true; html: string } | { ok: false; error: string } {
  if (!parsed || !Array.isArray(parsed.files) || parsed.files.length === 0)
    return { ok: false, error: "Respuesta inválida: falta files" };
  if (parsed.files.length !== 1)
    return { ok: false, error: "Respuesta inválida: debe devolver solo index.html" };
  const html = parsed.files.find(
    (f: any) => f && typeof f.path === "string" && f.path === "index.html",
  );
  if (!html || typeof html.content !== "string" || html.content.trim().length < 80)
    return { ok: false, error: "Respuesta inválida: index.html vacío" };
  const content = html.content.trim();
  const required: Array<[RegExp, string]> = [
    [/^\s*<!doctype\s+html>/i, "<!doctype html>"],
    [/<html[\s>]/i, "<html>"],
    [/<head[\s>]/i, "<head>"],
    [/<body[\s>]/i, "<body>"],
    [/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i, "<script> embebido"],
  ];
  for (const [pattern, label] of required) {
    if (!pattern.test(content)) return { ok: false, error: `HTML inválido: falta ${label}` };
  }
  return { ok: true, html: content };
}

function splitPromptIntoSteps(prompt: string): string {
  if (prompt.length < 900) return prompt;
  const chunks = prompt
    .match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [prompt];
  return chunks.map((chunk, i) => `Paso ${i + 1}: ${chunk}`).join("\n");
}

function assertHtmlCompiles(parsed: any): { ok: true } | { ok: false; error: string } {
  const html = parsed?.files?.find((f: any) => f?.path === "index.html")?.content ?? "";
  const scripts = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi));
  for (const script of scripts as RegExpMatchArray[]) {
    const js = script[1].trim();
    if (!js) continue;
    const pairs: Array<[string, string]> = [
      ["(", ")"],
      ["{", "}"],
      ["[", "]"],
    ];
    for (const [open, close] of pairs) {
      const opens = (js.match(new RegExp(`\\${open}`, "g")) ?? []).length;
      const closes = (js.match(new RegExp(`\\${close}`, "g")) ?? []).length;
      if (opens !== closes)
        return { ok: false, error: "JavaScript inválido: delimitadores incompletos" };
    }
    if (/\b(import|export)\s+/m.test(js))
      return { ok: false, error: "JavaScript inválido para HTML standalone" };
  }
  return { ok: true };
}

export const generateAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const primary = data.provider as AIProviderId;
    console.log("[Builder] prompt recibido", { chars: data.prompt.length, mode: data.mode, provider: primary, model: data.model });

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 59_000);

    // 1. Construir el prompt unificado.
    const userMessage = [
      `${MODE_INSTRUCTIONS[data.mode]} Primero crea una base mínima funcional y compilable. Luego integra pasos adicionales solo si no comprometen la estabilidad.`,
      data.context ? `\n\n--- CÓDIGO ACTUAL ---\n${data.context}\n--- FIN ---` : "",
      `\n\nPETICIÓN DEL USUARIO DIVIDIDA EN PASOS INTERNOS:\n${splitPromptIntoSteps(data.prompt)}`,
    ].join("");

    // 2. Cadena de intentos: primario primero, luego el resto como fallback.
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

    try {
      for (const attempt of attemptOrder) {
        if (timeoutController.signal.aborted) break;
        console.log("[Builder] llamada IA iniciada", { provider: attempt.provider, model: attempt.model });
        const aiResp = await callProvider({
          provider: attempt.provider,
          model: attempt.model,
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: userMessage,
          signal: timeoutController.signal,
        });
        if (!aiResp.ok) {
          errors.push(`${attempt.provider}: ${aiResp.error}`);
          continue;
        }
        console.log("[Builder] respuesta recibida", { provider: attempt.provider, model: attempt.model, chars: aiResp.text.length });
        let parsed: any;
        try {
          parsed = extractJson(aiResp.text);
          console.log("[Builder] código extraído", { provider: attempt.provider, files: parsed?.files?.length ?? 0 });
        } catch (e: any) {
          errors.push(`${attempt.provider}: JSON inválido (${e.message})`);
          continue;
        }
        const htmlCheck = validateStandaloneHtml(parsed);
        if (!htmlCheck.ok) {
          errors.push(`${attempt.provider}: ${htmlCheck.error}`);
          continue;
        }
        console.log("[Builder] HTML validado", { provider: attempt.provider, bytes: htmlCheck.html.length });
        const compileCheck = assertHtmlCompiles(parsed);
        if (!compileCheck.ok) {
          errors.push(`${attempt.provider}: ${compileCheck.error}`);
          continue;
        }
        success = { provider: attempt.provider, model: attempt.model, raw: aiResp.text, parsed };
        break;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!success) {
      return {
        ok: false as const,
        error: timeoutController.signal.aborted
          ? "La generación tardó demasiado. Intenta de nuevo o cambia de modelo."
          : `Todos los proveedores fallaron. Detalles: ${errors.slice(0, 4).join(" | ")}`,
        attempts: errors,
        code: timeoutController.signal.aborted
          ? ("TIMEOUT" as const)
          : ("PROVIDERS_FAILED" as const),
      };
    }

    // 3. Cobrar solo después de obtener código válido y compilable.
    const { data: consumed, error: consumeErr } = await supabase.rpc("consume_credits", {
      _amount: data.cost,
      _reason: `${data.reason} · ${success.provider}/${success.model}`,
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
