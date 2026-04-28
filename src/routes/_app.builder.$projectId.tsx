import { createFileRoute } from "@tanstack/react-router";
import { BuilderPage } from "@/components/builder/BuilderPage";

export const Route = createFileRoute("/_app/builder/$projectId")({
  head: () => ({ meta: [{ title: "Editor — Nexa One" }] }),
  component: BuilderRoute,
});

function BuilderRoute() {
  const { projectId } = Route.useParams();
  return <BuilderPage projectId={projectId} />;
}