import logoSrc from "@/assets/nexa-logo.jpeg";

export function Logo({
  size = "md",
  showText = true,
}: {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}) {
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";
  const sub = size === "lg" ? "text-[10px]" : "text-[9px]";
  const box = size === "lg" ? "h-11 w-11" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <div className="flex items-center gap-2.5 font-bold select-none">
      <div
        className={`relative ${box} rounded-xl overflow-hidden flex items-center justify-center animate-nexa-pulse`}
        style={{
          boxShadow:
            "inset 0 0 0 1px rgba(139,92,246,0.55), 0 0 18px rgba(0,212,255,0.35), 0 0 30px rgba(139,92,246,0.35)",
        }}
      >
        <img
          src={logoSrc}
          alt="Nexa One Builder"
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>
      {showText && (
        <div className="leading-tight">
          <div className={`${text} text-gradient tracking-tight`}>Nexa One</div>
          {size !== "sm" && (
            <div className={`${sub} uppercase tracking-[0.25em] text-muted-foreground`}>
              Builder
            </div>
          )}
        </div>
      )}
    </div>
  );
}