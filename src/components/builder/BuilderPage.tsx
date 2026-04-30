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
import {
  Sparkles, Wand2, Bug, Smartphone, Zap, Rocket, Download, Loader2, Send, WifiOff,
  Eye, Files, Database, Cloud, PlayCircle, Wrench, ChevronDown, ChevronUp,
  Lightbulb, Shield, CreditCard, Bell, Gauge, Accessibility, Search, LayoutDashboard,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CREDIT_COSTS, CREDIT_LABELS, CreditAction } from "@/lib/credit-costs";
import { projectsService } from "@/services/projects.service";
import { generateAI } from "@/server/generateAI.functions";
import { refundCreditsFn } from "@/server/credits.functions";
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

function validateGeneratedFiles(files: any[]): FileItem[] {
  if (!Array.isArray(files) || files.length === 0) throw new Error("La IA no devolvió archivos.");
  const valid: FileItem[] = [];
  for (const f of files) {
    if (!f || typeof f.path !== "string" || typeof f.content !== "string") continue;
    if (f.content.length === 0) continue;
    valid.push({ path: f.path, content: f.content, language: typeof f.language === "string" ? f.language : "html" });
  }
  if (valid.length === 0) throw new Error("Todos los archivos generados estaban vacíos o malformados.");
  const html = valid.find((f) => f.path === "index.html");
  if (!html) throw new Error("Falta el archivo index.html en la generación.");
  if (!/<html|<body|<div|<main|<section/i.test(html.content)) throw new Error("El index.html generado no contiene HTML válido.");
  return valid;
}

const PROMPT_SUGGESTIONS = [
  "Una landing page de SaaS para una app de productividad",
  "Una calculadora de propinas moderna",
  "Un dashboard con 3 KPIs y un gráfico",
  "Una agenda de contactos con buscador",
  "Un POS simple con carrito",
];

