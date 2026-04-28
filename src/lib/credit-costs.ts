export const CREDIT_COSTS = {
  visual_change: 1,
  generation_simple: 2,
  fix_errors: 2,
  export_zip: 3,
  feature_medium: 4,
  full_app: 8,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export const CREDIT_LABELS: Record<CreditAction, string> = {
  visual_change: "Cambio visual",
  generation_simple: "Generación simple",
  fix_errors: "Corregir errores",
  export_zip: "Exportar ZIP",
  feature_medium: "Función media",
  full_app: "App completa",
};