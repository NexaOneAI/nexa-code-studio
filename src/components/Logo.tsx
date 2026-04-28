import { Sparkles } from "lucide-react";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";
  const icon = size === "lg" ? "h-7 w-7" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className="flex items-center gap-2 font-bold">
      <div className="rounded-lg bg-gradient-primary p-1.5 shadow-glow">
        <Sparkles className={`${icon} text-primary-foreground`} />
      </div>
      <span className={`${text} text-gradient tracking-tight`}>Nexa One</span>
    </div>
  );
}