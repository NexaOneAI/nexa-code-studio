export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";
  const sub = size === "lg" ? "text-[10px]" : "text-[9px]";
  const box = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const letter = size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base";
  return (
    <div className="flex items-center gap-2.5 font-bold select-none">
      <div
        className={`relative ${box} rounded-xl flex items-center justify-center animate-nexa-pulse`}
        style={{
          background: "radial-gradient(circle at 30% 30%, rgba(0,212,255,0.35), rgba(139,92,246,0.25) 55%, rgba(217,70,239,0.25) 100%)",
          boxShadow: "inset 0 0 0 1px rgba(139,92,246,0.55), 0 0 18px rgba(0,212,255,0.35), 0 0 30px rgba(139,92,246,0.35)",
        }}
      >
        <span
          className={`${letter} font-black tracking-tighter`}
          style={{
            background: "linear-gradient(135deg, #00D4FF 0%, #8B5CF6 50%, #D946EF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          N
        </span>
      </div>
      <div className="leading-tight">
        <div className={`${text} text-gradient tracking-tight`}>Nexa One</div>
        {size !== "sm" && (
          <div className={`${sub} uppercase tracking-[0.25em] text-muted-foreground`}>Builder</div>
        )}
      </div>
    </div>
  );
}