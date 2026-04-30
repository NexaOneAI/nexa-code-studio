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
import { exportProjectZip, preloadExportZipDeps, isExportZipReady } from "@/lib/exportZip";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Sparkles, Wand2, Bug, Smartphone, Zap, Rocket, Download, Loader2, Send, WifiOff, Eye, Files, Database, Cloud, PlayCircle, Wrench } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CREDIT_COSTS, CREDIT_LABELS, CreditAction } from "@/lib/credit-costs";
import { projectsService } from "@/services/projects.service";
import { generateAI } from "@/server/generateAI.functions";
import { authedHeaders } from "@/lib/auth-headers";
import {
  AI_PROVIDERS,
  PROVIDER_LIST,
  type AIProvider,
  getDefaultProvider,
  setDefaultProvider,
  getModel,
} from "@/lib/ai-providers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BuilderWizard, type WizardResult } from "./wizard/BuilderWizard";
import { PublishPanel } from "./PublishPanel";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface Msg { role: "user" | "ai"; content: string; provider?: AIProvider; model?: string; }

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
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [stageIndex, setStageIndex] = useState<number>(-1);
  const [lastError, setLastError] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<string>("preview");
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId);
  const [provider, setProvider] = useState<AIProvider>(() => getDefaultProvider());
  const [model, setModel] = useState<string>(() => AI_PROVIDERS[getDefaultProvider()].defaultModel);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isOnline = useOnlineStatus();
  const [exportReady, setExportReady] = useState<boolean>(() => isExportZipReady());
  // Wizard visible cuando es un proyecto nuevo y aún no se ha generado nada.
  const [showWizard, setShowWizard] = useState<boolean>(() => !projectId);
  const [publishOpen, setPublishOpen] = useState(false);

  // Precargar dependencias de exportación (jszip + file-saver) al montar.
  // Así, si el usuario pierde la conexión más tarde, la exportación
  // sigue funcionando porque los chunks ya están en cache HTTP.
  useEffect(() => {
    if (exportReady) return;
    let alive = true;
    preloadExportZipDeps()
      .then(() => { if (alive) setExportReady(true); })
      .catch(() => { /* reintentaremos cuando vuelva la conexión */ });
    return () => { alive = false; };
  }, [exportReady, isOnline]);

  const handleProviderChange = (p: AIProvider) => {
    setProvider(p);
    setModel(AI_PROVIDERS[p].defaultModel);
    setDefaultProvider(p);
  };

  // Cargar proyecto existente vía service (Supabase si hay sesión, si no local)
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    projectsService.get(projectId).then((proj) => {
      if (!alive || !proj) return;
      setName(proj.name);
      setFiles(proj.files);
      setCurrentProjectId(proj.id);
      setShowWizard(false);
    });
    return () => { alive = false; };
  }, [projectId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const html = files.find((f) => f.path === "index.html")?.content || "";
  const sqlFile = files.find((f) => f.path === "supabase.sql");
  const manifestFile = files.find((f) => f.path === "manifest.webmanifest");
  const netlifyFile = files.find((f) => f.path === "netlify.toml");
  const playstoreFile = files.find((f) => f.path === "playstore.md");

  const STAGES = [
    "Analizando idea",
    "Diseñando UI",
    "Generando código",
    "Creando base de datos",
    "Validando build",
    "Preparando exportación",
  ];

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
    setLastError(null);
    setStageIndex(0);
    setLoadingStage(STAGES[0]);
    setMessages((m) => [...m, { role: "user", content: finalPrompt || `Acción: ${mode}` }]);

    try {
      const currentHtml = files.find((f) => f.path === "index.html")?.content;

      let result: {
        name: string;
        description: string;
        files: FileItem[];
        suggestions: string[];
        model: string;
      };

      {
        setStageIndex(1);
        setLoadingStage(STAGES[1]);
        // Pequeña pausa visual entre etapas para que el usuario las perciba.
        await new Promise((r) => setTimeout(r, 250));
        setStageIndex(2);
        setLoadingStage(STAGES[2]);
        // Punto único centralizado: créditos + proveedor + fallback + registro.
        const resp = await generateAI({
          headers: await authedHeaders(),
          data: {
            provider,
            model: getModel(provider, model),
            prompt: finalPrompt || `Acción: ${mode}`,
            mode,
            context: currentHtml,
            projectId: currentProjectId,
            cost,
            reason: CREDIT_LABELS[action],
          },
        });
        if (!resp.ok) {
          const isCredits = (resp as any).code === "INSUFFICIENT_CREDITS";
          const refunded = (resp as any).refunded as number | undefined;
          const desc = isCredits
            ? "Recarga créditos para continuar."
            : refunded
              ? `${resp.error} (se reembolsaron ${refunded} créditos)`
              : resp.error;
          toast.error(isCredits ? "Créditos insuficientes" : "Generación falló", { description: desc });
          setLastError(resp.error);
          setMessages((m) => [
            ...m,
            {
              role: "ai",
              content: `❌ ${resp.error}\n\nPuedes reintentar cambiando de proveedor en el selector superior.`,
            },
          ]);
          await refresh();
          return;
        }
        if (resp.fallbackUsed) {
          toast.info("Fallback automático", {
            description: `${provider} falló. Se usó ${resp.provider}/${resp.model}.`,
          });
        }
        // Validar archivos antes de mostrar.
        const validFiles = validateGeneratedFiles(resp.files as any);
        result = {
          name: resp.name,
          description: resp.description,
          files: validFiles,
          suggestions: resp.suggestions,
          model: resp.model,
        };
        // Mensaje IA con badge del proveedor real usado (puede diferir si hubo fallback).
        setMessages((m) => [
          ...m,
          {
            role: "ai",
            content: `✅ ${result.description}${
              result.suggestions.length
                ? "\n\n**Sugerencias:**\n" + result.suggestions.map((s) => `• ${s}`).join("\n")
                : ""
            }`,
            provider: resp.provider as AIProvider,
            model: resp.model,
          },
        ]);
        await refresh();
      }

      setStageIndex(3);
      setLoadingStage(STAGES[3]);
      await new Promise((r) => setTimeout(r, 200));
      setStageIndex(4);
      setLoadingStage(STAGES[4]);

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

      const pid = await persistProject(
        mode === "generate" ? result.name : name,
        newFiles,
        finalPrompt,
        result.description,
      );
      setStageIndex(5);
      setLoadingStage(STAGES[5]);
      await new Promise((r) => setTimeout(r, 200));
      if (!projectId && mode === "generate") {
        nav({ to: "/builder/$projectId", params: { projectId: pid } });
      }
      setPrompt("");
      toast.success("Generación completada");
    } catch (e: any) {
      const msg = e?.message || "Falló la generación";
      setLastError(msg);
      toast.error("Error en la generación", { description: msg });
      setMessages((m) => [...m, { role: "ai", content: `❌ ${msg}` }]);
    } finally {
      setLoading(false);
      setLoadingStage("");
      setStageIndex(-1);
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
    if (!exportReady && !isOnline) {
      toast.error("Sin conexión", {
        description:
          "Conéctate a Internet al menos una vez para preparar la exportación. Después podrás descargar el ZIP sin conexión.",
      });
      return;
    }
    const ok = await consume("export_zip");
    if (!ok) return;
    try {
      await exportProjectZip(name, files);
      setExportReady(true);
      toast.success("ZIP descargado");
    } catch (e: any) {
      toast.error("No se pudo exportar", {
        description: e?.message ?? "Error desconocido al generar el ZIP.",
      });
    }
  };

  const handleWizardGenerate = async (r: WizardResult) => {
    setName(r.name);
    setPrompt(r.composedPrompt);
    setShowWizard(false);
    // Disparar generación con el prompt compuesto.
    await runAction("generate", "full_app", r.composedPrompt);
  };

  if (showWizard) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-gradient-to-b from-background via-background to-violet-950/10">
        <BuilderWizard
          onCancel={() => nav({ to: "/dashboard" })}
          onGenerate={handleWizardGenerate}
          estimatedCost={CREDIT_COSTS.full_app}
          balance={balance}
          unlimited={unlimited}
          loading={loading}
        />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="border-b border-border p-3 flex items-center gap-2 bg-card/30">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={handleSave}
          className="max-w-xs h-8 text-sm font-medium bg-transparent border-border" />
        <ProviderSelector
          provider={provider}
          model={model}
          onProviderChange={handleProviderChange}
          onModelChange={setModel}
        />
        <ProviderBadge provider={provider} model={model} />
        <div className="ml-auto flex flex-wrap gap-1.5">
          <ActBtn icon={Wand2} label="Mejorar" cost={CREDIT_COSTS.visual_change} onClick={() => runAction("improve", "visual_change", "Mejora visualmente la app")} disabled={loading || files.length === 0} />
          <ActBtn icon={Bug} label="Corregir" cost={CREDIT_COSTS.fix_errors} onClick={() => runAction("fix", "fix_errors", "Detecta y corrige errores")} disabled={loading || files.length === 0} />
          <ActBtn icon={Smartphone} label="Móvil" cost={CREDIT_COSTS.feature_medium} onClick={() => runAction("mobile", "feature_medium", "Optimiza para móvil")} disabled={loading || files.length === 0} />
          <ActBtn icon={Zap} label="Optimizar" cost={CREDIT_COSTS.visual_change} onClick={() => runAction("optimize", "visual_change", "Optimiza rendimiento y accesibilidad")} disabled={loading || files.length === 0} />
          <ActBtn icon={Rocket} label="Netlify" cost={CREDIT_COSTS.visual_change} onClick={() => runAction("netlify", "visual_change", "Prepara para Netlify")} disabled={loading || files.length === 0} />
          <Button
            size="sm"
            onClick={handleExport}
            disabled={loading || files.length === 0 || (!exportReady && !isOnline)}
            variant="outline"
            title={
              !exportReady && !isOnline
                ? "Sin conexión: conéctate al menos una vez para habilitar la exportación offline"
                : !isOnline
                  ? "Modo offline (exportación lista)"
                  : "Exportar como ZIP"
            }
          >
            {!isOnline ? (
              <WifiOff className="h-3.5 w-3.5 mr-1" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1" />
            )}
            ZIP <span className="ml-1 text-[10px] opacity-60">{CREDIT_COSTS.export_zip}c</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setPublishOpen(true)}
            disabled={files.length === 0}
            className="h-8 bg-gradient-to-r from-violet-500 to-cyan-500 border-0 text-white shadow-[0_0_18px_-6px_hsl(var(--primary)/0.8)]"
          >
            <Rocket className="h-3.5 w-3.5 mr-1" />
            Publicar
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
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
                    <span>{m.role === "user" ? "Tú" : "Nexa AI"}</span>
                    {m.role === "ai" && m.provider && (
                      <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 border-primary/30">
                        {AI_PROVIDERS[m.provider].label}{m.model ? ` · ${m.model}` : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
              {loading && (
                <div className="rounded-lg bg-background/50 border border-primary/30 p-3 text-sm space-y-2 shadow-[0_0_24px_-12px_hsl(var(--primary)/0.6)]">
                  <div className="flex items-center gap-2 text-foreground/90">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="font-medium">{loadingStage || "Nexa está construyendo…"}</span>
                  </div>
                  <ul className="space-y-1 pl-1">
                    {STAGES.map((s, i) => (
                      <li key={s} className={`flex items-center gap-2 text-[11px] ${i < stageIndex ? "text-primary" : i === stageIndex ? "text-foreground" : "text-muted-foreground"}`}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${i < stageIndex ? "bg-primary" : i === stageIndex ? "bg-primary animate-pulse" : "bg-muted"}`} />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!loading && lastError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/40 p-3 text-sm space-y-2">
                  <div className="text-xs text-destructive font-medium">Error en la última generación</div>
                  <p className="text-[11px] text-muted-foreground line-clamp-3">{lastError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-primary/40"
                    onClick={() => runAction("fix", "fix_errors", "Detecta y repara automáticamente todos los errores del código actual.")}
                    disabled={files.length === 0}
                  >
                    <Wrench className="h-3.5 w-3.5 mr-1" />
                    Reparar con IA
                  </Button>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-border p-3 space-y-2">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe la app que quieres crear..."
                rows={3} className="resize-none text-sm"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runAction("generate", files.length ? "generation_simple" : "full_app"); }} />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Estimado: <span className="text-foreground font-medium">{files.length ? CREDIT_COSTS.generation_simple : CREDIT_COSTS.full_app} créditos</span></span>
                <span>Saldo: <span className={`font-medium ${!unlimited && balance < 5 ? "text-amber-400" : "text-foreground"}`}>{unlimited ? "∞ Ilimitados" : balance}</span></span>
              </div>
              <Button onClick={() => runAction("generate", files.length ? "generation_simple" : "full_app")}
                disabled={loading || !prompt.trim()} className="w-full bg-gradient-primary border-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Generar ({files.length ? CREDIT_COSTS.generation_simple : CREDIT_COSTS.full_app}c)</>}
              </Button>
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="w-px bg-border hover:bg-primary/50 transition" />
        {/* Preview + Tabs */}
        <Panel defaultSize={40} minSize={25}>
          <Tabs value={rightTab} onValueChange={setRightTab} className="h-full flex flex-col">
            <TabsList className="h-9 rounded-none border-b border-border bg-card/30 px-2 justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="preview" className="h-7 text-xs gap-1.5"><Eye className="h-3.5 w-3.5" />Vista previa</TabsTrigger>
              <TabsTrigger value="files" className="h-7 text-xs gap-1.5"><Files className="h-3.5 w-3.5" />Archivos</TabsTrigger>
              {sqlFile && <TabsTrigger value="sql" className="h-7 text-xs gap-1.5"><Database className="h-3.5 w-3.5" />SQL</TabsTrigger>}
              <TabsTrigger value="deploy" className="h-7 text-xs gap-1.5"><Cloud className="h-3.5 w-3.5" />Deploy</TabsTrigger>
              <TabsTrigger value="playstore" className="h-7 text-xs gap-1.5"><PlayCircle className="h-3.5 w-3.5" />Play Store</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-hidden">
              <TabsContent value="preview" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <PreviewPane html={html} />
              </TabsContent>
              <TabsContent value="files" className="h-full m-0 overflow-auto p-3">
                {files.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aún no hay archivos generados.</p>
                ) : (
                  <ul className="space-y-1 text-xs font-mono">
                    {files.map((f) => (
                      <li key={f.path} className="flex items-center justify-between rounded border border-border/60 bg-background/40 px-2 py-1.5">
                        <span className="truncate">{f.path}</span>
                        <span className="text-muted-foreground text-[10px]">{(f.content.length / 1024).toFixed(1)} KB</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="sql" className="h-full m-0 overflow-auto">
                <pre className="text-xs p-3 font-mono whitespace-pre-wrap text-foreground/90">
                  {sqlFile?.content || "-- La IA no generó SQL para este proyecto."}
                </pre>
              </TabsContent>
              <TabsContent value="deploy" className="h-full m-0 overflow-auto p-4 space-y-4 text-sm">
                <div className="rounded-lg border border-border/60 bg-card/40 p-4">
                  <h3 className="font-semibold mb-1.5 flex items-center gap-2"><Cloud className="h-4 w-4 text-primary" />Netlify</h3>
                  <p className="text-xs text-muted-foreground mb-2">Arrastra el ZIP exportado a netlify.com/drop o conecta tu repo.</p>
                  {netlifyFile && (
                    <pre className="text-[11px] bg-background/60 p-2 rounded font-mono overflow-x-auto">{netlifyFile.content}</pre>
                  )}
                </div>
                <div className="rounded-lg border border-border/60 bg-card/40 p-4">
                  <h3 className="font-semibold mb-1.5 flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary" />PWA</h3>
                  <p className="text-xs text-muted-foreground">
                    {manifestFile ? "manifest.webmanifest incluido. Tu app es instalable." : "No hay manifest. Pide a la IA: 'añade soporte PWA'."}
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="playstore" className="h-full m-0 overflow-auto p-4 space-y-3 text-sm">
                <div className="rounded-lg border border-border/60 bg-card/40 p-4">
                  <h3 className="font-semibold mb-1.5 flex items-center gap-2"><PlayCircle className="h-4 w-4 text-primary" />Empaquetar para Play Store</h3>
                  <ol className="list-decimal pl-5 text-xs text-muted-foreground space-y-1">
                    <li>Publica la app como PWA (Netlify u otro host).</li>
                    <li>Abre PWA Builder con la URL pública.</li>
                    <li>Genera el paquete Android (TWA).</li>
                    <li>Sube el .aab a Google Play Console.</li>
                  </ol>
                  <Button asChild size="sm" variant="outline" className="mt-3 h-8">
                    <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer">Abrir PWA Builder</a>
                  </Button>
                </div>
                {playstoreFile && (
                  <pre className="text-[11px] bg-background/60 p-3 rounded font-mono whitespace-pre-wrap">{playstoreFile.content}</pre>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </Panel>
        <PanelResizeHandle className="w-px bg-border hover:bg-primary/50 transition" />
        {/* Editor */}
        <Panel defaultSize={32} minSize={20}>
          <CodeEditor files={files} onChange={handleFileChange} onSave={handleSave} />
        </Panel>
      </PanelGroup>
      <Sheet open={publishOpen} onOpenChange={setPublishOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 border-l border-border bg-background">
          <SheetTitle className="sr-only">Publicar app</SheetTitle>
          <PublishPanel
            name={name}
            files={files}
            isOnline={isOnline}
            onConsumeExportCredit={() => consume("export_zip")}
          />
        </SheetContent>
      </Sheet>
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

function ProviderSelector({
  provider,
  model,
  onProviderChange,
  onModelChange,
}: {
  provider: AIProvider;
  model: string;
  onProviderChange: (p: AIProvider) => void;
  onModelChange: (m: string) => void;
}) {
  const info = AI_PROVIDERS[provider];
  return (
    <div className="flex items-center gap-1.5">
      <Select value={provider} onValueChange={(v) => onProviderChange(v as AIProvider)}>
        <SelectTrigger className="h-8 w-[110px] text-xs bg-background/40 border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROVIDER_LIST.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={model} onValueChange={onModelChange}>
        <SelectTrigger className="h-8 w-[170px] text-xs bg-background/40 border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {info.models.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ProviderBadge({ provider, model }: { provider: AIProvider; model: string }) {
  const info = AI_PROVIDERS[provider];
  return (
    <Badge
      variant="outline"
      className={`text-[10px] h-6 px-2 border-primary/30 bg-gradient-to-r ${info.color} bg-clip-text text-transparent border-current`}
    >
      {info.label} · {model}
    </Badge>
  );
}