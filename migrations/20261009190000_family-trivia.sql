-- Round 5 "Family Trivia": one real story and three fakes per question, shown as
-- short text options. Runs on the live-round engine from rounds 2–3. Apply once
-- after the live-quiz-rounds migration. Preserves all saved play.
ALTER TABLE public.quiz_live_rounds DROP CONSTRAINT quiz_live_rounds_slug_check;
ALTER TABLE public.quiz_live_rounds ADD CONSTRAINT quiz_live_rounds_slug_check CHECK (slug IN ('fake','stories','family'));
-- The full story the host reads aloud. Hidden from guests until the reveal.
ALTER TABLE public.quiz_live_questions ADD COLUMN story text CHECK (length(btrim(story)) BETWEEN 1 AND 4000);
ALTER TABLE public.quiz_live_questions DROP CONSTRAINT quiz_live_questions_check;
ALTER TABLE public.quiz_live_questions ADD CONSTRAINT quiz_live_questions_check CHECK (
  (round_slug IN ('fake','family') AND jsonb_array_length(options) = 4 AND answer IN ('A','B','C','D'))
  OR (round_slug = 'stories' AND options = '[]'::jsonb));
INSERT INTO public.quiz_live_rounds(slug,title) VALUES ('family','Family Trivia');

-- Same as before, plus 'story' once the question is revealed.
CREATE OR REPLACE FUNCTION public.quiz_live_state(p_round text,p_guest_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE game public.quiz_live_rounds%ROWTYPE; question public.quiz_live_questions%ROWTYPE; my_team uuid; revealed boolean;
BEGIN
  SELECT * INTO STRICT game FROM public.quiz_live_rounds WHERE slug=p_round;
  SELECT * INTO question FROM public.quiz_live_questions WHERE id=game.current_question_id;
  SELECT team_id INTO my_team FROM public.quiz_team_members WHERE guest_id=p_guest_id;
  revealed:=EXISTS(SELECT 1 FROM public.quiz_live_results WHERE question_id=question.id);
  RETURN jsonb_build_object('slug',game.slug,'title',game.title,'phase',game.phase,
    'current_question_id',game.current_question_id,'updated_at',game.updated_at,
    'points_per_correct',game.points_per_correct,'my_team_id',my_team,
    'liv_guest_id',(SELECT liv_guest_id FROM public.feud_settings WHERE singleton),
    'total_questions',(SELECT count(*) FROM public.quiz_live_questions WHERE round_slug=p_round AND enabled),
    'question_number',(SELECT count(*) FROM public.quiz_live_questions WHERE round_slug=p_round AND enabled AND position<=question.position),
    'revealed_count',(SELECT count(DISTINCT r.question_id) FROM public.quiz_live_results r JOIN public.quiz_live_questions q ON q.id=r.question_id WHERE q.round_slug=p_round),
    'prompt',question.prompt,'options',coalesce(question.options,'[]'::jsonb),
    'correct_answer',CASE WHEN revealed THEN question.answer END,
    'story',CASE WHEN revealed THEN question.story END,
    'teams',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.team_number) FROM (
      SELECT team.id,team.name,team.team_number,c.guest_id AS captain_id,m.display_name AS captain_name,
        s.team_id IS NOT NULL AS submitted,
        CASE WHEN revealed OR team.id=my_team THEN s.answer END AS answer,
        CASE WHEN revealed THEN r.correct END AS correct,
        coalesce((SELECT count(*)*game.points_per_correct FROM public.quiz_live_results result
          JOIN public.quiz_live_questions q ON q.id=result.question_id
          WHERE result.team_id=team.id AND q.round_slug=p_round AND result.correct),0) AS points
      FROM public.quiz_teams team LEFT JOIN public.quiz_team_captains c ON c.team_id=team.id
      LEFT JOIN public.quiz_team_members m ON m.guest_id=c.guest_id
      LEFT JOIN public.quiz_live_submissions s ON s.team_id=team.id AND s.question_id=question.id
      LEFT JOIN public.quiz_live_results r ON r.team_id=team.id AND r.question_id=question.id
    )t));
