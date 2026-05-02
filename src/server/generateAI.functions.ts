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

/** Prompt para apps simples (HTML/CSS/JS en un solo archivo). */
const SYSTEM_PROMPT_FAST = `Eres Nexa One Builder, generador de apps web standalone en un solo archivo.

Genera un único index.html completo y autocontenido con HTML, CSS y JavaScript puro (vanilla). NO uses React, Vue, Angular, backend ni frameworks. Solo HTML/CSS/JS dentro de index.html.
Prioriza funcionalidad real, UI profesional y código completo. Nada de maquetas vacías. Ningún botón sin listener/acción.

REGLAS ESTRICTAS:
1. Devuelve SOLO un objeto JSON válido con esta forma:
{
  "name": "Nombre corto",
  "description": "Descripción 1 línea",
  "mode": "fast",
  "files": [
    { "path": "index.html", "content": "<!doctype html>...", "language": "html" }
  ],
  "suggestions": ["mejora 1", "mejora 2", "mejora 3"]
}
2. index.html DEBE contener: <!doctype html>, <html>, <head>, <body>, al menos un <style> con CSS real y al menos un <script> embebido sin src con JS funcional.
3. NO uses import/export ni módulos ES. NO uses backticks que rompan el JSON.
4. Persistencia con localStorage si hace falta. Sin backend.
5. Sin markdown fences. JSON puro.
6. files debe contener SOLO index.html.`;

/** Prompt para apps PRO (estructura tipo proyecto, multi-archivo). */
const SYSTEM_PROMPT_PRO = `Eres Nexa One Builder PRO, generador de aplicaciones profesionales tipo SaaS / PWA / Play Store.

Genera una aplicación completa y avanzada con estructura de proyecto real (multi-archivo) según la petición del usuario. Prioriza funcionalidad real, UI profesional, código completo y producción-ready. Nada de maquetas. Ningún botón sin acción real.

Stack recomendado: React + TypeScript + Vite. Puedes usar Tailwind, Supabase, PWA manifest y SQL si la app lo requiere. Si el usuario pide otro stack, respétalo.

REGLAS ESTRICTAS:
1. Devuelve SOLO un objeto JSON válido con esta forma:
{
  "name": "Nombre del proyecto",
  "description": "Descripción 1-2 líneas",
  "mode": "pro",
  "files": [
    { "path": "package.json", "content": "...", "language": "json" },
    { "path": "index.html", "content": "...", "language": "html" },
    { "path": "src/main.tsx", "content": "...", "language": "tsx" },
    { "path": "src/App.tsx", "content": "...", "language": "tsx" },
    { "path": "manifest.json", "content": "...", "language": "json" },
    { "path": "README.md", "content": "...", "language": "md" }
  ],
  "suggestions": ["mejora 1", "mejora 2", "mejora 3"]
}
2. files DEBE incluir como mínimo: package.json, index.html y (src/App.tsx o src/main.tsx). Añade los demás archivos que la app necesite (rutas, componentes, schema.sql si usa Supabase, manifest.json si es PWA, README.md, etc.).
3. Código completo y funcional, sin TODOs ni "..." de relleno. Implementa toda la lógica pedida.
4. UI profesional, responsive, accesible. Botones con acciones reales conectadas.
5. Sin markdown fences. JSON puro. Escapa correctamente comillas y saltos de línea dentro de los strings de content.`;

/** Heurística: decide si el prompt requiere modo PRO. */
function detectMode(prompt: string, mode: string): "fast" | "pro" {
  if (mode !== "generate") return "fast"; // improve/fix/etc. operan sobre lo existente
  const p = prompt.toLowerCase();
  const proKeywords = [
    "saas", "login", "auth", "supabase", "pwa", "play store", "playstore",
    "dashboard", "pago", "pagos", "checkout", "stripe", "mercadopago",
    "admin", "marketplace", "profesional", "react", "vite", "next",
    "multi-página", "multi pagina", "multipágina", "rutas", "router",
    "base de datos", "database", "api rest", "backend", "crud completo",
  ];
  return proKeywords.some((k) => p.includes(k)) ? "pro" : "fast";
}

const MODE_INSTRUCTIONS: Record<string, string> = {
  generate: "Genera la aplicación desde cero según la petición.",
  improve:
    "Mejora visualmente la app actual: tipografía, espaciados, gradientes, micro-interacciones.",
  fix: "Detecta y corrige TODOS los errores de JavaScript, HTML o CSS en el código actual. Devuelve el index.html completo reparado.",
  mobile: "Optimiza la app para móvil: layout responsive, touch targets >=44px.",
  optimize: "Optimiza el rendimiento y la accesibilidad sin cambiar la funcionalidad.",
  netlify: "Ajusta el index.html para que sea una app estática lista para deploy, sin añadir archivos extra.",
};

/** Modelo por defecto de cada proveedor para la cadena de fallback. */
const FALLBACK_MODEL: Record<AIProviderId, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-1.5-flash",
  claude: "claude-3-5-sonnet-latest",
  grok: "grok-beta",
};
const ALL_PROVIDERS: AIProviderId[] = ["openai", "gemini", "claude", "grok"];

/** Valida que el JSON parseado tenga un único index.html completo (modo rápido). */
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
    [/<style[\s>][\s\S]*?<\/style>/i, "<style>"],
    [/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i, "<script> embebido"],
  ];
  for (const [pattern, label] of required) {
    if (!pattern.test(content)) return { ok: false, error: `HTML inválido: falta ${label}` };
  }
  return { ok: true, html: content };
}

