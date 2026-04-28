-- 1) Reforzar consume_credits: bypass explícito si el usuario es admin.
CREATE OR REPLACE FUNCTION public.consume_credits(_amount integer, _reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID := auth.uid();
  _row public.credits%ROWTYPE;
  _is_admin boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RETURN false; END IF;

  -- Bypass total para admin: registra la transacción a 0 y devuelve true.
  _is_admin := public.has_role(_user_id, 'admin'::app_role);
  IF _is_admin THEN
    INSERT INTO public.credit_transactions(user_id, amount, reason)
      VALUES (_user_id, 0, _reason || ' (admin)');
    RETURN true;
  END IF;

  SELECT * INTO _row FROM public.credits WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
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
END; $function$;

-- 2) Trigger: si el nuevo usuario tiene el email admin, asignarle rol admin y créditos ilimitados.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin_email boolean := (NEW.email = 'nexaapporg@gmail.com');
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  IF _is_admin_email THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.credits (user_id, balance, unlimited) VALUES (NEW.id, 0, true)
      ON CONFLICT (user_id) DO UPDATE SET unlimited = true;
    INSERT INTO public.credit_transactions (user_id, amount, reason)
      VALUES (NEW.id, 0, 'Admin granted unlimited credits');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.credits (user_id, balance) VALUES (NEW.id, 10)
      ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.credit_transactions (user_id, amount, reason)
      VALUES (NEW.id, 10, 'Welcome bonus');
  END IF;

  RETURN NEW;
END; $function$;

-- Asegurar trigger conectado a auth.users (idempotente).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Aplicación retroactiva: si el usuario ya existe en perfiles, promoverlo ahora.
DO $$
DECLARE
  _uid uuid;
BEGIN
  SELECT user_id INTO _uid FROM public.profiles WHERE email = 'nexaapporg@gmail.com' LIMIT 1;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.credits(user_id, balance, unlimited) VALUES (_uid, 0, true)
      ON CONFLICT (user_id) DO UPDATE SET unlimited = true, updated_at = now();
  END IF;
END $$;