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
  let JSZip: typeof import("jszip").default;
  let saveAs: typeof import("file-saver").saveAs;
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