// Run against a disposable local PostgreSQL instance. Creates its own database.
// Usage: node tests/final.integration.cjs <socket-directory> [port] [--keep]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const socket = process.argv[2];
const port = process.argv[3] || '55468';
if (!socket?.startsWith('/')) throw new Error('Pass the socket directory of a disposable local PostgreSQL instance.');
const database = `quiz_final_test_${Date.now()}`;
const hostKey = 'test-host-access-code-only';
function query(sql, db = database, transaction = false) {
  return spawnSync('psql', ['-h',socket,'-p',port,'-d',db,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1',...(transaction ? ['--single-transaction'] : [])], {input:sql,encoding:'utf8'});
}
function ok(sql, db, transaction) {
  const result = query(sql, db, transaction);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function denied(sql, pattern) {
  const result = query(sql);
  assert.notEqual(result.status, 0, 'Expected request to be denied');
  assert.match(result.stderr, pattern);
}
const asGuest = (sql) => `SET ROLE anon; ${sql}`;
const member = (name) => ok(`SELECT guest_id FROM public.quiz_team_members WHERE display_name='${name}';`);
const teamName = (name) => ok(`SELECT t.name FROM public.quiz_team_members m JOIN public.quiz_teams t ON t.id=m.team_id WHERE m.display_name='${name}';`);
const save = (name, body) => ok(asGuest(`SELECT public.quiz_advice_save('${member(name)}',$b$${body}$b$);`));
const state = () => JSON.parse(ok(asGuest('SELECT public.quiz_final_state();')));
const hostState = () => JSON.parse(ok(asGuest(`SELECT public.quiz_final_host_state('${hostKey}');`)));
const act = (action, place = 'NULL', no = 'NULL') => ok(asGuest(`SELECT public.quiz_final_action('${hostKey}','${action}',${place},${no});`));
const deniedAct = (action, place, no, pattern) => denied(asGuest(`SELECT public.quiz_final_action('${hostKey}','${action}',${place ?? 'NULL'},${no ?? 'NULL'});`), pattern);
const scores = () => Object.fromEntries(JSON.parse(ok(asGuest('SELECT public.quiz_overall_scores();'))).map((team) => [team.name, team.final]));
ok(`CREATE DATABASE ${database};`, 'postgres');
try {
  ok(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='project_admin') THEN CREATE ROLE project_admin; END IF;
  END; $$;
  GRANT USAGE,CREATE ON SCHEMA public TO project_admin;
  CREATE TABLE public.guests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,created_at timestamptz DEFAULT now());
  INSERT INTO public.guests(name) VALUES ${['Batsho','Bec','Bella','Bri','Claudia','Deb','GP','G-Shez','Lisa','Lucy','Matil','Nancy','Nicole','Sue','The Bride','Vic'].map(n=>`('${n}')`).join(',')};
  GRANT ALL ON public.guests TO project_admin;
  GRANT SELECT ON public.guests TO anon,authenticated;
  ALTER DEFAULT PRIVILEGES FOR ROLE project_admin IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;`);
  for (const file of ['20261008170000_quiz-teams.sql','20261008183000_family-feud.sql','20261009120000_ben-round.sql','20261009143000_live-quiz-rounds.sql','20261009143100_facebook-content.sql','20261009190000_family-trivia.sql','20261009200000_marriage-advice.sql','20261009210000_guest-flow.sql','20261009220000_final-round.sql'])
    ok(`SET ROLE project_admin; ${fs.readFileSync(`migrations/${file}`, 'utf8')}`, database, true);
  ok(`UPDATE public.feud_settings SET host_key_hash=encode(sha256(convert_to('${hostKey}','UTF8')),'hex');`);

  // Lobby: nothing to start, and no card text is public.
  assert.equal(state().phase, 'lobby');
  assert.equal(JSON.parse(ok(asGuest('SELECT public.quiz_progress();'))).final, 'lobby');
  deniedAct('start', null, null, /No one has written any advice/);
  denied(asGuest(`SELECT public.quiz_final_host_state('wrong-code-wrong-code');`), /Invalid host access code/);
  denied(asGuest(`SELECT public.quiz_final_action('wrong-code-wrong-code','start',NULL,NULL);`), /Invalid host access code/);
  const writers = { Bri: 'Never go to bed angry.', Deb: 'Always say yes, dear.', Sue: 'Separate bathrooms.', Vic: 'Laugh at his jokes.' };
  for (const [name, body] of Object.entries(writers)) save(name, body);
  assert.deepEqual(state().entries, [], 'Card text stays private in the lobby');
  assert.equal(state().entry_count, 4);
  assert.ok(!hostState().missing.includes('Bri') && hostState().missing.includes('Bec') && !hostState().missing.includes('Liv'));

  // Start: advice locks and gets shuffled numbers 1..4.
  act('start');
  denied(asGuest(`SELECT public.quiz_advice_save('${member('Bec')}','Too late');`), /advice is locked in/);
  denied(asGuest(`SELECT public.quiz_advice_save('${member('Bri')}','');`), /advice is locked in/);
  let s = state();
  assert.equal(s.phase, 'reading'); assert.equal(s.places, 3);
  assert.deepEqual(s.entries.map((e) => e.no), [1,2,3,4]);
  assert.deepEqual(s.entries.map((e) => e.body).sort(), Object.values(writers).sort());
  assert.ok(!JSON.stringify(s).includes('"author"'), 'No authors before reveal');
  const noOf = (name) => s.entries.find((e) => e.body === writers[name]).no;

  // Awards: a card holds one place; moving it frees the old place.
  deniedAct('award', 4, noOf('Bri'), /1st, 2nd or 3rd/);
  deniedAct('award', 1, 99, /advice cards/);
  act('award', 1, noOf('Deb'));
  act('award', 2, noOf('Deb'));
  assert.deepEqual(state().awards.map((a) => a.place), [2], 'Moving a card frees its old place');
  act('award', 1, noOf('Bri')); act('award', 3, noOf('Sue'));
  act('clear', 3); deniedAct('reveal', 3, null, /Pick all 3 places/);
  act('award', 3, noOf('Sue'));
  assert.ok(state().awards.every((a) => !a.revealed && !a.author));
  assert.deepEqual(Object.values(scores()).filter(Boolean), [], 'Nothing scores before reveal');

  // Reveal in order 3rd, 2nd, 1st. Repeats are harmless; skipping ahead is refused.
  deniedAct('reveal', 1, null, /in order/);
  deniedAct('finish', null, null, /not available/);
  act('reveal', 3); act('reveal', 3);
  s = state();
  assert.equal(s.revealed_places, 1);
  assert.deepEqual(s.awards.filter((a) => a.revealed).map((a) => [a.place, a.author, a.points]), [[3, 'Sue', 1]]);
  assert.ok(!s.awards.find((a) => a.place === 1).author, '1st stays hidden');
  deniedAct('award', 1, noOf('Vic'), /not available/);
  assert.equal(scores()[teamName('Sue')], 1);
  act('reveal', 2); act('reveal', 1); act('reveal', 1);
  s = state();
  assert.equal(s.revealed_places, 3);
  assert.deepEqual(s.awards.map((a) => [a.place, a.author, a.team, a.points]),
    [[1,'Bri',teamName('Bri'),5],[2,'Deb',teamName('Deb'),3],[3,'Sue',teamName('Sue'),1]]);
  const expected = {};
  for (const [name, points] of [['Bri',5],['Deb',3],['Sue',1]]) expected[teamName(name)] = (expected[teamName(name)] || 0) + points;
  for (const [team, points] of Object.entries(scores())) assert.equal(points, expected[team] || 0, `${team} final points`);
  const totals = JSON.parse(ok(asGuest('SELECT public.quiz_overall_scores();')));
  assert.ok(totals.every((team) => team.total === team.feud + team.fake + team.stories + team.ben + team.family + team.final));
  act('finish');
  assert.equal(state().phase, 'finished');
  assert.equal(JSON.parse(ok(asGuest('SELECT public.quiz_progress();'))).final, 'finished');

  // Private tables stay private.
  denied(asGuest('SELECT * FROM public.quiz_final_awards;'), /permission denied/);
  denied(asGuest('SELECT public.quiz_final_points(1);'), /permission denied/);
  console.log('Final Round integration checks passed.');
} finally {
  if (process.argv.includes('--keep')) console.log(`Kept rehearsal database: ${database}`);
  else ok(`DROP DATABASE ${database};`,'postgres');
}
