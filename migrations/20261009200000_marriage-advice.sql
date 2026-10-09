-- Marriage advice for Liv: one optional note per guest, written after the
-- Family Feud pre-quiz. Apply once after the Family Feud migration. There is
-- no public read of other guests' advice; authors stay private.
CREATE TABLE public.quiz_advice (
  guest_id uuid PRIMARY KEY REFERENCES public.quiz_team_members(guest_id),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 280),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_advice ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_advice FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.quiz_advice_mine(p_guest_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT body FROM public.quiz_advice WHERE guest_id = p_guest_id $$;

-- Saving blank text removes the guest's advice.
CREATE FUNCTION public.quiz_advice_save(p_guest_id uuid, p_body text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_guest_id = (SELECT liv_guest_id FROM public.feud_settings WHERE singleton) THEN
    RAISE EXCEPTION 'Nice try, Liv! This advice is for you';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quiz_team_members WHERE guest_id = p_guest_id) THEN
    RAISE EXCEPTION 'Please select a guest who is playing the quiz';
  END IF;
  IF length(btrim(coalesce(p_body,''))) = 0 THEN
    DELETE FROM public.quiz_advice WHERE guest_id = p_guest_id;
  ELSIF length(btrim(p_body)) > 280 THEN
    RAISE EXCEPTION 'Please keep your advice to 280 characters';
  ELSE
    INSERT INTO public.quiz_advice (guest_id,body) VALUES (p_guest_id,btrim(p_body))
      ON CONFLICT (guest_id) DO UPDATE SET body = EXCLUDED.body, updated_at = now();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.quiz_advice_mine(uuid), public.quiz_advice_save(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_advice_mine(uuid), public.quiz_advice_save(uuid,text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
