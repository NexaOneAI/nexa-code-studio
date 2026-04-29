/**
 * Planes de créditos disponibles para compra vía Mercado Pago Checkout Pro.
 * Precios en MXN.
 */
export type CreditPlanId = "starter" | "pro" | "ultra";

export interface CreditPlan {
  id: CreditPlanId;
  name: string;
  credits: number;
  price: number;
  currency: "MXN";
  popular?: boolean;
  description: string;
}

export const CREDIT_PLANS: Record<CreditPlanId, CreditPlan> = {
  starter: {
    id: "starter",
    name: "Starter",
    credits: 50,
    price: 149,
    currency: "MXN",
    description: "Ideal para probar Nexa One Builder",
  },
  pro: {
    id: "pro",
    name: "Pro",
    credits: 150,
    price: 349,
    currency: "MXN",
    popular: true,
    description: "Para creadores activos",
  },
  ultra: {
    id: "ultra",
    name: "Ultra",
    credits: 350,
    price: 799,
    currency: "MXN",
    description: "Máxima capacidad creativa",
  },
};

export const CREDIT_PLAN_LIST: CreditPlan[] = [
  CREDIT_PLANS.starter,
  CREDIT_PLANS.pro,
  CREDIT_PLANS.ultra,
];