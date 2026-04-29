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
    INSERT INTO public.credits (user_id, balance) VALUES (NEW.id, 25)
      ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.credit_transactions (user_id, amount, reason)
      VALUES (NEW.id, 25, 'Bienvenida — créditos iniciales');
  END IF;

  RETURN NEW;
END; $function$;

-- Asegurar que el trigger de Supabase Auth existe y apunta a esta función.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();