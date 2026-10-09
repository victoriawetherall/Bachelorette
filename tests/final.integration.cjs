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
  for (const file of ['20261008170000_quiz-teams.sql','20261008183000_family-feud.sql','20261009120000_ben-round.sql','20261009143000_live-quiz-rounds.sql','20261009143100_facebook-content.sql','20261009190000_family-trivia.sql','20261009200000_marriage-advice.sql','20261009210000_guest-flow.sql','20261009220000_final-round.sql','20261009230000_blind-ranking.sql'])
    ok(`SET ROLE project_admin; ${fs.readFileSync(`migrations/${file}`, 'utf8')}`, database, true);
  ok(`UPDATE public.feud_settings SET host_key_hash=encode(sha256(convert_to('${hostKey}','UTF8')),'hex');`);

  // Lobby: nothing to start, and no card text is public.
  assert.equal(state().phase, 'lobby');
  assert.equal(JSON.parse(ok(asGuest('SELECT public.quiz_progress();'))).final, 'lobby');
  deniedAct('start', null, null, /No one has written any advice/);
  denied(asGuest(`SELECT public.quiz_final_host_state('wrong-code-wrong-code');`), /Invalid host access code/);
  denied(asGuest(`SELECT public.quiz_final_action('wrong-code-wrong-code','start',NULL,NULL);`), /Invalid host access code/);
  const writers = { Bri: 'Never go to bed angry.', Deb: 'Always say yes, dear.', Sue: 'Separate bathrooms.', Vic: 'Laugh at his jokes.',
    Bec: 'Date nights forever.', Lisa: 'Pick your battles.', Nancy: 'Two duvets.' };
  for (const [name, body] of Object.entries(writers)) save(name, body);
  assert.deepEqual(state().entries, [], 'Card text stays private in the lobby');
  assert.equal(state().entry_count, 7);
  assert.ok(!hostState().missing.includes('Bri') && hostState().missing.includes('Bella') && !hostState().missing.includes('Liv'));

  // Start: advice locks; only the first card is out.
  act('start');
  denied(asGuest(`SELECT public.quiz_advice_save('${member('Bella')}','Too late');`), /advice is locked in/);
  denied(asGuest(`SELECT public.quiz_advice_save('${member('Bri')}','');`), /advice is locked in/);
  let s = state();
  assert.equal(s.phase, 'ranking'); assert.equal(s.places, 5); assert.equal(s.current, 1); assert.equal(s.max_swaps, 3);
  assert.deepEqual(s.entries.map((e) => [e.no, e.rank]), [[1, null]], 'Future cards stay hidden');
  assert.equal(hostState().entries.length, 1, 'Host cannot peek ahead either');
  assert.ok(!JSON.stringify(s).includes('"author"'), 'No authors before reveal');

  // Blind placing, one card at a time. Liv's spots: card n goes to spot order[n-1].
  const order = [6, 1, 3, 7, 2, 5, 4];
  deniedAct('place', 8, null, /from #1 to #7/);
  deniedAct('swap', 1, 2, /not available/);
  deniedAct('lock', null, null, /not available/);
  act('place', order[0]);
  deniedAct('place', order[0], null, /already taken/);
  act('place', 2); act('undo'); // mis-tap on card 2, taken back
  s = state();
  assert.equal(s.current, 2); assert.deepEqual(s.entries.map((e) => e.rank), [order[0], null]);
  for (const spot of order.slice(1)) act('place', spot);
  s = state();
  assert.equal(s.current, null); assert.equal(s.entries.length, 7); assert.equal(s.last_placed, 7);
  deniedAct('place', 1, null, /not available/);
  const authorAt = (rank) => Object.entries(writers).find(([, body]) => body === state().entries.find((e) => e.rank === rank).body)[0];

  // Three swaps; undo refunds one.
  const before = [1, 2, 3, 4, 5].map(authorAt);
  deniedAct('swap', 1, 1, /two different spots/);
  deniedAct('swap', 1, 9, /two different spots/);
  act('swap', 1, 7); act('undo');
  assert.equal(state().swaps_used, 0); assert.equal(authorAt(1), before[0]);
  act('swap', 1, 2); act('swap', 5, 6); act('swap', 3, 4);
  s = state();
  assert.equal(s.swaps_used, 3); assert.deepEqual(s.last_swap, [3, 4]);
  deniedAct('swap', 1, 2, /used all 3 swaps/);
  assert.equal(authorAt(1), before[1]); assert.equal(authorAt(2), before[0]);
  assert.equal(authorAt(3), before[3]); assert.equal(authorAt(4), before[2]);
  const top = [1, 2, 3, 4, 5].map(authorAt);
  assert.deepEqual(Object.values(scores()).filter(Boolean), [], 'Nothing scores before reveal');

  // Lock, then reveal 5th up to 1st. Repeats are harmless; skipping ahead is refused.
  deniedAct('reveal', 5, null, /not available/);
  act('lock');
  deniedAct('undo', null, null, /not available/);
  deniedAct('reveal', 4, null, /in order/);
  deniedAct('finish', null, null, /not available/);
  act('reveal', 5); act('reveal', 5);
  s = state();
  assert.equal(s.revealed_places, 1);
  assert.deepEqual(s.entries.filter((e) => e.author).map((e) => [e.rank, e.author, e.points]), [[5, top[4], 1]]);
  assert.equal(scores()[teamName(top[4])], 1);
  for (const rank of [4, 3, 2, 1]) act('reveal', rank);
  s = state();
  assert.deepEqual(s.entries.filter((e) => e.author).sort((a, b) => a.rank - b.rank).map((e) => [e.rank, e.author, e.team, e.points]),
    top.map((name, i) => [i + 1, name, teamName(name), 5 - i]));
  assert.ok(s.entries.filter((e) => e.rank > 5).every((e) => !e.author), 'Spots below the top 5 stay anonymous');
  const expected = {};
  top.forEach((name, i) => { expected[teamName(name)] = (expected[teamName(name)] || 0) + 5 - i; });
  for (const [team, points] of Object.entries(scores())) assert.equal(points, expected[team] || 0, `${team} final points`);
  const totals = JSON.parse(ok(asGuest('SELECT public.quiz_overall_scores();')));
  assert.ok(totals.every((team) => team.total === team.feud + team.fake + team.stories + team.ben + team.family + team.final));
  act('finish');
  assert.equal(state().phase, 'finished');
  assert.equal(JSON.parse(ok(asGuest('SELECT public.quiz_progress();'))).final, 'finished');

  // Private tables stay private.
  denied(asGuest('SELECT * FROM public.quiz_final_swaps;'), /permission denied/);
  denied(asGuest('SELECT public.quiz_final_points(1);'), /permission denied/);
  console.log('Final Round integration checks passed.');
} finally {
  if (process.argv.includes('--keep')) console.log(`Kept rehearsal database: ${database}`);
  else ok(`DROP DATABASE ${database};`,'postgres');
}
