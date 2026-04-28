import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { FileItem } from "@/components/builder/CodeEditor";

export async function exportProjectZip(name: string, files: FileItem[]) {
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.path, f.content));

  if (!files.find((f) => f.path === "netlify.toml")) {
    zip.file("netlify.toml", `[build]
  publish = "."
  command = ""

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`);
  }
  if (!files.find((f) => f.path === "README.md")) {
    zip.file("README.md", `# ${name}

Generado con **Nexa One Builder**.

## Cómo usar
1. Abre \`index.html\` en tu navegador, o
2. Sube esta carpeta a Netlify (drag & drop en https://app.netlify.com/drop)

## Deploy en Netlify
- Build command: *(ninguno)*
- Publish directory: \`.\`
`);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${name.replace(/[^a-z0-9-_]/gi, "_")}.zip`);
}