/** Valida que el JSON parseado tenga estructura mínima de proyecto PRO. */
function validateProProject(parsed: any): { ok: true } | { ok: false; error: string } {
  if (!parsed || !Array.isArray(parsed.files) || parsed.files.length < 2)
    return { ok: false, error: "Respuesta PRO inválida: faltan archivos del proyecto" };
  const paths = parsed.files
    .map((f: any) => (typeof f?.path === "string" ? f.path : ""))
    .filter(Boolean);
  const hasPkg = paths.includes("package.json");
  const hasIndex = paths.includes("index.html");
  const hasEntry = paths.some((p: string) => p === "src/App.tsx" || p === "src/main.tsx");
  if (!hasPkg) return { ok: false, error: "Respuesta PRO inválida: falta package.json" };
  if (!hasIndex) return { ok: false, error: "Respuesta PRO inválida: falta index.html" };
  if (!hasEntry)
    return { ok: false, error: "Respuesta PRO inválida: falta src/App.tsx o src/main.tsx" };
  for (const f of parsed.files) {
    if (!f || typeof f.content !== "string" || f.content.trim().length < 10)
      return { ok: false, error: `Respuesta PRO inválida: archivo vacío (${f?.path})` };
  }
  return { ok: true };
}

function splitPromptIntoSteps(prompt: string): string {
  if (prompt.length < 900) return prompt;
  const chunks = prompt
    .match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [prompt];
  return chunks.map((chunk, i) => `Paso ${i + 1}: ${chunk}`).join("\n");
}

function hasBalancedDelimiters(js: string): boolean {
  const stack: string[] = [];
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  let quote: "'" | '"' | null = null;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < js.length; i += 1) {
    const ch = js[i];
    const next = js[i + 1];
    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i += 1; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (pairs[ch]) stack.push(pairs[ch]);
    else if ((ch === ")" || ch === "}" || ch === "]") && stack.pop() !== ch) return false;
  }
  return stack.length === 0 && !quote && !blockComment;
}

function assertHtmlCompiles(parsed: any): { ok: true } | { ok: false; error: string } {
  const html = parsed?.files?.find((f: any) => f?.path === "index.html")?.content ?? "";
  const scripts = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi));
  for (const script of scripts as RegExpMatchArray[]) {
    const js = script[1].trim();
    if (!js) continue;
    if (/\b(import|export)\s+/m.test(js))
      return { ok: false, error: "JavaScript inválido para HTML standalone" };
    if (!hasBalancedDelimiters(js))
      return { ok: false, error: "JavaScript inválido: delimitadores incompletos" };
  }
  return { ok: true };
}

export const generateAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as { supabase: any; userId: string; claims?: any };
    const primary = data.provider as AIProviderId;
    const buildMode = detectMode(data.prompt, data.mode);
    const SYSTEM_PROMPT = buildMode === "pro" ? SYSTEM_PROMPT_PRO : SYSTEM_PROMPT_FAST;
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    const isTestAdmin = [claims?.email, profile?.email]
      .some((email) => String(email || "").toLowerCase() === "nexaapporg@gmail.com");
    console.log("[Builder] prompt recibido", { chars: data.prompt.length, mode: data.mode, buildMode, provider: primary, model: data.model });

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 59_000);

    // 1. Construir el prompt unificado.
    const proHint =
      buildMode === "pro"
        ? " Genera una aplicación profesional completa con estructura multi-archivo, código real y funcionalidad end-to-end. NO entregues una maqueta."
        : " Genera una app simple y funcional en un único index.html, con UI profesional y lógica real.";
    const userMessage = [
      `${MODE_INSTRUCTIONS[data.mode]}${proHint}`,
      data.context ? `\n\n--- CÓDIGO ACTUAL ---\n${data.context}\n--- FIN ---` : "",
      `\n\nPETICIÓN DEL USUARIO:\n${splitPromptIntoSteps(data.prompt)}`,
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
        if (buildMode === "fast") {
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
        } else {
          const proCheck = validateProProject(parsed);
          if (!proCheck.ok) {
            errors.push(`${attempt.provider}: ${proCheck.error}`);
            continue;
          }
          console.log("[Builder] proyecto PRO validado", { provider: attempt.provider, files: parsed.files.length });
          // No degradamos a modo rápido: si PRO falla en todos los proveedores, devolvemos error.
        }
        success = { provider: attempt.provider, model: attempt.model, raw: aiResp.text, parsed };
        break;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!success) {
      console.error("[Builder] error si falla", {
        timeout: timeoutController.signal.aborted,
        errors: errors.slice(0, 4),
      });
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

    // 3. Cobrar solo después de obtener código válido y compilable. Admin test registra sin limitar.
    if (isTestAdmin) {
      await supabase.from("credit_transactions").insert({
        user_id: userId,
        amount: 0,
        reason: `${data.reason} · ${success.provider}/${success.model} (admin test)`,
      });
    } else {
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
    }

    // 4. Persistir generación.
    await supabase.from("generations").insert({
      user_id: userId,
      project_id: data.projectId ?? null,
      prompt: data.prompt,
      response_summary: success.parsed.description || null,
      response_full: success.raw.slice(0, 20000),
      cost: isTestAdmin ? 0 : data.cost,
      model: success.model,
      provider: success.provider,
    });

    return {
      ok: true as const,
      name: success.parsed.name || "App generada",
      description: success.parsed.description || "",
      mode: buildMode,
      files: success.parsed.files,
      suggestions: Array.isArray(success.parsed.suggestions) ? success.parsed.suggestions : [],
      provider: success.provider,
      model: success.model,
      fallbackUsed: success.provider !== primary,
      attemptedErrors: errors,
    };
  });
