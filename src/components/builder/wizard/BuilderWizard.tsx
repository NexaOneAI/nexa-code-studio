import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Smartphone,
  Store,
  LayoutDashboard,
  ShoppingBag,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Check,
  LogIn,
  CreditCard,
  Shield,
  MessageSquare,
  Map as MapIcon,
  PackageSearch,
  ClipboardList,
  Wand2,
  Terminal,
  ListChecks,
} from "lucide-react";

export type AppType =
  | "web"
  | "pwa"
  | "playstore"
  | "saas"
  | "store"
  | "landing";

export interface WizardResult {
  name: string;
  appType: AppType;
  description: string;
  features: string[];
  primaryColor: string;
  theme: "dark-neon" | "light" | "custom";
  audience: string;
  /** Prompt final compuesto a partir de las respuestas del wizard. */
  composedPrompt: string;
}

const APP_TYPES: {
  id: AppType;
  label: string;
  desc: string;
  icon: any;
  accent: string;
}[] = [
  { id: "web", label: "Web App", desc: "Aplicación web responsive", icon: Globe, accent: "from-violet-500/20 to-fuchsia-500/10 border-violet-500/40" },
  { id: "pwa", label: "PWA Móvil", desc: "Instalable en celular", icon: Smartphone, accent: "from-cyan-500/20 to-sky-500/10 border-cyan-500/40" },
  { id: "playstore", label: "Play Store", desc: "Lista para Android", icon: Rocket, accent: "from-emerald-500/20 to-teal-500/10 border-emerald-500/40" },
  { id: "saas", label: "SaaS / Dashboard", desc: "Panel con métricas", icon: LayoutDashboard, accent: "from-indigo-500/20 to-blue-500/10 border-indigo-500/40" },
  { id: "store", label: "Tienda Online", desc: "Catálogo + carrito", icon: ShoppingBag, accent: "from-amber-500/20 to-orange-500/10 border-amber-500/40" },
  { id: "landing", label: "Landing Page", desc: "Página de conversión", icon: Store, accent: "from-pink-500/20 to-rose-500/10 border-pink-500/40" },
];

const FEATURES = [
  { id: "login", label: "Login", icon: LogIn },
  { id: "pagos", label: "Pagos", icon: CreditCard },
  { id: "admin", label: "Panel admin", icon: Shield },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "mapa", label: "Mapa", icon: MapIcon },
  { id: "catalogo", label: "Catálogo", icon: PackageSearch },
  { id: "pedidos", label: "Pedidos", icon: ClipboardList },
];

const COLOR_PRESETS = [
  { name: "Nexa Violeta", value: "#8b5cf6" },
  { name: "Cian Neón", value: "#22d3ee" },
  { name: "Magenta", value: "#ec4899" },
  { name: "Esmeralda", value: "#10b981" },
  { name: "Ámbar", value: "#f59e0b" },
  { name: "Azul", value: "#3b82f6" },
];

const STEPS = [
  "Nombre",
  "Tipo",
  "Descripción",
  "Funciones",
  "Estilo",
  "Público",
  "Resumen",
];

function composePrompt(d: Omit<WizardResult, "composedPrompt">): string {
  const typeLabel = APP_TYPES.find((t) => t.id === d.appType)?.label ?? d.appType;
  const feats = d.features.length ? d.features.join(", ") : "ninguna específica";
  const audience = d.audience.trim() ? d.audience.trim() : "público general";
  return [
    `Crea una ${typeLabel} llamada "${d.name}".`,
    `Descripción: ${d.description.trim()}.`,
    `Funcionalidades requeridas: ${feats}.`,
    `Estilo visual: tema ${d.theme === "dark-neon" ? "oscuro premium con acentos neón" : d.theme}, color principal ${d.primaryColor}.`,
    `Público objetivo: ${audience}.`,
    `La app debe ser moderna, responsive y lista para producción.`,
  ].join(" ");
}

