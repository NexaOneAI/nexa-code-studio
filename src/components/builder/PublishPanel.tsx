import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Cloud,
  Smartphone,
  Download,
  Package,
  ImageIcon,
  FileJson,
  ExternalLink,
  Copy,
  Check,
  Rocket,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Globe,
  Sparkles,
  PartyPopper,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import type { FileItem } from "./CodeEditor";
import {
  exportProjectZip,
  exportPwaZip,
  exportManifest,
  exportIcons,
  isExportZipReady,
} from "@/lib/exportZip";
import { CREDIT_COSTS } from "@/lib/credit-costs";

interface Props {
  name: string;
  files: FileItem[];
  themeColor?: string;
  onConsumeExportCredit: () => Promise<boolean>;
  isOnline: boolean;
}

type Busy = null | "zip" | "pwa" | "manifest" | "icons";

const STEPS = [
  { id: 1, label: "Generar", icon: Sparkles },
  { id: 2, label: "Descargar ZIP", icon: Download },
  { id: 3, label: "Subir a Netlify", icon: Cloud },
  { id: 4, label: "PWA Builder", icon: Globe },
  { id: 5, label: "APK / AAB", icon: Package },
  { id: 6, label: "Play Store", icon: Smartphone },
];

export function PublishPanel({
  name,
  files,
  themeColor = "#8b5cf6",
  onConsumeExportCredit,
  isOnline,
}: Props) {
  const [step, setStep] = useState(2);
  const [done, setDone] = useState<Record<number, boolean>>({ 1: true });
  const [netlifyUrl, setNetlifyUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);

  const empty = files.length === 0;
  const exportReady = isExportZipReady();
  const hasUrl = /^https?:\/\/.+/i.test(netlifyUrl.trim());
  const allDone = done[2] && done[3] && done[4] && done[5];

  const markDone = (n: number) => setDone((d) => ({ ...d, [n]: true }));

  const guardOnline = () => {
    if (!exportReady && !isOnline) {
      toast.error("Sin conexión", {
        description: "Conéctate al menos una vez para preparar la exportación.",
      });
      return false;
    }
    return true;
  };

  const handleZip = async () => {
    if (empty) return toast.error("Genera la app primero");
    if (!guardOnline()) return;
    const ok = await onConsumeExportCredit();
    if (!ok) return;
    setBusy("zip");
    try {
      await exportProjectZip(name, files);
      toast.success("✓ ZIP descargado");
      markDone(2);
      setStep(3);
    } catch (e: any) {
      toast.error("Error al exportar", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const handlePwaZip = async () => {
    if (empty) return toast.error("Genera la app primero");
    if (!guardOnline()) return;
    const ok = await onConsumeExportCredit();
    if (!ok) return;
    setBusy("pwa");
    try {
      await exportPwaZip(name, files, { name, themeColor });
      toast.success("✓ PWA descargada");
      markDone(2);
    } catch (e: any) {
      toast.error("Error al exportar PWA", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const handleManifest = async () => {
    setBusy("manifest");
    try {
      await exportManifest({ name, themeColor });
      toast.success("manifest.webmanifest descargado");
    } catch (e: any) {
      toast.error("Error", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const handleIcons = async () => {
    setBusy("icons");
    try {
      await exportIcons(name, themeColor);
      toast.success("Íconos descargados (192, 512, 1024)");
    } catch (e: any) {
      toast.error("Error", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const copyUrl = async () => {
    if (!netlifyUrl) return;
    try {
      await navigator.clipboard.writeText(netlifyUrl);
      setCopied(true);
      toast.success("URL copiada");
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const openNetlify = () => {
    window.open("https://app.netlify.com/drop", "_blank", "noopener,noreferrer");
    markDone(3);
    if (hasUrl) setStep(4);
  };

  const openPwaBuilder = () => {
    if (!hasUrl) return toast.error("Pega tu URL de Netlify primero");
    const url = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(netlifyUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    markDone(4);
    setStep(5);
  };

  const goPlayConsole = () => {
    window.open("https://play.google.com/console", "_blank", "noopener,noreferrer");
    markDone(5);
    markDone(6);
  };

  const progress = useMemo(() => {
    const completed = STEPS.filter((s) => done[s.id]).length;
    return Math.round((completed / STEPS.length) * 100);
  }, [done]);

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-background via-background to-violet-950/10">
      <div className="mx-auto max-w-4xl p-6 md:p-10 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 grid place-items-center shadow-[0_0_30px_-4px_hsl(var(--primary)/0.7)]">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Publicar tu app</h2>
            <p className="text-xs text-muted-foreground">
              Sigue los pasos. Sin conocimientos técnicos.
            </p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Progreso</div>
            <div className="text-sm font-semibold text-primary">{progress}%</div>
          </div>
        </div>

        {/* Stepper */}
        <Stepper steps={STEPS} current={step} done={done} onSelect={setStep} />

        {/* Step content */}
        <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-6 md:p-8 min-h-[320px] shadow-[0_0_40px_-20px_hsl(var(--primary)/0.5)]">
          {step === 1 && (
            <StepShell
              title="Tu app está generada"
              desc="Listo para empaquetar y publicar."
              icon={<Sparkles className="h-6 w-6" />}
              accent="from-violet-500/20 to-fuchsia-500/5"
            >
              <Button
                onClick={() => setStep(2)}
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 border-0"
              >
                Continuar <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell
              title="Descarga el paquete de tu app"
              desc="Elige web (Netlify) o PWA lista (recomendado para Play Store)."
              icon={<Download className="h-6 w-6" />}
              accent="from-cyan-500/20 to-sky-500/5"
            >
              <div className="grid sm:grid-cols-2 gap-3">
                <BigBtn
                  primary
                  onClick={handleZip}
                  disabled={!!busy || empty}
                  loading={busy === "zip"}
                  icon={<Globe className="h-4 w-4" />}
                  label="ZIP Web"
                  hint={`${CREDIT_COSTS.export_zip} créditos · para Netlify`}
                />
                <BigBtn
                  onClick={handlePwaZip}
                  disabled={!!busy || empty}
                  loading={busy === "pwa"}
                  icon={<Package className="h-4 w-4" />}
                  label="PWA lista"
                  hint={`${CREDIT_COSTS.export_zip} créditos · manifest + íconos`}
                />
              </div>
              {empty && (
                <p className="text-xs text-amber-300 mt-4">Genera tu app primero.</p>
              )}
            </StepShell>
          )}

          {step === 3 && (
            <StepShell
              title="Sube tu app a Netlify"
              desc="Arrastra la carpeta descomprimida en Netlify Drop. Es gratis."
              icon={<Cloud className="h-6 w-6" />}
              accent="from-cyan-500/20 to-sky-500/5"
              locked={!done[2]}
              lockedMsg="Descarga el ZIP primero (paso 2)."
            >
              <ol className="text-sm text-muted-foreground space-y-2 mb-5">
                <NumLi n={1}>Descomprime el ZIP descargado.</NumLi>
                <NumLi n={2}>Abre Netlify Drop.</NumLi>
                <NumLi n={3}>Arrastra la carpeta. Copia la URL pública.</NumLi>
              </ol>
              <Button
                onClick={openNetlify}
                className="bg-gradient-to-r from-cyan-500 to-sky-500 border-0 mb-4"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Netlify Drop
              </Button>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Pega aquí tu URL de Netlify
                </label>
                <div className="flex gap-1.5">
                  <Input
                    value={netlifyUrl}
                    onChange={(e) => setNetlifyUrl(e.target.value)}
                    placeholder="https://mi-app.netlify.app"
                    className="h-10 text-sm bg-background/60"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-10 w-10 shrink-0"
                    onClick={copyUrl}
                    disabled={!netlifyUrl}
                    title="Copiar URL"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {hasUrl && (
                  <button
                    onClick={() => {
                      markDone(3);
                      setStep(4);
                    }}
                    className="mt-3 inline-flex items-center text-xs text-emerald-300 hover:underline"
                  >
                    URL detectada · continuar al paso 4
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                  </button>
                )}
              </div>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell
              title="Convierte tu web en app móvil"
              desc="PWA Builder analizará tu URL y generará el paquete Android."
              icon={<Globe className="h-6 w-6" />}
              accent="from-emerald-500/20 to-teal-500/5"
              locked={!hasUrl}
              lockedMsg="Pega tu URL de Netlify en el paso 3."
            >
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 mb-5 text-xs text-emerald-100/90">
                URL detectada: <span className="font-mono text-emerald-300">{netlifyUrl}</span>
              </div>
              <Button
                onClick={openPwaBuilder}
                disabled={!hasUrl}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 border-0"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Abrir en PWA Builder
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </StepShell>
          )}

          {step === 5 && (
            <PlayStoreCard
              onContinue={() => {
                markDone(5);
                setStep(6);
              }}
            />
          )}

          {step === 6 && (
            <StepShell
              title="Sube tu APK / AAB a Play Console"
              desc="Crea tu ficha de Play Store y carga el archivo descargado."
              icon={<Smartphone className="h-6 w-6" />}
              accent="from-fuchsia-500/20 to-violet-500/5"
            >
              <ol className="text-sm text-muted-foreground space-y-2 mb-5">
                <NumLi n={1}>Entra a Google Play Console (cuenta de dev).</NumLi>
                <NumLi n={2}>Crea una nueva aplicación.</NumLi>
                <NumLi n={3}>Sube el APK / AAB de PWA Builder.</NumLi>
                <NumLi n={4}>Completa ficha (icono, capturas, descripción).</NumLi>
              </ol>
              <Button
                onClick={goPlayConsole}
                className="bg-gradient-to-r from-fuchsia-500 to-violet-500 border-0"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Play Console
              </Button>
            </StepShell>
          )}

          {/* Step nav */}
          <div className="flex items-center justify-between mt-8 pt-5 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Paso {step} de {STEPS.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
              disabled={step === STEPS.length}
            >
              Siguiente <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Final CTA */}
        {allDone && (
          <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 to-teal-500/5 p-6 text-center animate-in fade-in slide-in-from-bottom-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 mb-3">
              <PartyPopper className="h-6 w-6 text-emerald-300" />
            </div>
            <h3 className="text-lg font-semibold">🔥 Tu app ya está lista para Play Store</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Excelente trabajo. ¿Listo para crear otra?
            </p>
            <Link to="/dashboard">
              <Button className="bg-gradient-to-r from-violet-500 to-cyan-500 border-0">
                <Plus className="h-4 w-4 mr-2" />
                Crear otra app
              </Button>
            </Link>
          </div>
        )}

        {/* Quick exports */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
            <Download className="h-4 w-4" />
            Exportaciones extra
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniAction
              icon={<FileJson className="h-4 w-4" />}
              label="Manifest"
              hint="manifest.webmanifest"
              onClick={handleManifest}
              loading={busy === "manifest"}
              disabled={false}
            />
            <MiniAction
              icon={<ImageIcon className="h-4 w-4" />}
              label="Íconos"
              hint="192 · 512 · 1024"
              onClick={handleIcons}
              loading={busy === "icons"}
              disabled={false}
            />
            <MiniAction
              icon={<Globe className="h-4 w-4" />}
              label="ZIP Web"
              hint="Solo HTML"
              onClick={handleZip}
              loading={busy === "zip"}
              disabled={empty}
            />
            <MiniAction
              icon={<Package className="h-4 w-4" />}
              label="PWA lista"
              hint="Todo en uno"
              onClick={handlePwaZip}
              loading={busy === "pwa"}
              disabled={empty}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function Stepper({
  steps,
  current,
  done,
  onSelect,
}: {
  steps: typeof STEPS;
  current: number;
  done: Record<number, boolean>;
  onSelect: (n: number) => void;
}) {
  return (
    <div className="relative">
      <div className="absolute top-5 left-0 right-0 h-px bg-border/60" />
      <div
        className="absolute top-5 left-0 h-px bg-gradient-to-r from-violet-500 to-cyan-500 transition-all"
        style={{
          width: `${((Math.max(...Object.keys(done).map(Number).filter((k) => done[k])) || 1) / steps.length) * 100}%`,
        }}
      />
      <ol className="relative grid grid-cols-6 gap-1">
        {steps.map((s) => {
          const isDone = done[s.id];
          const isActive = current === s.id;
          const Icon = s.icon;
          return (
            <li key={s.id} className="flex flex-col items-center">
              <button
                onClick={() => onSelect(s.id)}
                className={`relative h-10 w-10 rounded-full grid place-items-center border-2 transition-all ${
                  isDone
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_18px_-4px_rgba(16,185,129,0.6)]"
                    : isActive
                    ? "bg-gradient-to-br from-violet-500 to-cyan-500 border-transparent text-white shadow-[0_0_22px_-4px_hsl(var(--primary)/0.8)]"
                    : "bg-background border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </button>
              <span
                className={`mt-2 text-[10px] md:text-[11px] text-center leading-tight ${
                  isActive ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepShell({
  title,
  desc,
  icon,
  accent,
  locked,
  lockedMsg,
  children,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  accent: string;
  locked?: boolean;
  lockedMsg?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start gap-4 mb-6">
        <div
          className={`h-12 w-12 rounded-xl bg-gradient-to-br ${accent} border border-border/60 grid place-items-center text-primary`}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>
      {locked ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          {lockedMsg || "Completa el paso anterior para continuar."}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function PlayStoreCard({ onContinue }: { onContinue: () => void }) {
  return (
    <div>
      <div className="grid md:grid-cols-2 gap-6 items-center">
        {/* Mockup */}
        <div className="relative">
          <div className="mx-auto w-44 h-80 rounded-[2rem] border-4 border-border bg-gradient-to-br from-violet-900/40 via-background to-cyan-900/30 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)] relative overflow-hidden">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-border/80" />
            <div className="absolute inset-x-4 top-8 bottom-8 rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 grid place-items-center">
              <Smartphone className="h-12 w-12 text-white/80" />
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-border/80" />
          </div>
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 blur-2xl -z-10" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-200 mb-3">
            <Smartphone className="h-3 w-3" /> Paso final técnico
          </div>
          <h3 className="text-2xl font-bold mb-2">Convierte tu app en APK</h3>
          <p className="text-sm text-muted-foreground mb-5">
            En PWA Builder, dale clic a <strong className="text-foreground">Package For Stores → Android</strong>.
            Te dará un archivo <strong className="text-foreground">.aab</strong> listo para subir a Play Store.
          </p>
          <ul className="text-xs text-muted-foreground space-y-1.5 mb-6">
            <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400" /> Sin Android Studio</li>
            <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400" /> Sin programar nada</li>
            <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400" /> Listo en minutos</li>
          </ul>
          <Button
            onClick={onContinue}
            size="lg"
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 border-0 text-white font-semibold shadow-[0_0_30px_-6px_rgba(16,185,129,0.6)]"
          >
            <Package className="h-5 w-5 mr-2" />
            Ya descargué mi APK / AAB
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function NumLi({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold mt-0.5">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function BigBtn({
  primary,
  onClick,
  disabled,
  loading,
  icon,
  label,
  hint,
}: {
  primary?: boolean;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group rounded-xl border p-4 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        primary
          ? "border-cyan-500/40 bg-gradient-to-br from-cyan-500/15 to-sky-500/5 hover:shadow-[0_0_22px_-6px_rgba(6,182,212,0.6)]"
          : "border-border/60 bg-card/40 hover:border-primary/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <span className="text-primary">{icon}</span>}
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </button>
  );
}

function MiniAction({
  icon,
  label,
  hint,
  onClick,
  loading,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="group rounded-xl border border-border/60 bg-card/40 p-3 text-left hover:border-primary/50 hover:bg-card/60 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-center gap-2 text-primary">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>
    </button>
  );
}
