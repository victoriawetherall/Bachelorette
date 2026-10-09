// Run against a disposable local PostgreSQL instance. Creates its own database.
// Usage: node tests/guest-flow.integration.cjs <socket-directory> [port]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const socket = process.argv[2];
const port = process.argv[3] || '55468';
if (!socket?.startsWith('/')) throw new Error('Pass the socket directory of a disposable local PostgreSQL instance.');
const database = `quiz_flow_test_${Date.now()}`;
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
const teamOf = (name) => ok(`SELECT team_id FROM public.quiz_team_members WHERE display_name='${name}';`);
const teammates = (name) => ok(`SELECT display_name FROM public.quiz_team_members WHERE team_id='${teamOf(name)}' AND display_name<>'${name}' ORDER BY display_name;`).split('\n');
const otherTeamMember = (name) => ok(`SELECT display_name FROM public.quiz_team_members WHERE team_id<>'${teamOf(name)}' AND display_name<>'Liv' LIMIT 1;`);
const pick = (by, captain) => ok(asGuest(`SELECT public.quiz_pick_captain('${member(by)}','${member(captain)}');`));
const captainOf = (name) => ok(`SELECT coalesce(m.display_name,'<none>') FROM public.quiz_teams t LEFT JOIN public.quiz_team_captains c ON c.team_id=t.id LEFT JOIN public.quiz_team_members m ON m.guest_id=c.guest_id WHERE t.id='${teamOf(name)}';`);
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
  for (const file of ['20261008170000_quiz-teams.sql','20261008183000_family-feud.sql','20261009120000_ben-round.sql','20261009143000_live-quiz-rounds.sql','20261009143100_facebook-content.sql','20261009190000_family-trivia.sql','20261009210000_guest-flow.sql'])
    ok(`SET ROLE project_admin; ${fs.readFileSync(`migrations/${file}`, 'utf8')}`, database, true);

  const progress = JSON.parse(ok(asGuest('SELECT public.quiz_progress();')));
  assert.deepEqual({feud:progress.feud,family:progress.family,fake:progress.fake,ben:progress.ben},{feud:'lobby',family:'lobby',fake:'lobby',ben:'lobby'});
  assert.equal(progress.liv_guest_id, member('Liv'));
  assert.equal(Object.keys(progress).length, 5, 'Progress exposes phases only');
  assert.deepEqual(ok(`SELECT string_agg(slug||'='||title,',' ORDER BY slug) FROM public.quiz_live_rounds;`).split(','),
    ['fake=Facebook Archaeologist','family=Trivia','stories=Story Time']);

  // Liv's teammates: one picks another as captain.
  const [first, second] = teammates('Liv');
  denied(asGuest(`SELECT public.quiz_pick_captain('${member(first)}','${member('Liv')}');`), /other than Liv/);
  denied(asGuest(`SELECT public.quiz_pick_captain('${member(first)}','${member(otherTeamMember('Liv'))}');`), /your own team/);
  denied(asGuest(`SELECT public.quiz_pick_captain(gen_random_uuid(),'${member(first)}');`), /your own team/);
  pick(first, second);
  assert.equal(captainOf('Liv'), second);
  pick(first, second); // Repeating the same pick is harmless.
  denied(asGuest(`SELECT public.quiz_pick_captain('${member(second)}','${member(first)}');`), /already has a captain/);
  assert.equal(captainOf('Liv'), second);
  // Liv can still pick for her team (just not herself), via another team here.
  const other = otherTeamMember('Liv'); const [otherMate] = teammates(other);
  pick(other, otherMate);
  assert.equal(captainOf(other), otherMate);

  ok(`UPDATE public.feud_game SET phase='question',voting_open=false,current_question_id=1;`);
  assert.equal(JSON.parse(ok(asGuest('SELECT public.quiz_progress();'))).feud, 'question');
  console.log('Guest flow integration checks passed.');
} finally {
  ok(`DROP DATABASE ${database};`,'postgres');
}
