// Run against a disposable local PostgreSQL instance. Creates its own database.
// Usage: node tests/ben.integration.cjs <socket-directory> [port] [--keep]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const socket = process.argv[2];
const port = process.argv[3] || '55468';
if (!socket?.startsWith('/')) throw new Error('Pass the socket directory of a disposable local PostgreSQL instance.');
const database = `quiz_ben_test_${Date.now()}`;
const hostKey = 'test-host-access-code-only';
const livKey = 'test-liv-access-code-only';
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
const memberId = (name) => ok(`SELECT guest_id FROM public.quiz_team_members WHERE display_name='${name}';`);
const state = (name) => JSON.parse(ok(asGuest(`SELECT public.ben_state(${name ? `'${memberId(name)}'` : 'NULL'});`)));
const hostState = () => JSON.parse(ok(asGuest(`SELECT public.ben_host_state('${hostKey}');`)));
const action = (name, id = 'NULL') => ok(asGuest(`SELECT public.ben_host_action('${hostKey}','${name}',${id});`));
const predict = (name, id, right) => ok(asGuest(`SELECT public.ben_save_prediction('${memberId(name)}',${id},${right});`));
const points = () => Object.fromEntries(state().teams.map((team) => [team.team_number, team.points]));
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
  GRANT ALL ON public.guests TO project_admin;`);
  for (const file of ['migrations/20261008170000_quiz-teams.sql','migrations/20261008183000_family-feud.sql','migrations/20261009120000_ben-round.sql']) {
    ok(`SET ROLE project_admin; ${fs.readFileSync(file,'utf8')}`,database,true);
  }
  ok(`UPDATE public.feud_settings SET host_key_hash=encode(sha256(convert_to('${hostKey}','UTF8')),'hex'),liv_key_hash=encode(sha256(convert_to('${livKey}','UTF8')),'hex');`);

  denied(asGuest('SELECT * FROM public.ben_questions;'), /permission denied/);
  denied(asGuest(`SELECT public.ben_host_state('${livKey}');`), /Invalid host access code/);
  denied(asGuest(`SELECT public.ben_host_action('${livKey}','start',NULL);`), /Invalid host access code/);
  let s = state();
  assert.equal(s.phase, 'lobby'); assert.equal(s.total_questions, 16); assert.equal(s.prompt, null);
  denied(asGuest(`SELECT public.ben_save_prediction('${memberId('Bri')}',1,true);`), /locked/);

  action('start');
  s = state('Bri');
  assert.equal(s.phase, 'question'); assert.equal(s.question_number, 1);
  assert.equal(s.prompt, 'What\'s your best dish?');
  assert.equal(s.ben_answer, null, 'Ben\'s answer must stay hidden while predicting');
  predict('Bri', 1, true); predict('Lucy', 1, false); // Team 2: last teammate wins
  predict('Sue', 1, true); predict('Matilda', 1, false);
  denied(asGuest(`SELECT public.ben_save_prediction('${memberId('Liv')}',1,true);`), /Nice try, Liv/);
  denied(asGuest(`SELECT public.ben_save_prediction('${memberId('Bri')}',2,true);`), /locked/);
  s = state('Bec');
  const team = (st, n) => st.teams.find((t) => t.team_number === n);
  assert.equal(team(s, 2).prediction, false, 'Teammates see their own team\'s pick');
  assert.equal(team(s, 1).prediction, null, 'Other teams\' picks stay hidden while predicting');
  assert.equal(team(s, 1).submitted, true); assert.equal(team(s, 4).submitted, false);
  assert.equal(hostState().ben_answer.startsWith('Probably a disgustingly'), true, 'Host sees the answer early');
  assert.equal(hostState().teams.find((t) => t.team_number === 2).submitted_by, 'Lucy');

  denied(asGuest(`SELECT public.ben_host_action('${hostKey}','reveal',1);`), /not available/);
  action('lock', 1);
  denied(asGuest(`SELECT public.ben_save_prediction('${memberId('Nancy')}',1,true);`), /locked/);
  s = state();
  assert.equal(team(s, 1).prediction, true, 'Picks are public once locked');
  assert.equal(s.ben_answer, null);
  action('reopen', 1); predict('Nancy', 1, true); action('lock', 1);
  action('reveal', 1);
  assert.match(state().ben_answer, /salmon bowl/);
  assert.equal(state().liv_right, null);
  action('liv_right', 1);
  assert.deepEqual(points(), {1: 1, 2: 0, 3: 0, 4: 1});
  assert.equal(state().liv_right, true);
  action('liv_wrong', 1); // change of heart before moving on
  assert.deepEqual(points(), {1: 0, 2: 1, 3: 1, 4: 0});
  action('liv_wrong', 1); // repeated ruling never double-counts
  assert.deepEqual(points(), {1: 0, 2: 1, 3: 1, 4: 0});
  action('leaderboard', 1);
  action('next', 1);
  s = state();
  assert.equal(s.phase, 'question'); assert.equal(s.current_question_id, 2);
  assert.equal(s.ben_answer, null); assert.equal(s.liv_right, null);
  assert.equal(team(s, 1).submitted, false);
  denied(asGuest(`SELECT public.ben_host_action('${hostKey}','lock',1);`), /moved on/);

  // Skip question 2, then play the rest; Team 3 always says "right".
  action('next', 2);
  for (let id = 3; id <= 16; id++) {
    predict('Deb', id, true);
    action('lock', id); action('reveal', id); action(id % 2 ? 'liv_right' : 'liv_wrong', id); action('next', id);
  }
  s = state();
  assert.equal(s.phase, 'finished'); assert.equal(s.judged_count, 15);
  assert.equal(points()[3], 1 + 7, 'Q1 wrong + the seven odd questions from 3 to 15');
  assert.equal(s.ben_answer, null);
  ok(asGuest(`SELECT public.ben_correct_result('${hostKey}',4,true);`));
  assert.equal(points()[3], 9, 'Corrections recalculate totals');
  denied(asGuest(`SELECT public.ben_correct_result('${hostKey}',2,true);`), /Only a judged question/);
  denied(asGuest(`SELECT public.ben_host_action('${hostKey}','next',16);`), /not available/);
  console.log('ben.integration: all checks passed');
} finally {
  if (!process.argv.includes('--keep')) ok(`DROP DATABASE ${database} WITH (FORCE);`, 'postgres');
}
