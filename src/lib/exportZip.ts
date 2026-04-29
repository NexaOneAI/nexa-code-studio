import type { FileItem } from "@/components/builder/CodeEditor";

const NETLIFY_TOML = `# Configuración de despliegue para Netlify
# Generado por Nexa One Builder

[build]
  publish = "."
  command = "echo 'Sitio estático — nada que compilar'"

[build.environment]
  NODE_VERSION = "20"

# SPA fallback: cualquier ruta cae en index.html
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# Cabeceras de seguridad básicas
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
`;

const NETLIFY_REDIRECTS = `/*    /index.html   200
`;

const GITIGNORE = `node_modules/
.DS_Store
.env
.env.local
dist/
`;

/**
 * Estado de precarga de las dependencias cliente (jszip + file-saver).
 * Cuando `loaded === true` la exportación funciona aunque el navegador
 * pierda la conexión, porque los módulos ya están en memoria/cache HTTP.
 */
let preloadPromise: Promise<void> | null = null;
let preloaded = false;

export function isExportZipReady(): boolean {
  return preloaded;
}

/**
 * Dispara la descarga de los chunks `jszip` y `file-saver` sin ejecutarlos.
 * Llamar al montar el builder para que la exportación funcione offline
 * en visitas posteriores (los chunks quedan en HTTP cache del navegador).
 * Es seguro llamarla muchas veces: comparte la misma promesa.
 */
export function preloadExportZipDeps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (preloaded) return Promise.resolve();
  if (preloadPromise) return preloadPromise;
  preloadPromise = Promise.all([import("jszip"), import("file-saver")])
    .then(() => {
      preloaded = true;
    })
    .catch((err) => {
      // Permitir reintentos si falló (p.ej. offline en la primera visita).
      preloadPromise = null;
      throw err;
    });
  return preloadPromise;
}

export async function exportProjectZip(name: string, files: FileItem[]) {
  if (typeof window === "undefined") {
    throw new Error("exportProjectZip solo puede ejecutarse en el navegador");
  }

  // Imports dinámicos: evitan que file-saver (CommonJS) y JSZip
  // entren en el bundle SSR de Netlify Functions.
  // Si están precargados, esto resuelve al instante y funciona offline.
  let JSZip: any;
  let saveAs: (blob: Blob, filename: string) => void;
  try {
    const [jszipMod, fileSaverMod] = await Promise.all([
      import("jszip"),
      import("file-saver"),
    ]);
    JSZip = jszipMod.default;
    saveAs = fileSaverMod.saveAs;
    preloaded = true;
  } catch (err) {
    throw new Error(
      "No se pudieron cargar las librerías de exportación. " +
        "Conéctate a Internet al menos una vez para habilitar la descarga offline.",
    );
  }

  const zip = new JSZip();
  const safeName = name.replace(/[^a-z0-9-_]/gi, "_") || "nexa-app";

  // 1. Archivos del proyecto generados por la IA.
  files.forEach((f) => zip.file(f.path, f.content));

  // 2. Garantizar archivos de despliegue Netlify (sobrescribir si ya existen para asegurar coherencia).
  zip.file("netlify.toml", NETLIFY_TOML);
  zip.file("_redirects", NETLIFY_REDIRECTS);

  // 3. .gitignore mínimo si no existe.
  if (!files.find((f) => f.path === ".gitignore")) {
    zip.file(".gitignore", GITIGNORE);
  }

  // 4. README sólo si no fue generado por la IA.
  if (!files.find((f) => f.path === "README.md")) {
    zip.file(
      "README.md",
      `# ${name}

Generado con **Nexa One Builder**.

## Cómo usar

### Local
Abre \`index.html\` directamente en tu navegador.

### Deploy en Netlify (1 minuto)
1. Ve a https://app.netlify.com/drop
2. Arrastra esta carpeta completa (descomprimida)
3. Listo. Netlify usará \`netlify.toml\` automáticamente.

### Deploy desde Git
- **Build command:** *(ninguno)*
- **Publish directory:** \`.\`
- **Node version:** 20 (definido en \`netlify.toml\`)
`,
    );
  }

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  saveAs(blob, `${name.replace(/[^a-z0-9-_]/gi, "_")}.zip`);
  return safeName;
}

