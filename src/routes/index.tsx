import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Sparkles, Zap, Code2, Eye, Download, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexa One Builder — Crea apps web con IA en minutos" },
      { name: "description", content: "Construye apps reales con IA, edita el código, ve la vista previa en vivo y exporta a ZIP listo para Netlify." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground bg-gradient-hero">
      <header className="container mx-auto flex items-center justify-between px-4 py-6">
        <Logo />
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/login">Entrar</Link></Button>
          <Button asChild className="bg-gradient-primary border-0"><Link to="/register">Empezar gratis</Link></Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="h-3 w-3 text-primary" /> IA · Preview en vivo · Export Netlify
        </div>
        <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-7xl">
          Crea apps web <span className="text-gradient">con IA</span><br/>en minutos.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Describe lo que quieres construir. Nexa One genera el código, lo previsualiza en vivo y lo deja listo para deploy.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="bg-gradient-primary border-0 shadow-glow">
            <Link to="/register">Crear cuenta — 10 créditos gratis <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline"><Link to="/login">Ya tengo cuenta</Link></Button>
        </div>

        <div className="mt-24 grid gap-6 md:grid-cols-3">
          {[
            { icon: Sparkles, title: "Constructor IA", desc: "Pide la app que quieres y obtén código real, no maquetas." },
            { icon: Eye, title: "Preview en vivo", desc: "Ve tu app funcionando en móvil, tablet o escritorio." },
            { icon: Code2, title: "Editor integrado", desc: "Edita el código generado con resaltado y autocompletado." },
            { icon: Download, title: "Export ZIP", desc: "Descarga tu proyecto listo para subir a Netlify." },
            { icon: Zap, title: "Créditos justos", desc: "Paga solo por lo que generas. Plan free incluido." },
            { icon: Shield, title: "Seguro", desc: "Auth, roles y permisos listos. Tus datos protegidos." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card/40 p-6 text-left backdrop-blur transition hover:border-primary/50 hover:shadow-glow">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Nexa One Builder
      </footer>
    </div>
  );
}
