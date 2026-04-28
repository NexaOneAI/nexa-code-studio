import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
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
6. NO incluyas markdown fences \`\`\`. Devuelve JSON puro.
7. NO uses backticks dentro del HTML que rompan el JSON: usa comillas simples o escapa.`;

const MODE_INSTRUCTIONS: Record<string, string> = {
  generate: "Genera la aplicación desde cero según la petición.",
  improve: "Mejora visualmente la app actual: tipografía, espaciados, gradientes, micro-interacciones.",
  fix: "Detecta y corrige errores de JavaScript, HTML o CSS en el código actual.",
  mobile: "Optimiza la app para móvil: layout responsive, touch targets >=44px, navegación móvil.",
  optimize: "Optimiza el rendimiento y la accesibilidad sin cambiar la funcionalidad.",
  netlify: "Prepara el proyecto para deploy en Netlify: añade netlify.toml y un README de despliegue.",
};

export const generateApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    // 1. Descontar créditos atómicamente vía RPC ANTES de llamar a OpenAI.
    const { data: consumed, error: consumeErr } = await supabase.rpc("consume_credits", {
      _amount: data.cost,
      _reason: data.reason,
    });
    if (consumeErr) {
      return { ok: false as const, error: `No se pudo consumir créditos: ${consumeErr.message}` };
    }
    if (!consumed) {
      return {
        ok: false as const,
        error: "Créditos insuficientes para esta acción.",
        code: "INSUFFICIENT_CREDITS" as const,
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "OPENAI_API_KEY no está configurada en el servidor." };
    }

    const userMessage = [
      MODE_INSTRUCTIONS[data.mode],
      data.context ? `\n\n--- CÓDIGO ACTUAL ---\n${data.context}\n--- FIN ---` : "",
      `\n\nPETICIÓN DEL USUARIO:\n${data.prompt}`,
    ].join("");

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("OpenAI error:", res.status, text);
        return { ok: false as const, error: `OpenAI API ${res.status}: ${text.slice(0, 200)}` };
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) return { ok: false as const, error: "Respuesta vacía de OpenAI" };

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        return { ok: false as const, error: "La IA no devolvió JSON válido" };
      }

      if (!parsed.files || !Array.isArray(parsed.files) || parsed.files.length === 0) {
        return { ok: false as const, error: "Estructura inválida: falta 'files'" };
      }

      // 2. Registrar la generación en la tabla `generations`.
      await supabase.from("generations").insert({
        user_id: userId,
        project_id: data.projectId ?? null,
        prompt: data.prompt,
        response_summary: parsed.description || null,
        cost: data.cost,
        model: "gpt-4o-mini",
      });

      return {
        ok: true as const,
        name: parsed.name || "App generada",
        description: parsed.description || "",
        files: parsed.files,
        suggestions: parsed.suggestions || [],
        model: "gpt-4o-mini",
      };
    } catch (e: any) {
      console.error("generateApp failed", e);
      return { ok: false as const, error: e?.message || "Error desconocido" };
    }
  });