// ============================================================
// PWA helpers — manifest, íconos, service worker y ZIP PWA listo
// ============================================================

export interface PwaOptions {
  name: string;
  shortName?: string;
  description?: string;
  themeColor?: string;
  backgroundColor?: string;
}

/** Genera el contenido del manifest.webmanifest. */
export function buildManifest(opts: PwaOptions): string {
  const safe = (opts.shortName ?? opts.name).slice(0, 12);
  return JSON.stringify(
    {
      name: opts.name,
      short_name: safe,
      description: opts.description ?? `${opts.name} — generada con Nexa One`,
      start_url: "./",
      scope: "./",
      display: "standalone",
      orientation: "portrait",
      background_color: opts.backgroundColor ?? "#0b0b14",
      theme_color: opts.themeColor ?? "#8b5cf6",
      icons: [
        { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        { src: "icons/icon-1024.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
      ],
    },
    null,
    2,
  );
}

/** Service worker mínimo para que PWA Builder detecte la app como instalable. */
export const PWA_SERVICE_WORKER = `// Nexa One — service worker mínimo
const CACHE = "nexa-cache-v1";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).catch(() => cached)),
  );
});
`;

/**
 * Genera un PNG cuadrado con el inicial del nombre y el color tema.
 * 100% browser, sin dependencias. Devuelve un Blob.
 */
export async function generateIconPng(opts: {
  size: number;
  letter: string;
  bg: string;
  fg?: string;
}): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("generateIconPng solo puede ejecutarse en el navegador");
  }
  const { size, letter, bg, fg = "#ffffff" } = opts;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el contexto 2D");

  // Fondo con gradiente neón.
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, shiftHue(bg, 40));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Glow radial sutil.
  const radial = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.6);
  radial.addColorStop(0, "rgba(255,255,255,0.18)");
  radial.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, size, size);

  // Letra centrada.
  ctx.fillStyle = fg;
  ctx.font = `bold ${Math.floor(size * 0.5)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((letter || "N").toUpperCase().slice(0, 1), size / 2, size / 2 + size * 0.04);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob falló"))), "image/png"),
  );
}

/** Pequeño desplazamiento de hue para el gradiente del ícono. */
function shiftHue(hex: string, deg: number): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex);
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  let r = (int >> 16) & 0xff;
  let g = (int >> 8) & 0xff;
  let b = int & 0xff;
  // Convertir a HSL, rotar, devolver hex.
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const rN = r / 255, gN = g / 255, bN = b / 255;
    switch (max) {
      case rN: h = (gN - bN) / d + (gN < bN ? 6 : 0); break;
      case gN: h = (bN - rN) / d + 2; break;
      default: h = (rN - gN) / d + 4;
    }
    h *= 60;
  }
  h = (h + deg) % 360;
  // HSL -> RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let [rr, gg, bb] = [0, 0, 0];
  if (h < 60) [rr, gg, bb] = [c, x, 0];
  else if (h < 120) [rr, gg, bb] = [x, c, 0];
  else if (h < 180) [rr, gg, bb] = [0, c, x];
  else if (h < 240) [rr, gg, bb] = [0, x, c];
  else if (h < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + mm) * 255).toString(16).padStart(2, "0");
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

/** Inyecta tags PWA en el <head> del index.html si no están. */
function injectPwaTagsIntoHtml(html: string, themeColor: string): string {
  if (!/<head[^>]*>/i.test(html)) return html;
  if (html.includes("manifest.webmanifest")) return html;
  const tags = `
    <link rel="manifest" href="manifest.webmanifest" />
    <meta name="theme-color" content="${themeColor}" />
    <link rel="apple-touch-icon" href="icons/icon-192.png" />
    <script>if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));}</script>`;
  return html.replace(/<head[^>]*>/i, (m) => `${m}${tags}`);
}

/**
 * Descarga un único archivo (manifest, ícono PNG, etc.) usando file-saver.
 */
export async function downloadBlob(blob: Blob, filename: string) {
  if (typeof window === "undefined") return;
  const { saveAs } = await import("file-saver");
  saveAs(blob, filename);
}

/**
 * Genera y descarga el manifest.webmanifest standalone.
 */
export async function exportManifest(opts: PwaOptions) {
  const json = buildManifest(opts);
  await downloadBlob(new Blob([json], { type: "application/manifest+json" }), "manifest.webmanifest");
}

/** Genera y descarga los íconos 512 y 1024 (y 192 como bonus). */
export async function exportIcons(name: string, themeColor: string) {
  const letter = (name?.trim()?.[0] ?? "N");
  const sizes = [192, 512, 1024];
  for (const size of sizes) {
    const blob = await generateIconPng({ size, letter, bg: themeColor });
    await downloadBlob(blob, `icon-${size}.png`);
  }
}

/**
 * Empaqueta un ZIP listo para PWA Builder / Play Store:
 *  - index.html con tags PWA inyectados
 *  - manifest.webmanifest
 *  - sw.js
 *  - icons/icon-192,512,1024.png
 *  - netlify.toml + _redirects (para subir y obtener URL pública)
 *  - README explicando el flujo Netlify → PWA Builder → Play Store
 */
export async function exportPwaZip(
  name: string,
  files: FileItem[],
  opts: PwaOptions,
) {
  if (typeof window === "undefined") {
    throw new Error("exportPwaZip solo puede ejecutarse en el navegador");
  }
  const [jszipMod, fileSaverMod] = await Promise.all([
    import("jszip"),
    import("file-saver"),
  ]);
  const JSZip = jszipMod.default;
  const saveAs = fileSaverMod.saveAs;

  const zip = new JSZip();
  const themeColor = opts.themeColor ?? "#8b5cf6";
  const safeName = name.replace(/[^a-z0-9-_]/gi, "_") || "nexa-pwa";

  // 1. Copiar archivos del proyecto, parchando index.html.
  for (const f of files) {
    if (f.path === "index.html") {
      zip.file(f.path, injectPwaTagsIntoHtml(f.content, themeColor));
    } else {
      zip.file(f.path, f.content);
    }
  }

  // 2. PWA assets.
  zip.file("manifest.webmanifest", buildManifest(opts));
  zip.file("sw.js", PWA_SERVICE_WORKER);

  const icons = zip.folder("icons")!;
  for (const size of [192, 512, 1024]) {
    const blob = await generateIconPng({ size, letter: opts.name[0] ?? "N", bg: themeColor });
    icons.file(`icon-${size}.png`, blob);
  }

  // 3. Netlify deploy assets.
  zip.file("netlify.toml", NETLIFY_TOML);
  zip.file("_redirects", NETLIFY_REDIRECTS);

  // 4. README guía Play Store.
  zip.file(
    "README-PWA.md",
    `# ${opts.name} — PWA lista para Play Store

## Pasos

1. **Publicar en Netlify**
   - Ve a https://app.netlify.com/drop
   - Arrastra esta carpeta completa (descomprimida)
   - Copia la URL pública (ej: \`https://${safeName}.netlify.app\`)

2. **Convertir a APK/AAB con PWA Builder**
   - Ve a https://www.pwabuilder.com
   - Pega tu URL de Netlify
   - Click en **Package For Stores → Android**
   - Descarga el \`.aab\` (Android App Bundle)

3. **Subir a Google Play Console**
   - https://play.google.com/console
   - Crea una app nueva
   - Sube el \`.aab\` generado
   - Completa ficha y publica

Generado con Nexa One Builder.
`,
  );

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  saveAs(blob, `${safeName}-pwa.zip`);
  return safeName;
}