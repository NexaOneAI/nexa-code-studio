CREATE OR REPLACE FUNCTION public.refund_credits(_amount integer, _reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID := auth.uid();
  _row public.credits%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RETURN false; END IF;

  SELECT * INTO _row FROM public.credits WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Para usuarios ilimitados se registra a 0 (auditoría) y se marca como refund.
  IF _row.unlimited THEN
    INSERT INTO public.credit_transactions(user_id, amount, reason, metadata)
      VALUES (_user_id, 0, 'Reembolso (admin): ' || _reason, jsonb_build_object('type', 'refund', 'original_reason', _reason));
    RETURN true;
  END IF;

  UPDATE public.credits
    SET balance = balance + _amount, updated_at = now()
    WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions(user_id, amount, reason, metadata)
    VALUES (_user_id, _amount, 'Reembolso: ' || _reason, jsonb_build_object('type', 'refund', 'original_reason', _reason));
  RETURN true;
END; $function$;