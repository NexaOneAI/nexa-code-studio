import { useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, Smartphone, RefreshCw, Maximize2 } from "lucide-react";

const SIZES = {
  desktop: { w: "100%", icon: Monitor, label: "Escritorio" },
  tablet: { w: "768px", icon: Tablet, label: "Tablet" },
  mobile: { w: "375px", icon: Smartphone, label: "Móvil" },
} as const;
type Mode = keyof typeof SIZES;

export function PreviewPane({ html }: { html: string }) {
  const [mode, setMode] = useState<Mode>("desktop");
  const [key, setKey] = useState(0);
  const ref = useRef<HTMLIFrameElement>(null);

  const srcDoc = useMemo(() => html || "<html><body style='background:#0b0b1a;color:#888;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><div>Vista previa aparecerá aquí</div></body></html>", [html]);

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