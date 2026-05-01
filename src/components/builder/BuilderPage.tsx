import { useEffect, useRef, useState } from "react";
import { RefreshCw, ArrowRightLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCredits } from "@/hooks/useCredits";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import { PreviewPane } from "./PreviewPane";
import { CodeEditor, FileItem } from "./CodeEditor";
import { exportProjectZip, preloadExportZipDeps, isExportZipReady } from "@/lib/exportZip";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  Sparkles,
  Wand2,
  Bug,
  Smartphone,
  Zap,
  Rocket,
  Download,
  Loader2,
  Send,
  WifiOff,
  Eye,
  Files,
  Database,
  Cloud,
  PlayCircle,
  Wrench,
  Lightbulb,
  Shield,
  CreditCard,
  Bell,
  Gauge,
  Accessibility,
  Search,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BuilderWizard, type WizardResult } from "./wizard/BuilderWizard";
import { PublishPanel } from "./PublishPanel";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

interface Msg {
  role: "user" | "ai";
  content: string;
  provider?: AIProvider;
  model?: string;
}

function validateGeneratedFiles(files: any[]): FileItem[] {
  if (!Array.isArray(files) || files.length === 0) throw new Error("La IA no devolvió archivos.");
  if (files.length !== 1) throw new Error("La IA debe devolver solo index.html.");
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
  if (valid.length === 0)
    throw new Error("Todos los archivos generados estaban vacíos o malformados.");
  const html = valid.find((f) => f.path === "index.html");
  if (!html) throw new Error("Falta el archivo index.html en la generación.");
  const required: Array<[RegExp, string]> = [
    [/^\s*<!doctype\s+html>/i, "<!doctype html>"],
    [/<html[\s>]/i, "<html>"],
    [/<head[\s>]/i, "<head>"],
    [/<body[\s>]/i, "<body>"],
    [/<style[\s>][\s\S]*?<\/style>/i, "<style>"],
    [/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i, "<script> embebido"],
  ];
  for (const [pattern, label] of required) {
    if (!pattern.test(html.content)) throw new Error(`HTML inválido: falta ${label}`);
  }
  const scripts = Array.from(
    html.content.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
  ) as RegExpMatchArray[];
  for (const script of scripts) {
    const js = script[1].trim();
    if (!js) continue;
    if (/\b(import|export)\s+/m.test(js))
      throw new Error("El código generado no compila: JavaScript no standalone");
    if (!hasBalancedDelimiters(js))
      throw new Error("El código generado no compila: delimitadores incompletos");
  }
  return valid;
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
      if (ch === "*" && next === "/") { blockComment = false; i += 1; }
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

const PROMPT_SUGGESTIONS = [
  "Una landing page de SaaS para una app de productividad",
  "Una calculadora de propinas moderna",
  "Un dashboard con 3 KPIs y un gráfico",
  "Una agenda de contactos con buscador",
  "Un POS simple con carrito",
];

const SMART_SUGGESTIONS = [
  {
    label: "Mejorar diseño visual",
    prompt:
      "Mejora el diseño visual: mejores gradientes, tipografía, espaciado, sombras y micro-interacciones",
    icon: Wand2,
  },
  {
    label: "Optimizar versión móvil",
    prompt:
      "Optimiza completamente para móvil: layout responsive, touch targets >= 44px, menú hamburguesa",
    icon: Smartphone,
  },
  {
    label: "Agregar login",
    prompt: "Agrega un sistema de login/registro con formulario moderno, validación y localStorage",
    icon: Shield,
  },
  {
    label: "Agregar pagos",
    prompt: "Agrega una sección de pagos/checkout con formulario de tarjeta y resumen de compra",
    icon: CreditCard,
  },
  {
    label: "Agregar panel admin",
    prompt: "Agrega un panel de administración con tabla de datos, estadísticas y gráficos",
    icon: LayoutDashboard,
  },
  {
    label: "Preparar para Play Store",
    prompt:
      "Prepara la app para Play Store: añade manifest PWA, service worker, iconos y meta tags",
    icon: PlayCircle,
  },
  {
    label: "Mejorar SEO",
    prompt:
      "Mejora el SEO: meta tags, Open Graph, JSON-LD, headings semánticos, alt text en imágenes",
    icon: Search,
  },
  {
    label: "Agregar notificaciones",
    prompt:
      "Agrega un sistema de notificaciones toast con diferentes tipos: éxito, error, info, warning",
    icon: Bell,
  },
  {
    label: "Optimizar velocidad",
    prompt: "Optimiza el rendimiento: lazy loading, compresión de imágenes, minificación, caché",
    icon: Gauge,
  },
  {
    label: "Corregir accesibilidad",
    prompt:
      "Mejora la accesibilidad: roles ARIA, contraste de colores, navegación por teclado, focus visible",
    icon: Accessibility,
  },
];

type BuilderMode = "quick" | "guided";
type SideTab = "chat" | "suggestions" | "files" | "code" | "sql" | "deploy" | "playstore";

export function BuilderPage({ projectId }: { projectId?: string } = {}) {
  const { consume, balance, unlimited, loading: creditsLoading, refresh } = useCredits();
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();
  // Modo test: admin o cuenta con créditos ilimitados nunca ve el bloqueo de créditos.
  const bypassCredits = unlimited || isAdmin || user?.email?.toLowerCase() === "nexaapporg@gmail.com";
  const nav = useNavigate();

  const [name, setName] = useState("Mi proyecto");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [stageIndex, setStageIndex] = useState<number>(-1);
  const [phaseIndex, setPhaseIndex] = useState<number>(-1);
  const [lastError, setLastError] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<SideTab>("chat");
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId);
  const [provider, setProvider] = useState<AIProvider>(() => getDefaultProvider());
  const [model, setModel] = useState<string>(() => AI_PROVIDERS[getDefaultProvider()].defaultModel);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isOnline = useOnlineStatus();
  const [exportReady, setExportReady] = useState<boolean>(() => isExportZipReady());
  const [publishOpen, setPublishOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState<BuilderMode>("quick");
  // For guided mode
  const [showWizard, setShowWizard] = useState(false);

  const [lastFailedPrompt, setLastFailedPrompt] = useState<string>("");
  const [lastFailedMode, setLastFailedMode] = useState<
    "generate" | "improve" | "fix" | "mobile" | "optimize" | "netlify"
  >("generate");
  const [lastFailedAction, setLastFailedAction] = useState<CreditAction>("full_app");
  const abortRef = useRef<AbortController | null>(null);
  const [lastValidHtml, setLastValidHtml] = useState<string>("");

  useEffect(() => {
    if (exportReady) return;
    let alive = true;
    preloadExportZipDeps()
      .then(() => {
        if (alive) setExportReady(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
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
      const h = proj.files.find((f: FileItem) => f.path === "index.html")?.content;
      if (h) setLastValidHtml(h);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const html = files.find((f) => f.path === "index.html")?.content || "";
  const sqlFile = files.find((f) => f.path === "supabase.sql");
  const manifestFile = files.find((f) => f.path === "manifest.webmanifest");
  const netlifyFile = files.find((f) => f.path === "netlify.toml");
  const playstoreFile = files.find((f) => f.path === "playstore.md");
  const hasApp = files.length > 0;

  const STAGES = [
    "Analizando idea",
    "Diseñando UI",
    "Generando código",
    "Creando base de datos",
    "Validando build",
    "Preparando exportación",
  ];

  const PHASES = [
    { key: "structure", label: "Estructura", icon: LayoutDashboard },
    { key: "ui", label: "UI", icon: Wand2 },
    { key: "features", label: "Funcionalidades", icon: Zap },
  ] as const;

  // Map a stage index (0..5) to a phase index (0..2) so the phase view advances
  // alongside the existing stage logic without changing generation flow.
  const stageToPhase = (s: number): number => {
    if (s < 0) return -1;
    if (s <= 1) return 0; // Analizando idea / Diseñando UI -> Estructura
    if (s <= 2) return 1; // Generando código -> UI
    return 2; // DB / Validando / Exportación -> Funcionalidades
  };

  useEffect(() => {
    setPhaseIndex(stageToPhase(stageIndex));
  }, [stageIndex]);

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
    const rawPrompt = (userPrompt ?? prompt) || "";
    const finalPrompt = rawPrompt.trim();
    if (!finalPrompt && mode === "generate") {
      toast.error("Escribe qué quieres construir");
      return;
    }
    if (finalPrompt.length > 3500) {
      toast.error("Prompt demasiado largo", {
        description: `Máximo 3500 caracteres. Tienes ${finalPrompt.length}. Acórtalo y vuelve a intentar.`,
      });
      return;
    }
    const cost = CREDIT_COSTS[action];
    // Nunca bloquear cuando: créditos ilimitados, admin, o aún cargando el balance inicial.
    if (!bypassCredits && !creditsLoading && balance < cost) {
      toast.error("Créditos insuficientes", {
        description: `Necesitas ${cost} créditos. Tienes ${balance}.`,
      });
      return;
    }
    setLoading(true);
    setLastError(null);
    setLastFailedPrompt(finalPrompt);
    setLastFailedMode(mode);
    setLastFailedAction(action);
    setStageIndex(0);
    setLoadingStage(STAGES[0]);
    setMessages((m) => [...m, { role: "user", content: finalPrompt || `Acción: ${mode}` }]);
    setSideTab("chat");

    try {
      const currentHtml = files.find((f) => f.path === "index.html")?.content;
      let result: {
        name: string;
        description: string;
        files: FileItem[];
        suggestions: string[];
        model: string;
      };
      setStageIndex(1);
      setLoadingStage(STAGES[1]);
      await new Promise((r) => setTimeout(r, 250));
      setStageIndex(2);
      setLoadingStage(STAGES[2]);

      const headers = await authedHeaders();

      // Timeout real de 60s
      console.log("[Builder] prompt recibido", { mode, provider, model, chars: finalPrompt.length, prompt: finalPrompt });
      console.log("[Builder] llamada IA iniciada", { provider, model: getModel(provider, model) });
      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 60_000);

      let resp: any;
      try {
        resp = await Promise.race([
          generateAI({
            headers,
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
          }),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener("abort", () => reject(new Error("TIMEOUT")));
          }),
        ]);
      } catch (timeoutErr: any) {
        clearTimeout(timeoutId);
        if (timeoutErr?.message === "TIMEOUT") {
          console.error("[Builder] Generación timeout después de 60s", { provider, model, mode });
          await refresh();
          const msg = "La generación tardó demasiado. Intenta de nuevo o cambia de modelo.";
          setLastError(msg);
          toast.error("Timeout", { description: msg });
          setMessages((m) => [...m, { role: "ai", content: `⏱️ ${msg}` }]);
          return;
        }
        throw timeoutErr;
      } finally {
        clearTimeout(timeoutId);
        abortRef.current = null;
      }

      console.log("[Builder] respuesta recibida", { ok: resp.ok, provider: resp.provider, model: resp.model, filesCount: resp.files?.length });

      if (!resp.ok) {
        const isCredits = (resp as any).code === "INSUFFICIENT_CREDITS";
        const refunded = (resp as any).refunded as number | undefined;
        console.error("[Builder] Generación falló:", resp);
        toast.error(
          isCredits
            ? "Créditos insuficientes"
            : refunded
              ? "Generación falló — créditos devueltos"
              : "Generación falló",
          {
            description: isCredits
              ? "Recarga créditos para continuar."
              : refunded
                ? `Créditos devueltos (${refunded}c). ${resp.error}`
                : resp.error,
          },
        );
        setLastError(resp.error);
        setMessages((m) => [
          ...m,
          {
            role: "ai",
            content: `❌ ${resp.error}${refunded ? `\n\n💚 Créditos devueltos (${refunded}c).` : ""}`,
          },
        ]);
        await refresh();
        return;
      }
      if (resp.fallbackUsed)
        toast.info("Fallback automático", {
          description: `Se usó ${resp.provider}/${resp.model}.`,
        });

      let validFiles: FileItem[];
      try {
        validFiles = validateGeneratedFiles(resp.files as any);
      } catch (validationErr: any) {
        try {
          if (!bypassCredits) await refundCreditsFn({
            headers: await authedHeaders(),
            data: { amount: cost, reason: `Validación falló: ${CREDIT_LABELS[action]}` },
          });
          toast.error("Generación falló — créditos devueltos", {
            description: `${bypassCredits ? "" : `${cost}c devueltos. `}${validationErr.message}`,
          });
          setMessages((m) => [
            ...m,
            {
              role: "ai",
              content: `❌ ${validationErr.message}${bypassCredits ? "" : `\n\n💚 Créditos devueltos (${cost}c).`}`,
            },
          ]);
        } finally {
          await refresh();
        }
        setLastError(validationErr.message);
        return;
      }
      console.log("[Builder] HTML validado", { files: validFiles.length, bytes: validFiles[0]?.content.length ?? 0 });

      result = {
        name: resp.name,
        description: resp.description,
        files: validFiles,
        suggestions: resp.suggestions,
        model: resp.model,
      };
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          content: `✅ ${result.description}${result.suggestions.length ? "\n\n**Sugerencias:**\n" + result.suggestions.map((s) => `• ${s}`).join("\n") : ""}`,
          provider: resp.provider as AIProvider,
          model: resp.model,
        },
      ]);
      await refresh();

      setStageIndex(3);
      setLoadingStage(STAGES[3]);
      await new Promise((r) => setTimeout(r, 200));
      setStageIndex(4);
      setLoadingStage(STAGES[4]);

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
      console.log("[Builder] preview actualizado", { fileCount: newFiles.length, mode });
      const newHtml = newFiles.find((f) => f.path === "index.html")?.content || "";
      if (newHtml) setLastValidHtml(newHtml);

      const pid = await persistProject(
        mode === "generate" ? result.name : name,
        newFiles,
        finalPrompt,
        result.description,
      );
      setStageIndex(5);
      setLoadingStage(STAGES[5]);
      await new Promise((r) => setTimeout(r, 200));
      if (!projectId && mode === "generate")
        nav({ to: "/builder/$projectId", params: { projectId: pid } });
      setPrompt("");
      toast.success("Generación completada");
    } catch (e: any) {
      const msg = e?.message || "Falló la generación";
      console.error("[Builder] Error en generación:", e);
      await refresh();
      setLastError(msg);
      toast.error("Error", { description: msg });
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
    if (!hasApp) return;
    try {
      await persistProject(name, files, prompt);
      toast.success("Guardado");
    } catch (e: any) {
      toast.error("Error", { description: e?.message });
    }
  };
  const handleExport = async () => {
    if (!hasApp) {
      toast.error("Genera una app primero");
      return;
    }
    if (!exportReady && !isOnline) {
      toast.error("Sin conexión");
      return;
    }
    const ok = await consume("export_zip");
    if (!ok) return;
    try {
      await exportProjectZip(name, files);
      setExportReady(true);
      toast.success("ZIP descargado");
    } catch (e: any) {
      toast.error("Error", { description: e?.message });
    }
  };
  const handleWizardGenerate = async (r: WizardResult) => {
    setName(r.name);
    setPrompt(r.composedPrompt);
    setShowWizard(false);
    await runAction("generate", "full_app", r.composedPrompt);
  };
  const applySuggestion = (s: (typeof SMART_SUGGESTIONS)[number]) => {
    runAction("improve", "feature_medium", s.prompt);
  };

  // ── Guided mode overlay ──
  if (showWizard) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-gradient-to-b from-background via-background to-violet-950/10">
        <BuilderWizard
          onCancel={() => setShowWizard(false)}
          onGenerate={handleWizardGenerate}
          estimatedCost={CREDIT_COSTS.full_app}
          balance={balance}
          unlimited={unlimited}
          loading={loading}
        />
      </div>
    );
  }

  // ── Sidebar tab items ──
  const sideTabs: { id: SideTab; icon: any; label: string; show?: boolean }[] = [
    { id: "chat", icon: MessageSquare, label: "Chat" },
    { id: "suggestions", icon: Lightbulb, label: "Sugerencias" },
    { id: "files", icon: Files, label: "Archivos", show: hasApp },
    { id: "code", icon: Eye, label: "Código", show: hasApp },
    { id: "sql", icon: Database, label: "SQL", show: !!sqlFile },
    { id: "deploy", icon: Cloud, label: "Deploy", show: hasApp },
    { id: "playstore", icon: PlayCircle, label: "Play Store", show: hasApp },
  ];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-1.5 px-2 h-10 min-h-[2.5rem] border-b border-border bg-card/40 shrink-0 overflow-x-auto">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          className="w-32 h-7 text-xs font-medium bg-transparent border-border shrink-0"
        />
        <Select value={provider} onValueChange={(v) => handleProviderChange(v as AIProvider)}>
          <SelectTrigger className="h-7 w-24 text-[11px] bg-background/40 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_LIST.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="h-7 w-32 text-[11px] bg-background/40 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_PROVIDERS[provider].models.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-primary/30 shrink-0">
          {bypassCredits ? "∞" : balance}c
        </Badge>

        <div className="h-4 w-px bg-border mx-0.5 shrink-0" />

        {/* Mode toggle */}
        <div className="flex items-center bg-muted/50 rounded-md p-0.5 shrink-0">
          <button
            onClick={() => {
              setBuilderMode("quick");
              setShowWizard(false);
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${builderMode === "quick" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            ⚡ Rápido
          </button>
          <button
            onClick={() => {
              setBuilderMode("guided");
              setShowWizard(true);
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${builderMode === "guided" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <ListChecks className="h-3 w-3 inline mr-0.5" /> Guiado
          </button>
        </div>

        <div className="h-4 w-px bg-border mx-0.5 shrink-0" />

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <TinyBtn
            icon={Wand2}
            label="Mejorar con IA"
            onClick={() =>
              runAction(
                "improve",
                "visual_change",
                "Mejora automáticamente el diseño, rendimiento y UX de la app actual",
              )
            }
            disabled={loading || !hasApp}
            highlight
          />
          <TinyBtn
            icon={Bug}
            label="Corregir"
            onClick={() => runAction("fix", "fix_errors", "Detecta y corrige errores")}
            disabled={loading || !hasApp}
          />
          <TinyBtn
            icon={Smartphone}
            label="Móvil"
            onClick={() => runAction("mobile", "feature_medium", "Optimiza para móvil")}
            disabled={loading || !hasApp}
          />
          <TinyBtn
            icon={Zap}
            label="Optimizar"
            onClick={() =>
              runAction("optimize", "visual_change", "Optimiza rendimiento y accesibilidad")
            }
            disabled={loading || !hasApp}
          />
          <TinyBtn
            icon={Rocket}
            label="Netlify"
            onClick={() => runAction("netlify", "visual_change", "Prepara para Netlify")}
            disabled={loading || !hasApp}
          />
          <TinyBtn
            icon={isOnline ? Download : WifiOff}
            label="ZIP"
            onClick={handleExport}
            disabled={loading || !hasApp || (!exportReady && !isOnline)}
          />
        </div>

        <div className="ml-auto shrink-0">
          <Button
            size="sm"
            onClick={() => setPublishOpen(true)}
            disabled={!hasApp}
            className="h-7 text-xs px-3 bg-gradient-to-r from-violet-500 to-cyan-500 border-0 text-white"
          >
            <Rocket className="h-3 w-3 mr-1" /> Publicar
          </Button>
        </div>
      </div>

      {/* ── Main: Chat (fixed 340px) | Preview (flex-1) ── */}
      <PanelGroup direction="horizontal" className="flex-1 min-h-0 overflow-hidden">
        {/* Left: Chat panel – 30% */}
        <Panel
          defaultSize={30}
          minSize={20}
          maxSize={45}
          className="h-full flex flex-col bg-card/20"
        >
          {/* Quick prompt bar – always visible at top */}
          {!hasApp && (
            <div className="shrink-0 border-b border-border bg-gradient-to-r from-primary/5 to-violet-500/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold">Describe tu app</span>
              </div>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 3500))}
                maxLength={3500}
                placeholder="Ej: Una landing page para mi tienda online con catálogo y carrito…"
                rows={3}
                className="resize-none text-xs min-h-[64px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    runAction("generate", "full_app");
                }}
              />
              <div className={`text-[10px] text-right ${prompt.length > 3300 ? "text-destructive" : "text-muted-foreground"}`}>
                {prompt.length}/3500
              </div>
              <Button
                onClick={() => runAction("generate", "full_app")}
                disabled={loading || !prompt.trim()}
                className="w-full h-9 bg-gradient-primary border-0 text-sm font-medium"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" /> Generar app ({CREDIT_COSTS.full_app}c)
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex items-center gap-0.5 px-1.5 h-9 min-h-[2.25rem] border-b border-border bg-card/30 shrink-0 overflow-x-auto">
            {sideTabs
              .filter((t) => t.show !== false)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSideTab(t.id)}
                  className={`flex items-center gap-1 px-1.5 py-1 text-[10px] rounded transition whitespace-nowrap ${sideTab === t.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <t.icon className="h-3 w-3" /> {t.label}
                </button>
              ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* ── Chat tab ── */}
            {sideTab === "chat" && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-auto p-2 space-y-2">
                  {/* Empty state: prompt suggestions */}
                  {messages.length === 0 && !hasApp && (
                    <div className="space-y-3 pt-4">
                      <div className="text-center space-y-1">
                        <Sparkles className="h-8 w-8 text-primary mx-auto opacity-60" />
                        <h3 className="text-sm font-semibold">¿Qué quieres crear?</h3>
                        <p className="text-[11px] text-muted-foreground">
                          Escribe tu idea abajo o elige una sugerencia
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {PROMPT_SUGGESTIONS.map((s) => (
                          <button
                            key={s}
                            onClick={() => setPrompt(s)}
                            className="block w-full text-left rounded-md border border-border bg-background/50 p-2.5 text-xs hover:border-primary/50 hover:bg-primary/5 transition"
                          >
                            <Sparkles className="h-3 w-3 inline mr-1.5 text-primary/60" />
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Messages */}
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`rounded-lg p-2.5 text-xs ${m.role === "user" ? "bg-primary/10 border border-primary/20" : "bg-background/50 border border-border"}`}
                    >
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1.5">
                        <span>{m.role === "user" ? "Tú" : "Nexa AI"}</span>
                        {m.role === "ai" && m.provider && (
                          <Badge
                            variant="outline"
                            className="text-[8px] py-0 px-1 h-3.5 border-primary/30"
                          >
                            {AI_PROVIDERS[m.provider].label}
                            {m.model ? ` · ${m.model}` : ""}
                          </Badge>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ))}
                  {/* Loading indicator */}
                  {loading && (
                    <div className="rounded-lg bg-background/50 border border-primary/30 p-3 text-xs space-y-1.5 shadow-[0_0_20px_-8px_hsl(var(--primary)/0.5)]">
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="font-medium text-xs">
                          {loadingStage || "Nexa está construyendo…"}
                        </span>
                      </div>
                      {/* Phase progress (Estructura → UI → Funcionalidades) */}
                      <div className="pt-1">
                        <div className="flex items-center gap-1">
                          {PHASES.map((p, i) => {
                            const Icon = p.icon;
                            const done = i < phaseIndex;
                            const active = i === phaseIndex;
                            return (
                              <div key={p.key} className="flex items-center gap-1 flex-1">
                                <div
                                  className={`flex items-center gap-1 px-1.5 py-1 rounded-md border w-full ${
                                    done
                                      ? "border-primary/50 bg-primary/10 text-primary"
                                      : active
                                        ? "border-primary bg-primary/15 text-foreground"
                                        : "border-border bg-muted/30 text-muted-foreground"
                                  }`}
                                >
                                  <Icon
                                    className={`h-3 w-3 shrink-0 ${active ? "animate-pulse" : ""}`}
                                  />
                                  <span className="text-[10px] font-medium truncate">
                                    {p.label}
                                  </span>
                                  {done && <span className="text-[10px] ml-auto">✓</span>}
                                </div>
                                {i < PHASES.length - 1 && (
                                  <div
                                    className={`h-px w-2 shrink-0 ${i < phaseIndex ? "bg-primary" : "bg-border"}`}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{
                              width: `${Math.max(0, Math.min(100, ((phaseIndex + 1) / PHASES.length) * 100))}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          El preview sigue disponible mientras se genera.
                        </p>
                      </div>
                      <div className="space-y-0.5 pl-1">
                        {STAGES.map((s, i) => (
                          <div
                            key={s}
                            className={`flex items-center gap-1.5 text-[10px] ${i < stageIndex ? "text-primary" : i === stageIndex ? "text-foreground" : "text-muted-foreground"}`}
                          >
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${i < stageIndex ? "bg-primary" : i === stageIndex ? "bg-primary animate-pulse" : "bg-muted"}`}
                            />
                            {s}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Error */}
                  {!loading && lastError && (
                    <div className="rounded-lg bg-destructive/10 border-2 border-destructive/50 p-3 text-xs space-y-2 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-start gap-2">
                        <span className="text-destructive text-base leading-none mt-0.5">⚠️</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-destructive mb-0.5">
                            Error en la generación
                          </p>
                          <p className="text-[11px] text-muted-foreground">{lastError}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() =>
                            runAction(lastFailedMode, lastFailedAction, lastFailedPrompt)
                          }
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reintentar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => {
                            const nextProvider = PROVIDER_LIST.find((p) => p.id !== provider);
                            if (nextProvider) handleProviderChange(nextProvider.id as AIProvider);
                            toast.info("Modelo cambiado", {
                              description: `Ahora usando ${nextProvider?.label || "otro proveedor"}. Intenta de nuevo.`,
                            });
                          }}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" /> Cambiar modelo
                        </Button>
                        {hasApp && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() =>
                              runAction(
                                "fix",
                                "fix_errors",
                                "Detecta y repara automáticamente todos los errores del código actual.",
                              )
                            }
                          >
                            <Wrench className="h-3.5 w-3.5 mr-1.5" /> Reparar con IA
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-muted-foreground"
                          onClick={() => setLastError(null)}
                        >
                          Cerrar
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* Smart suggestions inline after generation */}
                  {!loading && sideTab === "chat" && (
                    <div className="border border-border/60 rounded-lg p-2 bg-background/30">
                      <div className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Lightbulb className="h-3 w-3 text-primary" /> Sugerencias para mejorar esta
                        app
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {SMART_SUGGESTIONS.map((s) => (
                          <button
                            key={s.label}
                            onClick={() => {
                              if (hasApp) {
                                applySuggestion(s);
                              } else {
                                setPrompt(s.prompt);
                                toast.info("Prompt cargado", {
                                  description: "Haz clic en Generar app.",
                                });
                              }
                            }}
                            disabled={loading}
                            className="flex items-center gap-1 rounded-full border border-border bg-background/50 px-2 py-0.5 text-[10px] hover:border-primary/40 hover:bg-primary/5 transition disabled:opacity-50"
                          >
                            <s.icon className="h-3 w-3 text-primary/70" /> {s.label}{" "}
                            <span className="text-primary/60">Aplicar</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                {/* Chat input — always visible */}
                <div className="border-t border-border p-2.5 space-y-2 shrink-0 bg-card/30">
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value.slice(0, 3500))}
                    maxLength={3500}
                    placeholder={
                      hasApp
                        ? "Pídele a Nexa que modifique tu app…"
                        : "Describe la app que quieres crear…"
                    }
                    rows={3}
                    className="resize-none text-xs min-h-[64px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                        runAction("generate", hasApp ? "generation_simple" : "full_app");
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] shrink-0 ${prompt.length > 3300 ? "text-destructive" : "text-muted-foreground"}`}>
                      {prompt.length}/3500
                    </span>
                    <Button
                      onClick={() =>
                        runAction("generate", hasApp ? "generation_simple" : "full_app")
                      }
                      disabled={loading || !prompt.trim()}
                      className="flex-1 h-9 bg-gradient-primary border-0 text-sm font-medium"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />{" "}
                          {hasApp ? "Enviar cambio" : "Generar app"}
                        </>
                      )}
                    </Button>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {hasApp ? CREDIT_COSTS.generation_simple : CREDIT_COSTS.full_app}c
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Suggestions tab ── */}
            {sideTab === "suggestions" && (
              <div className="flex-1 overflow-auto p-3 space-y-2">
                <h3 className="text-xs font-semibold flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-primary" /> Sugerencias para mejorar esta
                  app
                </h3>
                {!hasApp && (
                  <p className="text-[11px] text-muted-foreground">
                    Genera una app primero y luego aplica estas mejoras, o haz clic para generar con
                    esa funcionalidad incluida.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-1.5">
                  {SMART_SUGGESTIONS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.label}
                        onClick={() => {
                          if (hasApp) {
                            applySuggestion(s);
                          } else {
                            setPrompt(s.prompt);
                            setSideTab("chat");
                            toast.info("Prompt cargado", {
                              description: "Haz clic en Generar app para comenzar.",
                            });
                          }
                        }}
                        disabled={loading}
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-background/50 p-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition disabled:opacity-50 group"
                      >
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium">{s.label}</span>
                        </div>
                        <span className="text-[10px] text-primary font-medium opacity-0 group-hover:opacity-100 transition shrink-0">
                          Aplicar →
                        </span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                          {hasApp ? CREDIT_COSTS.feature_medium : CREDIT_COSTS.full_app}c
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Files tab ── */}
            {sideTab === "files" && (
              <div className="flex-1 overflow-auto p-3">
                {!hasApp ? (
                  <p className="text-xs text-muted-foreground">Aún no hay archivos.</p>
                ) : (
                  <ul className="space-y-1 text-xs font-mono">
                    {files.map((f) => (
                      <li
                        key={f.path}
                        className="flex items-center justify-between rounded border border-border/60 bg-background/40 px-2 py-1.5"
                      >
                        <span className="truncate">{f.path}</span>
                        <span className="text-muted-foreground text-[10px]">
                          {(f.content.length / 1024).toFixed(1)} KB
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* ── Code tab ── */}
            {sideTab === "code" && (
              <div className="flex-1 overflow-hidden">
                <CodeEditor files={files} onChange={handleFileChange} onSave={handleSave} />
              </div>
            )}

            {/* ── SQL tab ── */}
            {sideTab === "sql" && (
              <div className="flex-1 overflow-auto">
                <pre className="text-xs p-3 font-mono whitespace-pre-wrap text-foreground/90">
                  {sqlFile?.content || "-- Sin SQL."}
                </pre>
              </div>
            )}

            {/* ── Deploy tab ── */}
            {sideTab === "deploy" && (
              <div className="flex-1 overflow-auto p-3 space-y-3">
                <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                  <h3 className="font-semibold text-xs mb-1 flex items-center gap-1.5">
                    <Cloud className="h-3.5 w-3.5 text-primary" />
                    Netlify
                  </h3>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    Arrastra el ZIP a netlify.com/drop.
                  </p>
                  {netlifyFile && (
                    <pre className="text-[10px] bg-background/60 p-2 rounded font-mono overflow-x-auto">
                      {netlifyFile.content}
                    </pre>
                  )}
                </div>
                <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                  <h3 className="font-semibold text-xs mb-1 flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-primary" />
                    PWA
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {manifestFile
                      ? "manifest.webmanifest incluido."
                      : "Pide a la IA: 'añade soporte PWA'."}
                  </p>
                </div>
              </div>
            )}

            {/* ── Play Store tab ── */}
            {sideTab === "playstore" && (
              <div className="flex-1 overflow-auto p-3 space-y-2">
                <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                  <h3 className="font-semibold text-xs mb-1 flex items-center gap-1.5">
                    <PlayCircle className="h-3.5 w-3.5 text-primary" />
                    Play Store
                  </h3>
                  <ol className="list-decimal pl-4 text-[11px] text-muted-foreground space-y-0.5">
                    <li>Publica la app como PWA.</li>
                    <li>Abre PWA Builder con la URL.</li>
                    <li>Genera el paquete Android (TWA).</li>
                    <li>Sube el .aab a Google Play Console.</li>
                  </ol>
                  <Button asChild size="sm" variant="outline" className="mt-2 h-7 text-xs">
                    <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer">
                      Abrir PWA Builder
                    </a>
                  </Button>
                </div>
                {playstoreFile && (
                  <pre className="text-[10px] bg-background/60 p-2 rounded font-mono whitespace-pre-wrap">
                    {playstoreFile.content}
                  </pre>
                )}
              </div>
            )}
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/40 transition-colors cursor-col-resize" />

        {/* Right: Preview – 70% */}
        <Panel defaultSize={70} minSize={40} className="h-full flex flex-col min-w-0">
          {/* Suggestions strip above preview — siempre visible, incluso durante la generación */}
          <div className="shrink-0 border-b border-border bg-card/30 px-2 py-1.5 overflow-x-auto">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[10px] font-medium text-muted-foreground shrink-0 mr-1">
                Sugerencias IA:
              </span>
              {SMART_SUGGESTIONS.slice(0, 8).map((s) => (
                <button
                  key={s.label}
                  onClick={() => {
                    if (loading) {
                      toast.info("Generando…", {
                        description: "Espera a que termine la generación actual.",
                      });
                      return;
                    }
                    if (hasApp) {
                      applySuggestion(s);
                    } else {
                      setPrompt(s.prompt);
                      setSideTab("chat");
                    }
                  }}
                  className={`flex items-center gap-1 rounded-full border border-border bg-background/50 px-2 py-0.5 text-[10px] hover:border-primary/40 hover:bg-primary/5 transition whitespace-nowrap shrink-0 ${loading ? "opacity-60 cursor-wait" : ""}`}
                >
                  <s.icon className="h-3 w-3 text-primary/70" /> {s.label} <span className="text-primary/60 ml-0.5">Aplicar</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0 relative">
            <PreviewPane html={html || lastValidHtml} />
          {!html && lastValidHtml && (
            <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
              <span className="bg-yellow-500/90 text-black text-xs px-2 py-1 rounded shadow">
                Mostrando último código válido
              </span>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs shadow"
                disabled={loading}
                onClick={() =>
                  runAction(
                    "fix",
                    "fix_errors",
                    "Repara el preview: detecta y corrige errores de HTML/CSS/JS para que el index.html cargue y se renderice correctamente.",
                  )
                }
              >
                <Wrench className="h-3.5 w-3.5 mr-1" /> Reparar preview
              </Button>
            </div>
          )}
          {hasApp && html && (
            <div className="absolute bottom-2 right-2 z-10">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] bg-background/80 backdrop-blur shadow"
                disabled={loading}
                onClick={() =>
                  runAction(
                    "fix",
                    "fix_errors",
                    "Repara el preview: detecta y corrige errores de HTML/CSS/JS del index.html actual sin agregar features nuevas.",
                  )
                }
                title="Repara errores del preview con IA"
              >
                <Wrench className="h-3.5 w-3.5 mr-1" /> Reparar preview
              </Button>
            </div>
          )}
          </div>
        </Panel>
      </PanelGroup>

      <Sheet open={publishOpen} onOpenChange={setPublishOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-3xl p-0 border-l border-border bg-background"
        >
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

function TinyBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  highlight,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <Button
      size="sm"
      variant={highlight ? "default" : "ghost"}
      onClick={onClick}
      disabled={disabled}
      className={`h-7 px-2 text-[11px] gap-1 ${highlight ? "bg-gradient-to-r from-violet-500/80 to-cyan-500/80 text-white border-0 shadow-sm" : ""}`}
      title={label}
    >
      <Icon className="h-3 w-3" /> <span className="hidden xl:inline">{label}</span>
    </Button>
  );
}