END $$;

-- Same as before, plus the current story before the reveal.
CREATE OR REPLACE FUNCTION public.quiz_live_host_state(p_key text,p_round text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  RETURN public.quiz_live_state(p_round,NULL)||jsonb_build_object(
    'correct_answer',(SELECT q.answer FROM public.quiz_live_questions q JOIN public.quiz_live_rounds g ON g.current_question_id=q.id WHERE g.slug=p_round),
    'story',(SELECT q.story FROM public.quiz_live_questions q JOIN public.quiz_live_rounds g ON g.current_question_id=q.id WHERE g.slug=p_round),
    'teams',(SELECT jsonb_agg(team||jsonb_build_object('answer',s.answer,'submitted_by',m.display_name) ORDER BY (team->>'team_number')::int)
      FROM jsonb_array_elements(public.quiz_live_state(p_round,NULL)->'teams')team
      LEFT JOIN public.quiz_live_submissions s ON s.team_id=(team->>'id')::uuid AND s.question_id=(SELECT current_question_id FROM public.quiz_live_rounds WHERE slug=p_round)
      LEFT JOIN public.quiz_team_members m ON m.guest_id=s.guest_id),
    'questions',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'position',q.position,'prompt',q.prompt,'answer',q.answer,'enabled',q.enabled,
      'revealed',EXISTS(SELECT 1 FROM public.quiz_live_results WHERE question_id=q.id)) ORDER BY q.position),'[]'::jsonb) FROM public.quiz_live_questions q WHERE round_slug=p_round));
END $$;

