import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { generateApp } from "@/server/generateApp.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { PreviewPane } from "./PreviewPane";
import { CodeEditor, FileItem } from "./CodeEditor";
import { exportProjectZip } from "@/lib/exportZip";
import { Sparkles, Wand2, Bug, Smartphone, Zap, Rocket, Download, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { CREDIT_COSTS, CreditAction } from "@/lib/credit-costs";

interface Msg { role: "user" | "ai"; content: string; }

const SUGGESTIONS = [
  "Una landing page de SaaS para una app de productividad",
  "Una calculadora de propinas moderna",
  "Un dashboard con 3 KPIs y un gráfico",
  "Una agenda de contactos con buscador",
  "Un POS simple con carrito",
];

export function BuilderPage({ projectId }: { projectId?: string } = {}) {
  const { user } = useAuth();
  const { consume, balance, unlimited } = useCredits();
  const nav = useNavigate();
  const generate = useServerFn(generateApp);

  const [name, setName] = useState("Mi proyecto");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load existing project
  useEffect(() => {
    if (!projectId || !user) return;
    (async () => {
      const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
      if (proj) { setName(proj.name); setCurrentProjectId(proj.id); }
      const { data: pf } = await supabase.from("project_files").select("path,content,language").eq("project_id", projectId);
      if (pf) setFiles(pf as FileItem[]);
    })();
  }, [projectId, user]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const html = files.find((f) => f.path === "index.html")?.content || "";

  const persistProject = async (n: string, fs: FileItem[], p: string) => {
    if (!user) return null;
    let pid = currentProjectId;
    if (!pid) {
      const { data, error } = await supabase.from("projects").insert({ user_id: user.id, name: n, prompt: p }).select().single();
      if (error || !data) { toast.error("Error guardando proyecto"); return null; }
      pid = data.id;
      setCurrentProjectId(pid);
    } else {
      await supabase.from("projects").update({ name: n, updated_at: new Date().toISOString() }).eq("id", pid);
    }
    await supabase.from("project_files").delete().eq("project_id", pid!);
    if (fs.length) {
      await supabase.from("project_files").insert(fs.map((f) => ({
        project_id: pid!, user_id: user.id, path: f.path, content: f.content, language: f.language || "html",
      })));
    }
    return pid;
  };

  const runAction = async (mode: "generate" | "improve" | "fix" | "mobile" | "optimize" | "netlify", action: CreditAction, userPrompt?: string) => {
    const finalPrompt = userPrompt ?? prompt;
    if (!finalPrompt.trim() && mode === "generate") { toast.error("Escribe qué quieres construir"); return; }
    if (!unlimited && balance < CREDIT_COSTS[action]) {
      toast.error("Sin créditos suficientes", { description: `Necesitas ${CREDIT_COSTS[action]} créditos` });
      return;
    }

    setLoading(true);
    setMessages((m) => [...m, { role: "user", content: finalPrompt || `Acción: ${mode}` }]);

    try {
      const ok = await consume(action);
      if (!ok) { setLoading(false); return; }

      const context = files.length ? files.map((f) => `// ${f.path}\n${f.content}`).join("\n\n").slice(0, 15000) : undefined;
      const result = await generate({ data: { prompt: finalPrompt || mode, context, mode } });

      if (!result.ok) {
        toast.error("Error de IA", { description: result.error });
        setMessages((m) => [...m, { role: "ai", content: `❌ ${result.error}` }]);
        setLoading(false);
        return;
      }

      const newFiles: FileItem[] = result.files.map((f: any) => ({ path: f.path, content: f.content, language: f.language }));
      setFiles(newFiles);
      if (mode === "generate" && result.name) setName(result.name);

      setMessages((m) => [...m, {
        role: "ai",
        content: `✅ ${result.description || "Listo"}\n\n${result.suggestions?.length ? "**Sugerencias:**\n" + result.suggestions.map((s: string) => `• ${s}`).join("\n") : ""}`,
      }]);

      const pid = await persistProject(mode === "generate" ? result.name : name, newFiles, finalPrompt);
      if (user && pid) {
        await supabase.from("generations").insert({
          user_id: user.id, project_id: pid, prompt: finalPrompt, response_summary: result.description,
          cost: CREDIT_COSTS[action], model: result.model,
        });
        if (!projectId && mode === "generate") nav({ to: "/builder/$projectId", params: { projectId: pid } });
      }
      setPrompt("");
      toast.success("Generación completada");
    } catch (e: any) {
      toast.error("Error", { description: e?.message || "Falló la generación" });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (path: string, content: string) => {
    setFiles((fs) => fs.map((f) => f.path === path ? { ...f, content } : f));
  };

  const handleSave = async () => {
    await persistProject(name, files, "");
    toast.success("Cambios guardados");
  };

  const handleExport = async () => {
    if (files.length === 0) { toast.error("Genera una app primero"); return; }
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

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Chat */}
        <ResizablePanel defaultSize={28} minSize={20}>
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
        </ResizablePanel>
        <ResizableHandle withHandle />
        {/* Preview */}
        <ResizablePanel defaultSize={40} minSize={25}>
          <PreviewPane html={html} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        {/* Editor */}
        <ResizablePanel defaultSize={32} minSize={20}>
          <CodeEditor files={files} onChange={handleFileChange} onSave={handleSave} />
        </ResizablePanel>
      </ResizablePanelGroup>
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