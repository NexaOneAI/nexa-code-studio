CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'MXN',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','failed','cancelled')),
  mercado_pago_preference_id text,
  mercado_pago_payment_id text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_user ON public.credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_payment ON public.credit_purchases(mercado_pago_payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_purchases_payment_approved
  ON public.credit_purchases(mercado_pago_payment_id)
  WHERE mercado_pago_payment_id IS NOT NULL AND status = 'approved';

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own purchases"
  ON public.credit_purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_credit_purchases_updated
BEFORE UPDATE ON public.credit_purchases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();