export function BuilderWizard({
  onCancel,
  onGenerate,
  estimatedCost,
  balance,
  unlimited,
  loading,
}: {
  onCancel?: () => void;
  onGenerate: (result: WizardResult) => void;
  estimatedCost: number;
  balance: number;
  unlimited: boolean;
  loading?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Mi app");
  const [appType, setAppType] = useState<AppType>("web");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [primaryColor, setPrimaryColor] = useState(COLOR_PRESETS[0].value);
  const [theme] = useState<"dark-neon" | "light" | "custom">("dark-neon");
  const [audience, setAudience] = useState("");
  // Modo: asistente paso a paso o prompt libre avanzado.
  const [mode, setMode] = useState<"wizard" | "pro">("wizard");
  const [proPrompt, setProPrompt] = useState("");
  const [proName, setProName] = useState("Mi app");

  const result: WizardResult = useMemo(() => {
    const base = { name, appType, description, features, primaryColor, theme, audience };
    return { ...base, composedPrompt: composePrompt(base) };
  }, [name, appType, description, features, primaryColor, theme, audience]);

  const canNext = (() => {
    if (step === 0) return name.trim().length >= 2;
    if (step === 2) return description.trim().length >= 8;
    return true;
  })();

  const toggleFeature = (id: string) =>
    setFeatures((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const insufficient = !unlimited && balance < estimatedCost;

  const proValid = proPrompt.trim().length >= 12 && proName.trim().length >= 2;

  const handleProGenerate = () => {
    const base: Omit<WizardResult, "composedPrompt"> = {
      name: proName.trim(),
      appType: "web",
      description: proPrompt.trim().slice(0, 200),
      features: [],
      primaryColor: COLOR_PRESETS[0].value,
      theme: "dark-neon",
      audience: "",
    };
    onGenerate({ ...base, composedPrompt: proPrompt.trim() });
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl p-6 md:p-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 grid place-items-center shadow-[0_0_24px_-4px_hsl(var(--primary)/0.7)]">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Asistente Nexa</h1>
            <p className="text-xs text-muted-foreground">Construye tu app paso a paso</p>
          </div>
          {mode === "wizard" && (
            <div className="ml-auto text-xs text-muted-foreground">
              Paso <span className="text-foreground font-medium">{step + 1}</span>/{STEPS.length}
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <div className="mb-6 inline-flex rounded-xl border border-border/60 bg-card/40 p-1">
          <button
            onClick={() => setMode("wizard")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              mode === "wizard"
                ? "bg-gradient-to-r from-violet-500/30 to-cyan-500/20 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Asistente paso a paso
          </button>
          <button
            onClick={() => setMode("pro")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              mode === "pro"
                ? "bg-gradient-to-r from-violet-500/30 to-cyan-500/20 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            Prompt avanzado
          </button>
        </div>

        {mode === "pro" ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-6 md:p-8 space-y-5 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 grid place-items-center border border-primary/30">
                <Terminal className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Modo avanzado · Prompt completo</h2>
                <p className="text-sm text-muted-foreground">
                  Pega o escribe el prompt completo de tu app. Salta el asistente y envía
                  directamente a la IA.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Nombre del proyecto
              </label>
              <Input
                value={proName}
                onChange={(e) => setProName(e.target.value)}
                placeholder="Ej: Reservas Café Luna"
                className="h-11 bg-background/60"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Prompt completo
              </label>
              <Textarea
                autoFocus
                value={proPrompt}
                onChange={(e) => setProPrompt(e.target.value)}
                placeholder="Describe la app completa que quieres crear…"
                rows={14}
                className="resize-none text-base bg-background/60 font-mono leading-relaxed"
              />
              <div className="text-xs text-muted-foreground">
                {proPrompt.trim().length} caracteres · mínimo 12
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Coste estimado:{" "}
                <span className="text-foreground font-medium">{estimatedCost} créditos</span>
              </span>
              <span className="text-muted-foreground">
                Saldo:{" "}
                <span className={`font-medium ${insufficient ? "text-amber-400" : "text-foreground"}`}>
                  {unlimited ? "∞ Ilimitados" : balance}
                </span>
              </span>
            </div>
            {insufficient && (
              <p className="text-xs text-amber-400">
                No tienes suficientes créditos para generar. Recarga para continuar.
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={() => onCancel?.()} disabled={loading} className="h-11">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button
                onClick={handleProGenerate}
                disabled={loading || insufficient || !proValid}
                className="h-11 px-6 bg-gradient-to-r from-violet-500 to-cyan-500 border-0 text-white shadow-[0_0_28px_-4px_hsl(var(--primary)/0.9)]"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Generar app ({estimatedCost}c)
              </Button>
            </div>
          </div>
        ) : (
        <>
        {/* Progress */}
        <div className="mb-8">
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  i <= step
                    ? "bg-gradient-to-r from-violet-500 to-cyan-400"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{STEPS[step]}</div>
        </div>

        {/* Step content */}
        <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-6 md:p-8 min-h-[320px] animate-fade-in" key={step}>
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">¿Cómo se llamará tu app?</h2>
              <p className="text-sm text-muted-foreground">Puedes cambiarlo después.</p>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Reservas Café Luna"
                className="h-12 text-base bg-background/60"
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">¿Qué tipo de app quieres?</h2>
              <p className="text-sm text-muted-foreground">Elige la opción que más se acerque.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {APP_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = appType === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setAppType(t.id)}
                      className={`text-left rounded-xl border bg-gradient-to-br p-4 transition-all hover:scale-[1.02] ${
                        active
                          ? `${t.accent} ring-2 ring-primary/60`
                          : "from-background/40 to-background/10 border-border/60 hover:border-primary/40"
                      }`}
                    >
                      <Icon className="h-5 w-5 mb-2 text-primary" />
                      <div className="text-sm font-medium">{t.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Cuéntale a Nexa qué hace tu app</h2>
              <p className="text-sm text-muted-foreground">
                Sé natural. Imagina que se lo explicas a un amigo.
              </p>
              <Textarea
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Una app donde mis clientes pueden reservar mesa, ver el menú del día y pagar online."
                rows={6}
                className="resize-none text-base bg-background/60"
              />
              <div className="text-xs text-muted-foreground">
                {description.trim().length} caracteres · mínimo 8
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">¿Qué necesita incluir?</h2>
              <p className="text-sm text-muted-foreground">Selecciona todo lo que aplique.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {FEATURES.map((f) => {
                  const Icon = f.icon;
                  const active = features.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleFeature(f.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${
                        active
                          ? "border-primary/60 bg-primary/10"
                          : "border-border/60 bg-background/40 hover:border-primary/40"
                      }`}
                    >
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="flex-1 text-left">{f.label}</span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-2xl font-semibold">Elige el estilo visual</h2>
              <p className="text-sm text-muted-foreground">
                Tema oscuro premium con acentos neón. Elige tu color principal.
              </p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setPrimaryColor(c.value)}
                    className={`group rounded-xl border p-3 text-center transition ${
                      primaryColor === c.value
                        ? "border-primary/60 ring-2 ring-primary/40"
                        : "border-border/60 hover:border-primary/40"
                    }`}
                  >
                    <div
                      className="h-10 w-full rounded-md mb-2 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]"
                      style={{ background: c.value }}
                    />
                    <div className="text-[11px] text-muted-foreground">{c.name}</div>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <label className="text-xs text-muted-foreground">Color personalizado:</label>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-8 w-14 rounded cursor-pointer bg-transparent border border-border"
                />
                <code className="text-xs text-muted-foreground">{primaryColor}</code>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">¿Para quién es esta app? <span className="text-sm font-normal text-muted-foreground">(opcional)</span></h2>
              <p className="text-sm text-muted-foreground">
                Nos ayuda a ajustar el tono y los ejemplos.
              </p>
              <Input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Ej: Restaurantes pequeños en Latinoamérica"
                className="h-12 text-base bg-background/60"
              />
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Listo para generar</h2>
              <p className="text-sm text-muted-foreground">
                Revisa el resumen. Si algo no está bien, vuelve atrás.
              </p>
              <div className="rounded-xl border border-border/60 bg-background/40 p-5 space-y-3 text-sm">
                <SummaryRow label="Nombre" value={name} />
                <SummaryRow label="Tipo" value={APP_TYPES.find((t) => t.id === appType)?.label ?? appType} />
                <SummaryRow label="Descripción" value={description || "—"} />
                <SummaryRow
                  label="Funciones"
                  value={
                    features.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {features.map((f) => (
                          <Badge key={f} variant="outline" className="border-primary/30">
                            {FEATURES.find((x) => x.id === f)?.label}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      "Ninguna"
                    )
                  }
                />
                <SummaryRow
                  label="Estilo"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 rounded-full border border-border"
                        style={{ background: primaryColor }}
                      />
                      Dark + neón
                    </span>
                  }
                />
                {audience && <SummaryRow label="Público" value={audience} />}
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Coste estimado:{" "}
                  <span className="text-foreground font-medium">{estimatedCost} créditos</span>
                </span>
                <span className="text-muted-foreground">
                  Saldo:{" "}
                  <span className={`font-medium ${insufficient ? "text-amber-400" : "text-foreground"}`}>
                    {unlimited ? "∞" : balance}
                  </span>
                </span>
              </div>
              {insufficient && (
                <p className="text-xs text-amber-400">
                  No tienes suficientes créditos para generar. Recarga para continuar.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center justify-between mt-6 gap-2">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? onCancel?.() : setStep((s) => s - 1))}
            disabled={loading}
            className="h-11"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {step === 0 ? "Cancelar" : "Atrás"}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="h-11 px-6 bg-gradient-to-r from-violet-500 to-cyan-500 border-0 text-white shadow-[0_0_24px_-6px_hsl(var(--primary)/0.8)]"
            >
              Siguiente
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => onGenerate(result)}
              disabled={loading || insufficient}
              className="h-11 px-6 bg-gradient-to-r from-violet-500 to-cyan-500 border-0 text-white shadow-[0_0_28px_-4px_hsl(var(--primary)/0.9)]"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Generar app ({estimatedCost}c)
            </Button>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-24 text-xs uppercase tracking-wider text-muted-foreground pt-0.5">
        {label}
      </div>
      <div className="flex-1 text-sm">{value}</div>
    </div>
  );
}