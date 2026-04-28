import { useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, Smartphone, RefreshCw, Maximize2 } from "lucide-react";

const SIZES = {
  desktop: { w: "100%", icon: Monitor, label: "Escritorio" },
  tablet: { w: "768px", icon: Tablet, label: "Tablet" },
  mobile: { w: "375px", icon: Smartphone, label: "Móvil" },
} as const;
type Mode = keyof typeof SIZES;

const EMPTY_DOC = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{height:100%;margin:0;background:#ffffff;color:#475569;font-family:ui-sans-serif,system-ui,sans-serif}
  .wrap{height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem}
  .card{max-width:380px}
  h1{font-size:1.1rem;margin:0 0 .5rem;color:#0f172a}
  p{margin:0;font-size:.875rem;color:#64748b}
</style></head><body><div class="wrap"><div class="card"><h1>Vista previa</h1><p>Genera una app desde el chat para verla aquí en tiempo real.</p></div></div></body></html>`;

/**
 * Asegura un documento HTML válido y renderizable.
 * Si la IA devuelve sólo un fragmento, lo envolvemos en un <html> mínimo con fondo claro
 * para evitar pantallas negras o iframes vacíos.
 */
function normalizeHtml(raw: string): string {
  const html = (raw || "").trim();
  if (!html) return EMPTY_DOC;

  const hasDoctype = /^<!doctype/i.test(html);
  const hasHtml = /<html[\s>]/i.test(html);
  const hasBody = /<body[\s>]/i.test(html);

  if (hasDoctype && hasHtml && hasBody) return html;

  // Fragmento → envolver. Garantiza CSS base y fondo claro.
  const wrapped = `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.tailwindcss.com"></script>
<style>html,body{margin:0;background:#ffffff;color:#0f172a;font-family:ui-sans-serif,system-ui,sans-serif;min-height:100vh}</style>
</head><body>${html}</body></html>`;
  return wrapped;
}

export function PreviewPane({ html }: { html: string }) {
  const [mode, setMode] = useState<Mode>("desktop");
  const [key, setKey] = useState(0);
  const ref = useRef<HTMLIFrameElement>(null);

  const srcDoc = useMemo(() => normalizeHtml(html), [html]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border p-2 bg-card/30">
        <div className="flex gap-1">
          {(Object.keys(SIZES) as Mode[]).map((m) => {
            const Icon = SIZES[m].icon;
            return (
              <Button key={m} size="sm" variant={mode === m ? "secondary" : "ghost"} onClick={() => setMode(m)} title={SIZES[m].label}>
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setKey((k) => k + 1)} title="Recargar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => ref.current?.requestFullscreen?.()} title="Pantalla completa">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-muted/30 p-4 flex items-start justify-center">
        <iframe
          key={key}
          ref={ref}
          srcDoc={srcDoc}
          title="Preview"
          sandbox="allow-scripts allow-forms"
          style={{ width: SIZES[mode].w, maxWidth: "100%" }}
          className="h-full min-h-[500px] rounded-lg border border-border bg-white shadow-elevated"
        />
      </div>
    </div>
  );
}