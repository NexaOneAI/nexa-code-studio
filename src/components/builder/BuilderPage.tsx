import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Group, Panel as RawPanel, Separator } from "react-resizable-panels";
const PanelGroup = Group as any;
const Panel = RawPanel as any;
const PanelResizeHandle = Separator as any;
import { PreviewPane } from "./PreviewPane";
import { CodeEditor, FileItem } from "./CodeEditor";
import { exportProjectZip } from "@/lib/exportZip";
import { Sparkles, Wand2, Bug, Smartphone, Zap, Rocket, Download, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { CREDIT_COSTS, CreditAction } from "@/lib/credit-costs";
import { localStore } from "@/lib/local-store";
import { projectsService } from "@/services/projects.service";
import { generateLocal } from "@/lib/local-generator";
import { generateApp } from "@/server/generateApp.functions";
import { creditsService } from "@/services/credits.service";
import { CREDIT_LABELS } from "@/lib/credit-costs";

interface Msg { role: "user" | "ai"; content: string; }

/**
 * Valida que el resultado de la IA sea un set de archivos utilizable.
 * Lanza Error con mensaje claro si algo está roto.
 */
function validateGeneratedFiles(files: any[]): FileItem[] {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("La IA no devolvió archivos.");
  }
  const valid: FileItem[] = [];
  for (const f of files) {
    if (!f || typeof f.path !== "string" || typeof f.content !== "string") continue;
    if (f.content.length === 0) continue;
    valid.push({
      path: f.path,
      content: f.content,
      language: typeof f.language === "string" ? f.language : "html",
    });
  }
  if (valid.length === 0) throw new Error("Todos los archivos generados estaban vacíos o malformados.");
  const html = valid.find((f) => f.path === "index.html");
  if (!html) throw new Error("Falta el archivo index.html en la generación.");
  // Sanity check mínimo: que contenga contenido HTML.
  if (!/<html|<body|<div|<main|<section/i.test(html.content)) {
    throw new Error("El index.html generado no contiene HTML válido.");
  }
  return valid;
}

const SUGGESTIONS = [
  "Una landing page de SaaS para una app de productividad",
  "Una calculadora de propinas moderna",
  "Un dashboard con 3 KPIs y un gráfico",
  "Una agenda de contactos con buscador",
  "Un POS simple con carrito",
];

