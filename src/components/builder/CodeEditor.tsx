import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Save } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export interface FileItem { path: string; content: string; language?: string; }

function langOf(path: string) {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  return "plaintext";
}

export function CodeEditor({ files, onChange, onSave }: {
  files: FileItem[];
  onChange: (path: string, content: string) => void;
  onSave?: () => void;
}) {
  const [active, setActive] = useState(files[0]?.path);

  useEffect(() => {
    if (!active && files[0]) setActive(files[0].path);
    if (active && !files.find((f) => f.path === active)) setActive(files[0]?.path);
  }, [files, active]);

  if (files.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Genera una app para ver el código</div>;
  }

  const current = files.find((f) => f.path === active) || files[0];

  return (
    <div className="flex flex-col h-full">
      <Tabs value={current.path} onValueChange={setActive} className="flex flex-col h-full">
        <div className="flex items-center justify-between border-b border-border bg-card/30 px-2 py-1 gap-2">
          <TabsList className="bg-transparent h-9 overflow-x-auto">
            {files.map((f) => (
              <TabsTrigger key={f.path} value={f.path} className="text-xs">{f.path}</TabsTrigger>
            ))}
          </TabsList>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => {
              navigator.clipboard.writeText(current.content);
              toast.success("Copiado");
            }}><Copy className="h-3.5 w-3.5" /></Button>
            {onSave && <Button size="sm" variant="ghost" onClick={onSave}><Save className="h-3.5 w-3.5" /></Button>}
          </div>
        </div>
        {files.map((f) => (
          <TabsContent key={f.path} value={f.path} className="flex-1 m-0 overflow-hidden">
            <Editor
              height="100%"
              language={langOf(f.path)}
              value={f.content}
              theme="vs-dark"
              onChange={(v) => onChange(f.path, v ?? "")}
              options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", scrollBeyondLastLine: false }}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}