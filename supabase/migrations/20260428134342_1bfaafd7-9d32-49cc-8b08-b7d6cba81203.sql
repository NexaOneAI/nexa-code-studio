-- Enable realtime for credit_purchases (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'credit_purchases'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_purchases';
  END IF;
END $$;

ALTER TABLE public.credit_purchases REPLICA IDENTITY FULL;