-- Family Trivia answers are A–D like Real or Fake.
CREATE OR REPLACE FUNCTION public.quiz_live_submit(p_guest_id uuid,p_round text,p_question_id integer,p_answer text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ DECLARE game public.quiz_live_rounds%ROWTYPE; my_team uuid;
BEGIN
  SELECT * INTO STRICT game FROM public.quiz_live_rounds WHERE slug=p_round FOR SHARE;
  IF game.phase<>'question' OR game.current_question_id IS DISTINCT FROM p_question_id THEN RAISE EXCEPTION 'Answers are locked for this question'; END IF;
  SELECT team_id INTO my_team FROM public.quiz_team_members WHERE guest_id=p_guest_id;
  PERFORM 1 FROM public.quiz_team_captains WHERE team_id=my_team AND guest_id=p_guest_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only your team captain can submit the shared answer'; END IF;
  IF p_answer IS NULL OR length(btrim(p_answer)) NOT BETWEEN 1 AND 500
    OR (p_round IN ('fake','family') AND p_answer NOT IN ('A','B','C','D')) THEN RAISE EXCEPTION 'Choose or type a valid answer'; END IF;
  INSERT INTO public.quiz_live_submissions(question_id,team_id,answer,guest_id) VALUES(p_question_id,my_team,btrim(p_answer),p_guest_id)
    ON CONFLICT(question_id,team_id) DO UPDATE SET answer=EXCLUDED.answer,guest_id=EXCLUDED.guest_id,updated_at=now();
END $$;

-- Family Trivia is scored automatically on reveal, like Real or Fake.
CREATE OR REPLACE FUNCTION public.quiz_live_action(p_key text,p_round text,p_action text,p_question_id integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ DECLARE game public.quiz_live_rounds%ROWTYPE; next_id integer;
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  SELECT * INTO STRICT game FROM public.quiz_live_rounds WHERE slug=p_round FOR UPDATE;
  IF game.current_question_id IS DISTINCT FROM p_question_id THEN RAISE EXCEPTION 'The round has moved on. Please refresh'; END IF;
  IF p_action='start' AND game.phase='lobby' THEN
    SELECT id INTO next_id FROM public.quiz_live_questions WHERE round_slug=p_round AND enabled ORDER BY position LIMIT 1;
    IF next_id IS NULL THEN RAISE EXCEPTION 'Add or enable at least one question before starting'; END IF;
    UPDATE public.quiz_live_rounds SET phase='question',current_question_id=next_id,updated_at=now() WHERE slug=p_round;
  ELSIF p_action='lock' AND game.phase='question' THEN
    UPDATE public.quiz_live_rounds SET phase='locked',updated_at=now() WHERE slug=p_round;
  ELSIF p_action='reopen' AND game.phase='locked' THEN
    UPDATE public.quiz_live_rounds SET phase='question',updated_at=now() WHERE slug=p_round;
  ELSIF p_action='reveal' AND game.phase='locked' THEN
    INSERT INTO public.quiz_live_results(question_id,team_id,correct)
      SELECT p_question_id,t.id,CASE WHEN s.answer IS NULL THEN false WHEN p_round IN ('fake','family') THEN s.answer=q.answer ELSE NULL END
      FROM public.quiz_teams t JOIN public.quiz_live_questions q ON q.id=p_question_id
      LEFT JOIN public.quiz_live_submissions s ON s.team_id=t.id AND s.question_id=p_question_id;
    UPDATE public.quiz_live_rounds SET phase='reveal',updated_at=now() WHERE slug=p_round;
  ELSIF p_action='leaderboard' AND game.phase='reveal' THEN
    IF EXISTS(SELECT 1 FROM public.quiz_live_results WHERE question_id=p_question_id AND correct IS NULL) THEN RAISE EXCEPTION 'Judge all submitted team answers first'; END IF;
    UPDATE public.quiz_live_rounds SET phase='leaderboard',updated_at=now() WHERE slug=p_round;
  ELSIF (p_action='next' AND game.phase IN ('reveal','leaderboard')) OR (p_action='skip' AND game.phase IN ('question','locked')) THEN
    IF EXISTS(SELECT 1 FROM public.quiz_live_results WHERE question_id=p_question_id AND correct IS NULL) THEN RAISE EXCEPTION 'Judge all submitted team answers first'; END IF;
    SELECT id INTO next_id FROM public.quiz_live_questions WHERE round_slug=p_round AND enabled
      AND position>(SELECT position FROM public.quiz_live_questions WHERE id=p_question_id) ORDER BY position LIMIT 1;
    UPDATE public.quiz_live_rounds SET phase=CASE WHEN next_id IS NULL THEN 'finished' ELSE 'question' END,
      current_question_id=coalesce(next_id,current_question_id),updated_at=now() WHERE slug=p_round;
  ELSE RAISE EXCEPTION 'That action is not available at this stage of the round'; END IF;
END $$;

-- Family Trivia questions are preloaded here, so the host can only include/exclude them.
CREATE OR REPLACE FUNCTION public.quiz_live_edit_question(p_key text,p_round text,p_id integer,p_prompt text,p_answer text,p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ DECLARE game public.quiz_live_rounds%ROWTYPE;
BEGIN
  IF NOT public.feud_check_access(p_key,'host') THEN RAISE EXCEPTION 'Invalid host access code'; END IF;
  SELECT * INTO STRICT game FROM public.quiz_live_rounds WHERE slug=p_round FOR UPDATE;
  IF game.phase<>'lobby' THEN RAISE EXCEPTION 'Questions are fixed once the round starts'; END IF;
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'Choose whether this question is included'; END IF;
  IF p_round IN ('fake','family') THEN
    UPDATE public.quiz_live_questions SET enabled=p_enabled WHERE id=p_id AND round_slug=p_round;
    IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;
  ELSIF p_id IS NULL THEN
    IF (SELECT count(*) FROM public.quiz_live_questions WHERE round_slug=p_round)>=100 THEN RAISE EXCEPTION 'This round supports up to 100 questions'; END IF;
    INSERT INTO public.quiz_live_questions(round_slug,position,prompt,answer,enabled)
      SELECT p_round,coalesce(max(position),0)+1,btrim(p_prompt),btrim(p_answer),p_enabled FROM public.quiz_live_questions WHERE round_slug=p_round;
  ELSE
    IF EXISTS(SELECT 1 FROM public.quiz_live_results WHERE question_id=p_id) THEN RAISE EXCEPTION 'Played questions cannot be edited'; END IF;
    UPDATE public.quiz_live_questions SET prompt=btrim(p_prompt),answer=btrim(p_answer),enabled=p_enabled WHERE id=p_id AND round_slug=p_round;
    IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;
  END IF;
  UPDATE public.quiz_live_rounds SET updated_at=now() WHERE slug=p_round;
END $$;

-- Adds a 'family' column to the overall leaderboard.
CREATE OR REPLACE FUNCTION public.quiz_overall_scores() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT jsonb_agg(to_jsonb(scores)||jsonb_build_object('total',scores.feud+scores.fake+scores.stories+scores.ben+scores.family) ORDER BY scores.feud+scores.fake+scores.stories+scores.ben+scores.family DESC,scores.team_number)
FROM (
  SELECT t.id,t.name,t.team_number,
    coalesce((SELECT (team->>'points')::numeric FROM jsonb_array_elements(public.feud_state()->'teams')team WHERE (team->>'id')::uuid=t.id),0) AS feud,
    coalesce((SELECT count(*)*g.points_per_correct FROM public.quiz_live_results r JOIN public.quiz_live_questions q ON q.id=r.question_id JOIN public.quiz_live_rounds g ON g.slug=q.round_slug WHERE r.team_id=t.id AND q.round_slug='fake' AND r.correct GROUP BY g.points_per_correct),0) AS fake,
    coalesce((SELECT count(*)*g.points_per_correct FROM public.quiz_live_results r JOIN public.quiz_live_questions q ON q.id=r.question_id JOIN public.quiz_live_rounds g ON g.slug=q.round_slug WHERE r.team_id=t.id AND q.round_slug='stories' AND r.correct GROUP BY g.points_per_correct),0) AS stories,
    (SELECT count(*) FROM public.ben_predictions p JOIN public.ben_results r ON r.question_id=p.question_id AND r.liv_right=p.liv_right WHERE p.team_id=t.id) AS ben,
    coalesce((SELECT count(*)*g.points_per_correct FROM public.quiz_live_results r JOIN public.quiz_live_questions q ON q.id=r.question_id JOIN public.quiz_live_rounds g ON g.slug=q.round_slug WHERE r.team_id=t.id AND q.round_slug='family' AND r.correct GROUP BY g.points_per_correct),0) AS family
  FROM public.quiz_teams t
)scores $$;

INSERT INTO public.quiz_live_questions(round_slug,position,prompt,options,answer,story)
SELECT 'family',v.position,v.prompt,
  jsonb_build_array(jsonb_build_object('key','A','text',v.a),jsonb_build_object('key','B','text',v.b),
    jsonb_build_object('key','C','text',v.c),jsonb_build_object('key','D','text',v.d)),
  v.answer,v.story
FROM (VALUES
(1,'What happened the first time Liv rode her bike without training wheels?',
  'Rode into the Cornhill fish pond','Crashed into Mum''s freshly pruned roses','Created a permanent dent on Dad''s two week old car','Ran into Grandpa Bob','B',
  'Mum was teaching Liv to ride without training wheels at Cornhill. She gave her a big push off from the garden outside the kitchen window, and Liv veered straight into the massive pile of rose bushes Mum had just pruned. She came off the bike right into the thorns!'),
(2,'Liv is the only one of us kids who got a detention in primary school. What was it for?',
  'Running a lolly black market','Forging Mum''s signature','Loo-roll bombing the toilet ceiling','Locking the teacher out of class','C',
  'At Grimwade, Liv was in the girls'' toilets giving a masterclass: scrunch up some loo roll, wet it, then ping it onto the ceiling, where it would set like concrete. Mid-demonstration she noticed everything had gone very quiet. It was Miss Trunchbull (aka that awful deputy head), who grabbed her and marched her off. She is the only child in our family who had a detention in primary school!'),
(3,'We once had a turkey called Tom Turkey. What was his relationship with Liv?',
  'Friendly - He would always follow her around all day','Thirsty - Tried to hump her while she collected eggs','Devious - Stole her food on at least four separate occasions','Territorial - Once shat on her school bag','B',
  'We used to have a turkey called Tom Turkey, and he took a real fancy to Liv. He''d strut around trying to impress her with his plumage, and one day, when she bent over to pick up some eggs, he tried to mount her!'),
(4,'In Grade 6 Liv started a dog-walking business. Why did another dog owner keep screaming at her?',
  'Lost a client''s dog at Gasworks','Walked the wrong dog home','Charged a double fee for ''zoomies''','Her client''s dog kept trying to rawdog a Frenchie','D',
  'In Grade 6 Liv set up her own dog-walking business. Her main client was a massive dog she walked a few times a week, full of energy after being cooped up all day. At Gasworks Park it would terrorise a French Bulldog it fancied and try to hump it, while the owner screamed at Liv to keep her dog under control!'),
(5,'Mum was in hospital for a day procedure, so the kids had to get themselves home. What happened to 8-year-old Liv?',
  'Tried to be adopted by another family','Told the head teacher her mum was dead','Got off at the wrong stop','Spent the tram money on lollies, then got busted','A',
  'Mum was in hospital for a day procedure, so the kids had to get themselves home. Liv was about 8. On the light rail she was using the hand rails as monkey bars, and when they reached Albert Park station Harry and Vic jumped off, leaving Liv on the tram. They rang the South Melbourne police, who said they''d send a squad car round to sort it out. Ten minutes later a tearful Liv was led back to them by a kind passenger who had seen it all happen, got off at the next stop and brought her back safely.'),
(6,'What did Liv do most to annoy God?',
  'Drank the full communion goblet as a dare','Won the Penis Game during a Latin Mass','Turned up fully naked to ring the chapel bell','Came to church straight from Revs','C',
  'The Nudie Chapel Dash! At midnight, Liv''s unit ran up to the chapel wearing nothing but runners and balaclavas, and rang the bell. One of the male teachers saw them but couldn''t identify them properly. They were all interrogated the next day, and punishment was handed out.'),
(7,'Why did Harry and Vic roll Liv down a hill in a barrel?',
  'She lost a bet','Read about it in a book','Experiment to see the impact of gravity','A Funniest Home Videos audition','D',
  'We wanted to go on Funniest Home Videos, and thought this would be good. The only issue is we didn''t have a camera to record it, so this was just a proof of concept.'),
(8,'Liv played a very special role at Harry''s 21st. What was it?',
  'She DJed for an hour off her iPod Nano','She did an elaborate rap that featured the line, "I''m queen bitch of Albert Park"','Was shackled to a homemade box and sawn in half','Did an interpretive dance featuring several Australian Animals, including the "Goana"','C',
  'It was a magic-themed party. Liv was shackled inside the "Incredible Box of Doom", which Harry had handmade with zero carpentry experience, and then she was sawn in half. Thanks to magic, she lives another day!'),
(9,'A family was "pranked" by Liv when they first arrived to our home, went ballistic, and threatened to drive three hours home. Why?',
  'She put a chicken in their room','Dressed up as a ghost and scared them','Jumped in front of the car and pretended to be hit','Wrapped a dead snake around the doormat','D',
  'Dad had killed a snake the night before, and had it in two pieces. In the morning, we coiled the snake up so you couldn''t see the cut, and when our guests arrived, they saw the snake and went ballistic.'),
(10,'The Wetherall Siblings had a big house party while their parents were gone. How did they find out?',
  'The neighbours dobbed us in','They saw the photos on Facebook','20 litres of coke were ordered on their credit card','They found used underwear in their bed','C',
  'Mum and Dad left us money for food while they were away. We thought we''d outsmarted them by buying the drinks separately. But Mum and Dad spotted 20 litres of Coke on their credit card!')
) v(position,prompt,a,b,c,d,answer,story);
