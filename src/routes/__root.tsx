import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Nexa One Builder — Crea apps web con IA" },
      { name: "description", content: "Plataforma para construir aplicaciones web con IA, vista previa en vivo, editor y export ZIP." },
      { name: "author", content: "Nexa One" },
      { name: "theme-color", content: "#0b0b1a" },
      { property: "og:title", content: "Nexa One Builder — Crea apps web con IA" },
      { property: "og:description", content: "Plataforma para construir aplicaciones web con IA, vista previa en vivo, editor y export ZIP." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/nexa-logo.jpeg" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:image", content: "/nexa-logo.jpeg" },
      { name: "twitter:title", content: "Nexa One Builder — Crea apps web con IA" },
      { name: "twitter:description", content: "Plataforma para construir aplicaciones web con IA, vista previa en vivo, editor y export ZIP." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/jpeg", href: "/nexa-logo.jpeg" },
      { rel: "apple-touch-icon", href: "/nexa-logo.jpeg" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Outlet />
        <Toaster richColors position="top-right" theme="dark" />
      </TooltipProvider>
    </AuthProvider>
  );
}
