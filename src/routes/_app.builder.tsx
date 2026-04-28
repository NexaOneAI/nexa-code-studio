import { createFileRoute } from "@tanstack/react-router";
import { BuilderPage } from "@/components/builder/BuilderPage";

export const Route = createFileRoute("/_app/builder")({
  head: () => ({ meta: [{ title: "Constructor IA — Nexa One" }] }),
  component: () => <BuilderPage />,
});