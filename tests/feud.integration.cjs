// Run against a disposable local PostgreSQL instance. Creates its own database.
// Usage: node tests/feud.integration.cjs <socket-directory> [port] [--keep]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const socket = process.argv[2];
const port = process.argv[3] || '55468';
if (!socket?.startsWith('/')) throw new Error('Pass the socket directory of a disposable local PostgreSQL instance.');
const database = `quiz_feud_test_${Date.now()}`;
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
const state = () => JSON.parse(ok(asGuest('SELECT public.feud_state();')));
const action = (name, id = 'NULL') => ok(asGuest(`SELECT public.feud_host_action('${hostKey}','${name}',${id});`));
const choose = (id, option = 'A') => ok(asGuest(`SELECT public.feud_choose('${livKey}',${id},'${option}');`));
const memberId = (name) => ok(`SELECT guest_id FROM public.quiz_team_members WHERE display_name='${name}';`);
const vote = (name, id, answer) => ok(asGuest(`SELECT public.feud_save_vote('${memberId(name)}',${id},'${answer}');`));
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
  for (const file of ['migrations/20261006220000_add-trivia.sql','migrations/20261007233000_update-party-questions.sql','migrations/20261008021000_partial-survey.sql','migrations/20261008170000_quiz-teams.sql','migrations/20261008183000_family-feud.sql']) {
    ok(`SET ROLE project_admin; ${fs.readFileSync(file,'utf8')}`,database,true);
  }
  ok(`UPDATE public.feud_settings SET host_key_hash=encode(sha256(convert_to('${hostKey}','UTF8')),'hex'),liv_key_hash=encode(sha256(convert_to('${livKey}','UTF8')),'hex');`);
  const legacyVote = (name, answers) => ok(`SET ROLE project_admin; SELECT public.trivia_submit_survey('${memberId(name)}','${JSON.stringify(answers)}'::jsonb);`);
  legacyVote('Bri', {late: 1}); legacyVote('Vic', {late: 3}); legacyVote('Liv', {late: 0});
  vote('Bri', 1, 'A');
  ok(`SET ROLE project_admin; ${fs.readFileSync('migrations/20261008200000_preserve-survey-votes.sql','utf8')}`,database,true);
  const saved = (name) => JSON.parse(ok(asGuest(`SELECT public.feud_ballot('${memberId(name)}');`))).answers;
  assert.equal(saved('Bri')['1'],'A', 'Import must preserve newer quiz answers');
  assert.equal(saved('Vic')['1'],'D', 'Existing survey votes must carry across');
  assert.deepEqual(saved('Liv'),{}, 'Liv cannot earn points from a legacy survey');
  legacyVote('Bri', {late: 1});
  assert.equal(saved('Bri')['1'],'A', 'Unchanged legacy choices must not overwrite newer quiz answers');
  legacyVote('Bri', {late: 2});
  assert.equal(saved('Bri')['1'],'C', 'Changed answers from older open pages must sync');
  assert.equal(ok(asGuest(`SELECT public.feud_check_access('${livKey}','host');`)), 'f');
  assert.equal(ok(asGuest(`SELECT public.feud_check_access(NULL,'host');`)), 'f');
  assert.equal(state().total_questions,20);
  const seededQuestions = JSON.parse(ok('SELECT jsonb_agg(to_jsonb(q) ORDER BY id) FROM public.feud_questions q;'));
  assert.deepEqual(seededQuestions, JSON.parse(fs.readFileSync('src/data/feud-questions.json','utf8')), 'Browser and database questions must agree');
  assert.equal(state().teams.reduce((n,t)=>n+t.eligible_voters,0),15);
  for(const table of ['feud_settings','feud_votes','feud_choices','feud_game']) denied(asGuest(`SELECT * FROM public.${table};`),/permission denied/);
  denied(asGuest(`SELECT public.feud_access_role('${hostKey}');`),/permission denied/);
  denied(`SET ROLE authenticated; UPDATE public.feud_game SET voting_open=false;`,/permission denied/);
  denied(asGuest(`SELECT public.feud_host_action('${livKey}','start');`),/Invalid host access code/);
  denied(asGuest(`SELECT public.feud_save_vote('${memberId('Liv')}',1,'A');`),/Liv chooses her answers live/);
  for(const [name,answer] of Object.entries({'Georgia P':'A',Sue:'A',Lisa:'B',Bri:'A',Lucy:'A',Bec:'B',Matilda:'B',Deb:'B',Nicole:'B',Nancy:'A',Vic:'D',Bella:'B',Batsho:'D'})) vote(name,1,answer);
  vote('Georgia P',1,'B'); vote('Georgia P',1,'A');
  assert.equal(ok('SELECT count(*) FROM public.feud_votes;'),'13');
  assert.equal(JSON.parse(ok(asGuest(`SELECT public.feud_ballot('${memberId('Georgia P')}');`))).answers['1'],'A');
  action('close_votes');
  denied(`SET ROLE project_admin; SELECT public.trivia_submit_survey('${memberId('Bri')}','{"award":0}'::jsonb);`,/Survey closed/);
  assert.equal(saved('Bri')['2'],undefined, 'Closed voting must also block older survey pages');
  denied(asGuest(`SELECT public.feud_save_vote('${memberId('Claudia')}',1,'A');`),/Pre-voting has closed/);
  action('open_votes');
  action('start');
  assert.equal(state().voting_open,false);
  denied(asGuest(`SELECT public.feud_host_action('${hostKey}','score_adjusted',1);`),/not available/);
  denied(asGuest(`SELECT public.feud_save_vote('${memberId('Bri')}',2,'A');`),/Pre-voting has closed/);
  choose(1); choose(1);
  let current=state();
  assert.equal(current.phase,'locked');
  assert.equal(current.chosen_option,null);
  assert.equal(current.distribution,null);
  assert.deepEqual(current.teams.map(t=>t.points),[0,0,0,0]);
  assert.equal(JSON.parse(ok(asGuest(`SELECT public.feud_host_state('${hostKey}');`))).pending_option,'A');
  denied(asGuest(`SELECT public.feud_choose('${livKey}',1,'B');`),/Wait for the host/);
  action('reopen_choice',1); choose(1);
  action('reveal',1); action('reveal',1);
  current=state();
  assert.equal(current.chosen_option,'A');
  assert.equal(current.revealed_count,1);
  assert.deepEqual(current.teams.map(t=>t.points),[2,2,0,1]);
  assert.deepEqual(current.teams[0].matching_names,['Georgia P','Sue']);
  // Exercise the adjusted calculation independently; host UI cannot change rules mid-round.
  ok("UPDATE public.feud_game SET scoring='adjusted';");
  assert.deepEqual(state().teams.map(t=>t.points),[2,2.67,0,1]);
  ok("UPDATE public.feud_game SET scoring='matches';");
  denied(asGuest(`SELECT public.feud_correct_choice('${livKey}',1,'B');`),/Invalid host access code/);
  ok(asGuest(`SELECT public.feud_correct_choice('${hostKey}',1,'B');`));
  assert.deepEqual(state().teams.map(t=>t.points),[1,1,3,1]);
  action('leaderboard',1); action('next',1);
  denied(asGuest(`SELECT public.feud_host_action('${hostKey}','next',1);`),/moved on/);
  denied(asGuest(`SELECT public.feud_choose('${livKey}',1,'A');`),/question has changed/);
  denied(asGuest(`SELECT public.feud_host_action('${hostKey}','reveal',2);`),/not available/);
  for(let id=2;id<=20;id++){choose(id);action('reveal',id);action('next',id);}
  assert.equal(state().phase,'finished');
  assert.equal(state().revealed_count,20);
  assert.deepEqual(state().teams.map(t=>t.points),[1,1,3,1]);
  console.log('PASS: existing-vote import and legacy page sync; all 20 questions; ballot autosave/upsert; vote locking; private choices; role checks; raw and adjusted scores; idempotent reveal; corrections; stale controls; full round completion.');
  if(process.argv.includes('--keep')) {
    // Fresh, clearly synthetic data for browser rehearsal, only in this test database.
    ok(`TRUNCATE public.feud_votes,public.feud_choices;
      UPDATE public.feud_game SET phase='lobby',voting_open=true,current_question_id=NULL,scoring='matches';
      INSERT INTO public.feud_votes(guest_id,question_id,option_key)
        SELECT m.guest_id,q.id,CASE WHEN m.seat_number%2=0 THEN 'B' ELSE 'A' END
        FROM public.quiz_team_members m CROSS JOIN public.feud_questions q
        WHERE m.display_name NOT IN ('Liv','Bri');`);
    fs.writeFileSync('/private/tmp/feud-browser-db.json',JSON.stringify({socket,port,database}));
    console.log(`Browser rehearsal database: ${database}`);
  }
} finally {
  if(!process.argv.includes('--keep')) ok(`DROP DATABASE ${database};`,'postgres');
}
