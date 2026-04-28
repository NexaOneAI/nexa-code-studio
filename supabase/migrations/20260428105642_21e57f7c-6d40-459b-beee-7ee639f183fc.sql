-- Índices de rendimiento por user_id y project_id (acelera RLS y consultas frecuentes)
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_user_id ON public.project_files(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_user_id ON public.credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id_created ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_user_id_created ON public.generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);

-- Garantizar unicidad de profile y credits por usuario (previene duplicados)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profiles_user_id ON public.profiles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_credits_user_id ON public.credits(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_roles_user_role ON public.user_roles(user_id, role);

-- FK a auth.users con borrado en cascada (limpia datos cuando se elimina un usuario)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='profiles_user_id_fkey') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='credits_user_id_fkey') THEN
    ALTER TABLE public.credits
      ADD CONSTRAINT credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='credit_transactions_user_id_fkey') THEN
    ALTER TABLE public.credit_transactions
      ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='generations_user_id_fkey') THEN
    ALTER TABLE public.generations
      ADD CONSTRAINT generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projects_user_id_fkey') THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='project_files_user_id_fkey') THEN
    ALTER TABLE public.project_files
      ADD CONSTRAINT project_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='project_files_project_id_fkey') THEN
    ALTER TABLE public.project_files
      ADD CONSTRAINT project_files_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='generations_project_id_fkey') THEN
    ALTER TABLE public.generations
      ADD CONSTRAINT generations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_roles_user_id_fkey') THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Restricciones de integridad: evitar saldos negativos y montos inválidos
ALTER TABLE public.credits DROP CONSTRAINT IF EXISTS credits_balance_nonneg;
ALTER TABLE public.credits ADD CONSTRAINT credits_balance_nonneg CHECK (balance >= 0);

-- Política explícita ADMIN sobre projects y project_files (además de la existente para owners)
DROP POLICY IF EXISTS "Admins manage all projects" ON public.projects;
CREATE POLICY "Admins manage all projects" ON public.projects
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage all files" ON public.project_files;
CREATE POLICY "Admins manage all files" ON public.project_files
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Asegurar que `consume_credits` jamás permita saldo negativo (refuerzo defensivo)
CREATE OR REPLACE FUNCTION public.consume_credits(_amount integer, _reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _row public.credits%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RETURN false; END IF;

  SELECT * INTO _row FROM public.credits WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    -- Auto-aprovisiona si por alguna razón no existe
    INSERT INTO public.credits(user_id, balance) VALUES (_user_id, 10)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO _row FROM public.credits WHERE user_id = _user_id FOR UPDATE;
  END IF;

  IF _row.unlimited THEN
    INSERT INTO public.credit_transactions(user_id, amount, reason)
      VALUES (_user_id, -_amount, _reason);
    RETURN true;
  END IF;

  IF _row.balance < _amount THEN RETURN false; END IF;

  UPDATE public.credits SET balance = balance - _amount, updated_at = now()
    WHERE user_id = _user_id;
  INSERT INTO public.credit_transactions(user_id, amount, reason)
    VALUES (_user_id, -_amount, _reason);
  RETURN true;
END; $$;

-- Función helper: añadir créditos (para futuros pagos / regalos administrativos)
CREATE OR REPLACE FUNCTION public.add_credits(_target_user uuid, _amount integer, _reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN false; END IF;
  -- Solo admins pueden añadir créditos a otros; un usuario nunca puede recargarse a sí mismo desde el cliente.
  IF NOT public.has_role(_caller, 'admin'::app_role) THEN RETURN false; END IF;

  INSERT INTO public.credits(user_id, balance) VALUES (_target_user, _amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.credits.balance + EXCLUDED.balance, updated_at = now();

  INSERT INTO public.credit_transactions(user_id, amount, reason)
    VALUES (_target_user, _amount, _reason);
  RETURN true;
END; $$;

-- Bloquear EXECUTE público sobre add_credits (solo admins lo invocarán)
REVOKE ALL ON FUNCTION public.add_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, text) TO authenticated;