export function BuilderPage({ projectId }: { projectId?: string } = {}) {
  const { consume, balance, unlimited, refresh } = useCredits();
  const nav = useNavigate();

  const [name, setName] = useState("Mi proyecto");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Cargar proyecto existente vía service (Supabase si hay sesión, si no local)
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    projectsService.get(projectId).then((proj) => {
      if (!alive || !proj) return;
      setName(proj.name);
      setFiles(proj.files);
      setCurrentProjectId(proj.id);
    });
    return () => { alive = false; };
  }, [projectId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const html = files.find((f) => f.path === "index.html")?.content || "";

  const persistProject = async (n: string, fs: FileItem[], p: string, description?: string) => {
    const id = await projectsService.save({
      id: currentProjectId,
      name: n,
      description: description ?? null,
      prompt: p,
      files: fs,
    });
    if (!currentProjectId) setCurrentProjectId(id);
    return id;
  };

  const runAction = async (
    mode: "generate" | "improve" | "fix" | "mobile" | "optimize" | "netlify",
    action: CreditAction,
    userPrompt?: string,
  ) => {
    const finalPrompt = userPrompt ?? prompt;
    if (!finalPrompt.trim() && mode === "generate") {
      toast.error("Escribe qué quieres construir");
      return;
    }

    const cost = CREDIT_COSTS[action];
    // Bloqueo client-side: si no hay créditos y no es ilimitado, no llamar a la IA.
    if (!unlimited && balance < cost) {
      toast.error("Créditos insuficientes", {
        description: `Necesitas ${cost} créditos para "${CREDIT_LABELS[action]}". Tienes ${balance}.`,
      });
      return;
    }

    setLoading(true);
    setMessages((m) => [...m, { role: "user", content: finalPrompt || `Acción: ${mode}` }]);

    try {
      const useRemote = await creditsService.isLocal().then((local) => !local);
      const currentHtml = files.find((f) => f.path === "index.html")?.content;

      let result: {
        name: string;
        description: string;
        files: FileItem[];
        suggestions: string[];
        model: string;
      };

      if (useRemote) {
        // Servidor: descuenta créditos vía RPC + llama a OpenAI + registra generación.
        const resp = await generateApp({
          data: {
            prompt: finalPrompt || `Acción: ${mode}`,
            mode,
            context: currentHtml,
            projectId: currentProjectId,
            cost,
            reason: CREDIT_LABELS[action],
          },
        });
        if (!resp.ok) {
          toast.error("Generación falló", { description: resp.error });
          setMessages((m) => [...m, { role: "ai", content: `❌ ${resp.error}` }]);
          await refresh();
          return;
        }
        result = {
          name: resp.name,
          description: resp.description,
          files: resp.files as FileItem[],
          suggestions: resp.suggestions,
          model: resp.model,
        };
        await refresh();
      } else {
        // Modo local: descuenta vía store local + generador de plantillas.
        const ok = await consume(action);
        if (!ok) return;
        await new Promise((r) => setTimeout(r, 250));
        result = generateLocal(finalPrompt || mode, mode, currentHtml);
        localStore.recordGeneration({
          project_id: currentProjectId ?? "local",
          prompt: finalPrompt,
          response_summary: result.description,
          cost,
          model: result.model,
        });
      }

      // Para acciones distintas a "generate" preservamos los archivos existentes y
      // sólo sustituimos los modificados.
      let newFiles: FileItem[];
      if (mode === "generate") {
        newFiles = result.files;
        setName(result.name);
      } else {
        const map = new Map(files.map((f) => [f.path, f]));
        for (const nf of result.files) map.set(nf.path, nf);
        newFiles = Array.from(map.values());
      }
      setFiles(newFiles);

      setMessages((m) => [
        ...m,
        {
          role: "ai",
          content: `✅ ${result.description}${
            result.suggestions.length
              ? "\n\n**Sugerencias:**\n" + result.suggestions.map((s) => `• ${s}`).join("\n")
              : ""
          }`,
        },
      ]);

      const pid = await persistProject(
        mode === "generate" ? result.name : name,
        newFiles,
        finalPrompt,
        result.description,
      );
      if (!projectId && mode === "generate") {
        nav({ to: "/builder/$projectId", params: { projectId: pid } });
      }
      setPrompt("");
      toast.success("Generación completada");
    } catch (e: any) {
      toast.error("Error", { description: e?.message || "Falló la generación" });
      setMessages((m) => [...m, { role: "ai", content: `❌ ${e?.message || "Error desconocido"}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (path: string, content: string) => {
    setFiles((fs) => fs.map((f) => (f.path === path ? { ...f, content } : f)));
  };

  const handleSave = async () => {
    if (files.length === 0) return;
    try {
      await persistProject(name, files, prompt);
      toast.success("Cambios guardados");
    } catch (e: any) {
      toast.error("No se pudo guardar", { description: e?.message });
    }
  };

  const handleExport = async () => {
    if (files.length === 0) {
      toast.error("Genera una app primero");
      return;
    }
    const ok = await consume("export_zip");
    if (!ok) return;
    await exportProjectZip(name, files);
    toast.success("ZIP descargado");
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="border-b border-border p-3 flex items-center gap-2 bg-card/30">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={handleSave}
          className="max-w-xs h-8 text-sm font-medium bg-transparent border-border" />
        <div className="ml-auto flex flex-wrap gap-1.5">
          <ActBtn icon={Wand2} label="Mejorar" cost={CREDIT_COSTS.visual_change} onClick={() => runAction("improve", "visual_change", "Mejora visualmente la app")} disabled={loading || files.length === 0} />
          <ActBtn icon={Bug} label="Corregir" cost={CREDIT_COSTS.fix_errors} onClick={() => runAction("fix", "fix_errors", "Detecta y corrige errores")} disabled={loading || files.length === 0} />
          <ActBtn icon={Smartphone} label="Móvil" cost={CREDIT_COSTS.feature_medium} onClick={() => runAction("mobile", "feature_medium", "Optimiza para móvil")} disabled={loading || files.length === 0} />
          <ActBtn icon={Zap} label="Optimizar" cost={CREDIT_COSTS.visual_change} onClick={() => runAction("optimize", "visual_change", "Optimiza rendimiento y accesibilidad")} disabled={loading || files.length === 0} />
          <ActBtn icon={Rocket} label="Netlify" cost={CREDIT_COSTS.visual_change} onClick={() => runAction("netlify", "visual_change", "Prepara para Netlify")} disabled={loading || files.length === 0} />
          <Button size="sm" onClick={handleExport} disabled={loading || files.length === 0} variant="outline">
            <Download className="h-3.5 w-3.5 mr-1" /> ZIP <span className="ml-1 text-[10px] opacity-60">{CREDIT_COSTS.export_zip}c</span>
          </Button>
        </div>
      </div>

      <PanelGroup direction="horizontal" className="flex-1 flex">
        {/* Chat */}
        <Panel defaultSize={28} minSize={20}>
          <div className="flex flex-col h-full bg-card/20">
            <div className="border-b border-border p-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Chat IA</span>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Sugerencias:</p>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => setPrompt(s)}
                      className="block w-full text-left rounded-lg border border-border bg-background/50 p-2 text-xs hover:border-primary/50 transition">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`rounded-lg p-3 text-sm ${m.role === "user" ? "bg-primary/10 border border-primary/20" : "bg-background/50 border border-border"}`}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{m.role === "user" ? "Tú" : "Nexa AI"}</div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
              {loading && (
                <div className="rounded-lg bg-background/50 border border-border p-3 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Nexa está construyendo...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-border p-3 space-y-2">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe la app que quieres crear..."
                rows={3} className="resize-none text-sm"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runAction("generate", files.length ? "generation_simple" : "full_app"); }} />
              <Button onClick={() => runAction("generate", files.length ? "generation_simple" : "full_app")}
                disabled={loading || !prompt.trim()} className="w-full bg-gradient-primary border-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Generar ({files.length ? CREDIT_COSTS.generation_simple : CREDIT_COSTS.full_app}c)</>}
              </Button>
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="w-px bg-border hover:bg-primary/50 transition" />
        {/* Preview */}
        <Panel defaultSize={40} minSize={25}>
          <PreviewPane html={html} />
        </Panel>
        <PanelResizeHandle className="w-px bg-border hover:bg-primary/50 transition" />
        {/* Editor */}
        <Panel defaultSize={32} minSize={20}>
          <CodeEditor files={files} onChange={handleFileChange} onSave={handleSave} />
        </Panel>
      </PanelGroup>
    </div>
  );
}

function ActBtn({ icon: Icon, label, cost, onClick, disabled }: { icon: any; label: string; cost: number; onClick: () => void; disabled?: boolean }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={disabled} className="h-8">
      <Icon className="h-3.5 w-3.5 mr-1" /> {label}
      <span className="ml-1 text-[10px] opacity-60">{cost}c</span>
    </Button>
  );
}