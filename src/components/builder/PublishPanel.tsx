import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  Globe,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
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

export function PublishPanel({
  name,
  files,
  themeColor = "#8b5cf6",
  onConsumeExportCredit,
  isOnline,
}: Props) {
  const [netlifyUrl, setNetlifyUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);

  const empty = files.length === 0;
  const exportReady = isExportZipReady();

  const handleZip = async () => {
    if (empty) return toast.error("Genera la app primero");
    if (!exportReady && !isOnline) {
      return toast.error("Sin conexión", {
        description: "Conéctate al menos una vez para preparar la exportación.",
      });
    }
    const ok = await onConsumeExportCredit();
    if (!ok) return;
    setBusy("zip");
    try {
      await exportProjectZip(name, files);
      toast.success("ZIP web descargado");
    } catch (e: any) {
      toast.error("Error al exportar", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const handlePwaZip = async () => {
    if (empty) return toast.error("Genera la app primero");
    if (!exportReady && !isOnline) {
      return toast.error("Sin conexión", {
        description: "Conéctate al menos una vez para preparar la exportación.",
      });
    }
    const ok = await onConsumeExportCredit();
    if (!ok) return;
    setBusy("pwa");
    try {
      await exportPwaZip(name, files, { name, themeColor });
      toast.success("PWA lista descargada", {
        description: "Súbela a Netlify y úsala en PWA Builder.",
      });
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
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-background via-background to-violet-950/10">
      <div className="mx-auto max-w-4xl p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 grid place-items-center shadow-[0_0_24px_-4px_hsl(var(--primary)/0.7)]">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Publicar tu app</h2>
            <p className="text-xs text-muted-foreground">
              Tres caminos: web, PWA o Play Store. Elige el que prefieras.
            </p>
          </div>
        </div>

        {/* Top: Netlify + Play Store */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Netlify */}
          <Card
            icon={<Cloud className="h-5 w-5" />}
            title="Publicar en Netlify"
            subtitle="Sitio público en 1 minuto"
            accent="from-cyan-500/20 to-sky-500/5 border-cyan-500/40"
          >
            <ol className="text-xs text-muted-foreground space-y-2 mb-4 pl-1">
              <Step n={1}>Descarga el ZIP web</Step>
              <Step n={2}>
                Ve a{" "}
                <a
                  href="https://app.netlify.com/drop"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Netlify Drop <ExternalLink className="h-3 w-3" />
                </a>
              </Step>
              <Step n={3}>Arrastra la carpeta descomprimida</Step>
            </ol>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleZip}
                disabled={!!busy || empty}
                className="w-full bg-gradient-to-r from-cyan-500 to-sky-500 border-0 text-white"
              >
                {busy === "zip" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Descargar ZIP Web
                <span className="ml-auto text-[10px] opacity-70">
                  {CREDIT_COSTS.export_zip}c
                </span>
              </Button>
              <a
                href="https://app.netlify.com/drop"
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center h-9 rounded-md border border-border bg-background/40 text-xs hover:border-primary/40 transition"
              >
                Abrir Netlify Drop <ExternalLink className="h-3 w-3 ml-1.5" />
              </a>
            </div>

            <div className="mt-4 space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                URL pública (cuando la tengas)
              </label>
              <div className="flex gap-1.5">
                <Input
                  value={netlifyUrl}
                  onChange={(e) => setNetlifyUrl(e.target.value)}
                  placeholder="https://mi-app.netlify.app"
                  className="h-9 text-xs bg-background/60"
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0"
                  onClick={copyUrl}
                  disabled={!netlifyUrl}
                  title="Copiar URL"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </Card>

          {/* Play Store */}
          <Card
            icon={<Smartphone className="h-5 w-5" />}
            title="Convertir a App (Play Store)"
            subtitle="PWA Builder genera tu APK / AAB"
            accent="from-emerald-500/20 to-teal-500/5 border-emerald-500/40"
          >
            <ol className="space-y-2.5 text-xs">
              <Phase n={1} done={!!netlifyUrl} title="Tener la app en Netlify">
                Publica primero (panel izquierdo) y pega aquí la URL.
              </Phase>
              <Phase n={2} done={false} title="Abrir PWA Builder">
                <a
                  href="https://www.pwabuilder.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  pwabuilder.com <ExternalLink className="h-3 w-3" />
                </a>
              </Phase>
              <Phase n={3} done={false} title="Pegar tu URL de Netlify">
                PWA Builder analizará tu app automáticamente.
              </Phase>
              <Phase n={4} done={false} title="Descargar APK / AAB">
                Click en <em>Package For Stores → Android</em>.
              </Phase>
              <Phase n={5} done={false} title="Subir a Play Console">
                <a
                  href="https://play.google.com/console"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  play.google.com/console <ExternalLink className="h-3 w-3" />
                </a>
              </Phase>
            </ol>

            <div className="mt-4 space-y-2">
              <Button
                onClick={() => {
                  const url = netlifyUrl
                    ? `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(netlifyUrl)}`
                    : "https://www.pwabuilder.com";
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 border-0 text-white"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Abrir en PWA Builder
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
              <Button
                onClick={handlePwaZip}
                disabled={!!busy || empty}
                variant="outline"
                className="w-full border-emerald-500/40 hover:bg-emerald-500/10"
              >
                {busy === "pwa" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Package className="h-4 w-4 mr-2" />
                )}
                Descargar PWA lista
                <span className="ml-auto text-[10px] opacity-70">
                  {CREDIT_COSTS.export_zip}c
                </span>
              </Button>
            </div>
          </Card>
        </div>

        {/* Exportaciones rápidas */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            Exportaciones rápidas
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniAction
              icon={<Globe className="h-4 w-4" />}
              label="ZIP Web"
              hint="HTML + Netlify"
              onClick={handleZip}
              loading={busy === "zip"}
              disabled={empty}
            />
            <MiniAction
              icon={<Package className="h-4 w-4" />}
              label="PWA lista"
              hint="Manifest + SW + íconos"
              onClick={handlePwaZip}
              loading={busy === "pwa"}
              disabled={empty}
            />
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
          </div>
        </div>

        {empty && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
            Genera tu app primero para activar las exportaciones.
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  subtitle,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br ${accent} p-5 backdrop-blur-sm transition hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.5)]`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-background/50 border border-border/60 grid place-items-center text-primary">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-[9px] font-bold">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Phase({
  n,
  done,
  title,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          done
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            : "bg-background/60 text-muted-foreground border border-border"
        }`}
      >
        {done ? <Check className="h-3 w-3" /> : n}
      </span>
      <div className="flex-1">
        <div className="text-foreground font-medium">{title}</div>
        <div className="text-muted-foreground text-[11px] mt-0.5">{children}</div>
      </div>
    </li>
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