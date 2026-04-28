import JSZip from "jszip";
import { saveAs } from "file-saver";
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

export async function exportProjectZip(name: string, files: FileItem[]) {
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