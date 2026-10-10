-- Display names for the four hens-quiz groups. Team numbers and membership stay put.
UPDATE public.quiz_teams AS team
SET name = rename.new_name
FROM (VALUES
  (1, 'The Reverse Cowgirls'),
  (2, 'The Rough Riders'),
  (3, 'The Bareback Broncos'),
  (4, 'The Brokeback Mountaineers')
) AS rename(team_number, new_name)
WHERE team.team_number = rename.team_number;

UPDATE public.trivia_session
SET team_names = '["The Reverse Cowgirls","The Rough Riders","The Bareback Broncos","The Brokeback Mountaineers"]'::jsonb
WHERE id = 'liv-weekend';