const SMART_SUGGESTIONS = [
  { label: "Mejorar diseño visual", prompt: "Mejora el diseño visual: mejores gradientes, tipografía, espaciado, sombras y micro-interacciones", icon: Wand2 },
  { label: "Optimizar versión móvil", prompt: "Optimiza completamente para móvil: layout responsive, touch targets >= 44px, menú hamburguesa", icon: Smartphone },
  { label: "Agregar login", prompt: "Agrega un sistema de login/registro con formulario moderno, validación y localStorage", icon: Shield },
  { label: "Agregar pagos", prompt: "Agrega una sección de pagos/checkout con formulario de tarjeta y resumen de compra", icon: CreditCard },
  { label: "Agregar panel admin", prompt: "Agrega un panel de administración con tabla de datos, estadísticas y gráficos", icon: LayoutDashboard },
  { label: "Preparar para Play Store", prompt: "Prepara la app para Play Store: añade manifest PWA, service worker, iconos y meta tags", icon: PlayCircle },
  { label: "Mejorar SEO", prompt: "Mejora el SEO: meta tags, Open Graph, JSON-LD, headings semánticos, alt text en imágenes", icon: Search },
  { label: "Agregar notificaciones", prompt: "Agrega un sistema de notificaciones toast con diferentes tipos: éxito, error, info, warning", icon: Bell },
  { label: "Optimizar velocidad", prompt: "Optimiza el rendimiento: lazy loading, compresión de imágenes, minificación, caché", icon: Gauge },
  { label: "Corregir accesibilidad", prompt: "Mejora la accesibilidad: roles ARIA, contraste de colores, navegación por teclado, focus visible", icon: Accessibility },
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
  const [bottomTab, setBottomTab] = useState<string>("chat");
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId);
  const [provider, setProvider] = useState<AIProvider>(() => getDefaultProvider());
  const [model, setModel] = useState<string>(() => AI_PROVIDERS[getDefaultProvider()].defaultModel);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isOnline = useOnlineStatus();
  const [exportReady, setExportReady] = useState<boolean>(() => isExportZipReady());
  const [showWizard, setShowWizard] = useState<boolean>(() => !projectId);
  const [publishOpen, setPublishOpen] = useState(false);
  const [bottomExpanded, setBottomExpanded] = useState(true);

  useEffect(() => {
    if (exportReady) return;
    let alive = true;
    preloadExportZipDeps()
      .then(() => { if (alive) setExportReady(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, [exportReady, isOnline]);

  const handleProviderChange = (p: AIProvider) => {
    setProvider(p);
    setModel(AI_PROVIDERS[p].defaultModel);
    setDefaultProvider(p);
  };

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
    "Analizando idea", "Diseñando UI", "Generando código",
    "Creando base de datos", "Validando build", "Preparando exportación",
  ];

  const persistProject = async (n: string, fs: FileItem[], p: string, description?: string) => {
    const id = await projectsService.save({ id: currentProjectId, name: n, description: description ?? null, prompt: p, files: fs });
    if (!currentProjectId) setCurrentProjectId(id);
    return id;
  };

  const runAction = async (
    mode: "generate" | "improve" | "fix" | "mobile" | "optimize" | "netlify",
    action: CreditAction,
    userPrompt?: string,
  ) => {
    const finalPrompt = userPrompt ?? prompt;
    if (!finalPrompt.trim() && mode === "generate") { toast.error("Escribe qué quieres construir"); return; }
    const cost = CREDIT_COSTS[action];
    if (!unlimited && balance < cost) {
      toast.error("Créditos insuficientes", { description: `Necesitas ${cost} créditos para "${CREDIT_LABELS[action]}". Tienes ${balance}.` });
      return;
    }
    setLoading(true);
    setLastError(null);
    setStageIndex(0);
    setLoadingStage(STAGES[0]);
    setMessages((m) => [...m, { role: "user", content: finalPrompt || `Acción: ${mode}` }]);
    setBottomTab("chat");
    setBottomExpanded(true);

    try {
      const currentHtml = files.find((f) => f.path === "index.html")?.content;
      let result: { name: string; description: string; files: FileItem[]; suggestions: string[]; model: string };

      setStageIndex(1); setLoadingStage(STAGES[1]);
      await new Promise((r) => setTimeout(r, 250));
      setStageIndex(2); setLoadingStage(STAGES[2]);

      const resp = await generateAI({
        headers: await authedHeaders(),
        data: { provider, model: getModel(provider, model), prompt: finalPrompt || `Acción: ${mode}`, mode, context: currentHtml, projectId: currentProjectId, cost, reason: CREDIT_LABELS[action] },
      });

      if (!resp.ok) {
        const isCredits = (resp as any).code === "INSUFFICIENT_CREDITS";
        const refunded = (resp as any).refunded as number | undefined;
        const desc = isCredits ? "Recarga créditos para continuar." : refunded ? `Se devolvieron tus créditos automáticamente (${refunded}c). Detalle: ${resp.error}` : resp.error;
        toast.error(isCredits ? "Créditos insuficientes" : refunded ? "Generación falló — créditos devueltos" : "Generación falló", { description: desc });
        setLastError(resp.error);
        setMessages((m) => [...m, { role: "ai", content: `❌ ${resp.error}${refunded ? `\n\n💚 Se devolvieron tus créditos automáticamente (${refunded}c).` : ""}\n\nPuedes reintentar cambiando de proveedor en el selector superior.` }]);
        await refresh();
        return;
      }
      if (resp.fallbackUsed) toast.info("Fallback automático", { description: `${provider} falló. Se usó ${resp.provider}/${resp.model}.` });

      let validFiles: FileItem[];
      try {
        validFiles = validateGeneratedFiles(resp.files as any);
      } catch (validationErr: any) {
        try {
          await refundCreditsFn({ headers: await authedHeaders(), data: { amount: cost, reason: `Validación falló: ${CREDIT_LABELS[action]}` } });
          toast.error("Generación falló — créditos devueltos", { description: `Se devolvieron tus créditos automáticamente (${cost}c). ${validationErr.message}` });
          setMessages((m) => [...m, { role: "ai", content: `❌ ${validationErr.message}\n\n💚 Se devolvieron tus créditos automáticamente (${cost}c).` }]);
        } finally { await refresh(); }
        setLastError(validationErr.message);
        return;
      }

      result = { name: resp.name, description: resp.description, files: validFiles, suggestions: resp.suggestions, model: resp.model };
      setMessages((m) => [...m, { role: "ai", content: `✅ ${result.description}${result.suggestions.length ? "\n\n**Sugerencias:**\n" + result.suggestions.map((s) => `• ${s}`).join("\n") : ""}`, provider: resp.provider as AIProvider, model: resp.model }]);
      await refresh();

      setStageIndex(3); setLoadingStage(STAGES[3]);
      await new Promise((r) => setTimeout(r, 200));
      setStageIndex(4); setLoadingStage(STAGES[4]);

      let newFiles: FileItem[];
      if (mode === "generate") { newFiles = result.files; setName(result.name); } else {
        const map = new Map(files.map((f) => [f.path, f]));
        for (const nf of result.files) map.set(nf.path, nf);
        newFiles = Array.from(map.values());
      }
      setFiles(newFiles);

      const pid = await persistProject(mode === "generate" ? result.name : name, newFiles, finalPrompt, result.description);
      setStageIndex(5); setLoadingStage(STAGES[5]);
      await new Promise((r) => setTimeout(r, 200));
      if (!projectId && mode === "generate") nav({ to: "/builder/$projectId", params: { projectId: pid } });
      setPrompt("");
      toast.success("Generación completada");
    } catch (e: any) {
      const msg = e?.message || "Falló la generación";
      setLastError(msg);
      toast.error("Error en la generación", { description: msg });
      setMessages((m) => [...m, { role: "ai", content: `❌ ${msg}` }]);
    } finally {
      setLoading(false); setLoadingStage(""); setStageIndex(-1);
    }
  };

  const handleFileChange = (path: string, content: string) => {
    setFiles((fs) => fs.map((f) => (f.path === path ? { ...f, content } : f)));
  };

  const handleSave = async () => {
    if (files.length === 0) return;
    try { await persistProject(name, files, prompt); toast.success("Cambios guardados"); } catch (e: any) { toast.error("No se pudo guardar", { description: e?.message }); }
  };

  const handleExport = async () => {
    if (files.length === 0) { toast.error("Genera una app primero"); return; }
    if (!exportReady && !isOnline) { toast.error("Sin conexión", { description: "Conéctate a Internet al menos una vez para preparar la exportación." }); return; }
    const ok = await consume("export_zip");
    if (!ok) return;
    try { await exportProjectZip(name, files); setExportReady(true); toast.success("ZIP descargado"); } catch (e: any) { toast.error("No se pudo exportar", { description: e?.message ?? "Error desconocido al generar el ZIP." }); }
  };

  const handleWizardGenerate = async (r: WizardResult) => {
    setName(r.name); setPrompt(r.composedPrompt); setShowWizard(false);
    await runAction("generate", "full_app", r.composedPrompt);
  };

  const applySuggestion = (s: typeof SMART_SUGGESTIONS[number]) => {
    runAction("improve", "feature_medium", s.prompt);
  };

  if (showWizard) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-gradient-to-b from-background via-background to-violet-950/10">
        <BuilderWizard onCancel={() => nav({ to: "/dashboard" })} onGenerate={handleWizardGenerate} estimatedCost={CREDIT_COSTS.full_app} balance={balance} unlimited={unlimited} loading={loading} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      {/* ── Compact top bar: name + provider + actions ── */}
      <div className="flex items-center gap-1.5 px-2 h-11 min-h-[2.75rem] border-b border-border bg-card/40 shrink-0 overflow-x-auto">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={handleSave}
          className="w-36 h-7 text-xs font-medium bg-transparent border-border shrink-0" />

        <div className="flex items-center gap-1 shrink-0">
          <Select value={provider} onValueChange={(v) => handleProviderChange(v as AIProvider)}>
            <SelectTrigger className="h-7 w-24 text-[11px] bg-background/40 border-border"><SelectValue /></SelectTrigger>
            <SelectContent>{PROVIDER_LIST.map((p) => <SelectItem key={p.id} value={p.id} className="text-xs">{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-7 w-36 text-[11px] bg-background/40 border-border"><SelectValue /></SelectTrigger>
            <SelectContent>{AI_PROVIDERS[provider].models.map((m) => <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-primary/30 shrink-0">
          {unlimited ? "∞" : balance}c
        </Badge>

        <div className="h-4 w-px bg-border mx-0.5 shrink-0" />

        {/* Action buttons – horizontal compact toolbar */}
        <div className="flex items-center gap-0.5 shrink-0">
          <TinyBtn icon={Wand2} label="Mejorar" onClick={() => runAction("improve", "visual_change", "Mejora visualmente la app")} disabled={loading || files.length === 0} />
          <TinyBtn icon={Bug} label="Corregir" onClick={() => runAction("fix", "fix_errors", "Detecta y corrige errores")} disabled={loading || files.length === 0} />
          <TinyBtn icon={Smartphone} label="Móvil" onClick={() => runAction("mobile", "feature_medium", "Optimiza para móvil")} disabled={loading || files.length === 0} />
          <TinyBtn icon={Zap} label="Optimizar" onClick={() => runAction("optimize", "visual_change", "Optimiza rendimiento y accesibilidad")} disabled={loading || files.length === 0} />
          <TinyBtn icon={Rocket} label="Netlify" onClick={() => runAction("netlify", "visual_change", "Prepara para Netlify")} disabled={loading || files.length === 0} />
          <TinyBtn icon={isOnline ? Download : WifiOff} label="ZIP" onClick={handleExport} disabled={loading || files.length === 0 || (!exportReady && !isOnline)} />
        </div>

        <div className="ml-auto shrink-0">
          <Button size="sm" onClick={() => setPublishOpen(true)} disabled={files.length === 0}
            className="h-7 text-xs px-3 bg-gradient-to-r from-violet-500 to-cyan-500 border-0 text-white">
            <Rocket className="h-3 w-3 mr-1" /> Publicar
          </Button>
        </div>
      </div>

      {/* ── Main area: Preview (big) ── */}
      <div className="flex-1 flex flex-col min-h-0">
        <PanelGroup direction="vertical" className="flex-1">
          {/* Preview panel – takes most of the screen */}
          <Panel defaultSize={65} minSize={40}>
            <div className="h-full flex flex-col">
              <PreviewPane html={html} />
            </div>
          </Panel>

          <PanelResizeHandle className="h-px bg-border hover:bg-primary/50 transition" />

          {/* Bottom panel: Chat + Files + Code + SQL + Deploy + Suggestions */}
          <Panel defaultSize={35} minSize={10} collapsible>
            <div className="h-full flex flex-col bg-card/20">
              {/* Bottom tabs header */}
              <div className="flex items-center border-b border-border bg-card/30 shrink-0">
                <TabsWrapper value={bottomTab} onChange={setBottomTab}>
                  <BTab value="chat" icon={Sparkles} label="Chat IA" />
                  <BTab value="suggestions" icon={Lightbulb} label="Sugerencias IA" />
                  <BTab value="files" icon={Files} label="Archivos" />
                  <BTab value="code" icon={Eye} label="Código" />
                  {sqlFile && <BTab value="sql" icon={Database} label="SQL" />}
                  <BTab value="deploy" icon={Cloud} label="Deploy" />
                  <BTab value="playstore" icon={PlayCircle} label="Play Store" />
                </TabsWrapper>
                <Button size="sm" variant="ghost" className="h-7 w-7 ml-auto mr-1 shrink-0"
                  onClick={() => setBottomExpanded((v) => !v)} title={bottomExpanded ? "Minimizar" : "Expandir"}>
                  {bottomExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </Button>
              </div>

              {bottomExpanded && (
                <div className="flex-1 overflow-hidden">
                  {/* Chat */}
                  {bottomTab === "chat" && (
                    <div className="flex h-full">
                      <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex-1 overflow-auto p-2 space-y-2">
                          {messages.length === 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1">
                              {PROMPT_SUGGESTIONS.map((s) => (
                                <button key={s} onClick={() => setPrompt(s)}
                                  className="text-left rounded-md border border-border bg-background/50 p-2 text-[11px] hover:border-primary/50 transition truncate">
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                          {messages.map((m, i) => (
                            <div key={i} className={`rounded-md p-2 text-xs ${m.role === "user" ? "bg-primary/10 border border-primary/20" : "bg-background/50 border border-border"}`}>
                              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1.5">
                                <span>{m.role === "user" ? "Tú" : "Nexa AI"}</span>
                                {m.role === "ai" && m.provider && (
                                  <Badge variant="outline" className="text-[8px] py-0 px-1 h-3.5 border-primary/30">
                                    {AI_PROVIDERS[m.provider].label}{m.model ? ` · ${m.model}` : ""}
                                  </Badge>
                                )}
                              </div>
                              <div className="whitespace-pre-wrap">{m.content}</div>
                            </div>
                          ))}
                          {loading && (
                            <div className="rounded-md bg-background/50 border border-primary/30 p-2 text-xs space-y-1">
                              <div className="flex items-center gap-1.5">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                <span className="font-medium text-[11px]">{loadingStage || "Nexa está construyendo…"}</span>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-1">
                                {STAGES.map((s, i) => (
                                  <span key={s} className={`flex items-center gap-1 text-[10px] ${i < stageIndex ? "text-primary" : i === stageIndex ? "text-foreground" : "text-muted-foreground"}`}>
                                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${i < stageIndex ? "bg-primary" : i === stageIndex ? "bg-primary animate-pulse" : "bg-muted"}`} />
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {!loading && lastError && (
                            <div className="rounded-md bg-destructive/10 border border-destructive/40 p-2 text-xs space-y-1">
                              <p className="text-[10px] text-muted-foreground line-clamp-2">{lastError}</p>
                              <Button size="sm" variant="outline" className="h-6 text-[10px]"
                                onClick={() => runAction("fix", "fix_errors", "Detecta y repara automáticamente todos los errores del código actual.")}
                                disabled={files.length === 0}>
                                <Wrench className="h-3 w-3 mr-1" /> Reparar con IA
                              </Button>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>
                        {/* Chat input */}
                        <div className="border-t border-border p-2 flex items-end gap-2 shrink-0">
                          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Pídele a Nexa que modifique tu app…"
                            rows={2} className="resize-none text-xs flex-1 min-h-[48px]"
                            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runAction("generate", files.length ? "generation_simple" : "full_app"); }} />
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button onClick={() => runAction("generate", files.length ? "generation_simple" : "full_app")}
                              disabled={loading || !prompt.trim()} size="sm" className="h-8 px-3 bg-gradient-primary border-0 text-xs">
                              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-1" /> Generar</>}
                            </Button>
                            <span className="text-[9px] text-muted-foreground text-center">
                              {files.length ? CREDIT_COSTS.generation_simple : CREDIT_COSTS.full_app}c
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {bottomTab === "suggestions" && (
                    <div className="h-full overflow-auto p-3">
                      {files.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-xs text-muted-foreground">Genera una app primero para ver sugerencias inteligentes.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                          {SMART_SUGGESTIONS.map((s) => {
                            const Icon = s.icon;
                            return (
                              <button key={s.label} onClick={() => applySuggestion(s)} disabled={loading}
                                className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background/50 p-3 text-center hover:border-primary/50 hover:bg-primary/5 transition disabled:opacity-50 disabled:pointer-events-none">
                                <Icon className="h-5 w-5 text-primary" />
                                <span className="text-[11px] font-medium leading-tight">{s.label}</span>
                                <span className="text-[9px] text-muted-foreground">{CREDIT_COSTS.feature_medium}c</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Files */}
                  {bottomTab === "files" && (
                    <div className="h-full overflow-auto p-3">
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
                    </div>
                  )}

                  {/* Code editor */}
                  {bottomTab === "code" && (
                    <div className="h-full overflow-hidden">
                      <CodeEditor files={files} onChange={handleFileChange} onSave={handleSave} />
                    </div>
                  )}

                  {/* SQL */}
                  {bottomTab === "sql" && (
                    <div className="h-full overflow-auto">
                      <pre className="text-xs p-3 font-mono whitespace-pre-wrap text-foreground/90">
                        {sqlFile?.content || "-- La IA no generó SQL para este proyecto."}
                      </pre>
                    </div>
                  )}

                  {/* Deploy */}
                  {bottomTab === "deploy" && (
                    <div className="h-full overflow-auto p-3 space-y-3 text-sm">
                      <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                        <h3 className="font-semibold text-xs mb-1 flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5 text-primary" />Netlify</h3>
                        <p className="text-[11px] text-muted-foreground mb-1.5">Arrastra el ZIP a netlify.com/drop o conecta tu repo.</p>
                        {netlifyFile && <pre className="text-[10px] bg-background/60 p-2 rounded font-mono overflow-x-auto">{netlifyFile.content}</pre>}
                      </div>
                      <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                        <h3 className="font-semibold text-xs mb-1 flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5 text-primary" />PWA</h3>
                        <p className="text-[11px] text-muted-foreground">
                          {manifestFile ? "manifest.webmanifest incluido. Tu app es instalable." : "No hay manifest. Pide a la IA: 'añade soporte PWA'."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Play Store */}
                  {bottomTab === "playstore" && (
                    <div className="h-full overflow-auto p-3 space-y-2 text-sm">
                      <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                        <h3 className="font-semibold text-xs mb-1 flex items-center gap-1.5"><PlayCircle className="h-3.5 w-3.5 text-primary" />Play Store</h3>
                        <ol className="list-decimal pl-4 text-[11px] text-muted-foreground space-y-0.5">
                          <li>Publica la app como PWA (Netlify u otro host).</li>
                          <li>Abre PWA Builder con la URL pública.</li>
                          <li>Genera el paquete Android (TWA).</li>
                          <li>Sube el .aab a Google Play Console.</li>
                        </ol>
                        <Button asChild size="sm" variant="outline" className="mt-2 h-7 text-xs">
                          <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer">Abrir PWA Builder</a>
                        </Button>
                      </div>
                      {playstoreFile && <pre className="text-[10px] bg-background/60 p-2 rounded font-mono whitespace-pre-wrap">{playstoreFile.content}</pre>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <Sheet open={publishOpen} onOpenChange={setPublishOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 border-l border-border bg-background">
          <SheetTitle className="sr-only">Publicar app</SheetTitle>
          <PublishPanel name={name} files={files} isOnline={isOnline} onConsumeExportCredit={() => consume("export_zip")} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ── Tiny action button for the toolbar ── */
function TinyBtn({ icon: Icon, label, onClick, disabled }: { icon: any; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button size="sm" variant="ghost" onClick={onClick} disabled={disabled} className="h-7 px-2 text-[11px] gap-1" title={label}>
      <Icon className="h-3 w-3" /> <span className="hidden lg:inline">{label}</span>
    </Button>
  );
}

/* ── Bottom tabs wrapper (manual) ── */
function TabsWrapper({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 px-1.5 overflow-x-auto" data-active={value}>
      {children && Array.isArray(children)
        ? children.map((child: any) => {
            if (!child) return null;
            const v = child.props.value;
            return (
              <button key={v} onClick={() => onChange(v)}
                className={`flex items-center gap-1 h-8 px-2 text-[11px] rounded-t-md transition whitespace-nowrap ${value === v ? "bg-background border border-b-0 border-border text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                {child.props.icon && <child.props.icon className="h-3 w-3" />}
                {child.props.label}
              </button>
            );
          })
        : children
      }
    </div>
  );
}

function BTab(_props: { value: string; icon: any; label: string }) {
  return null;
}