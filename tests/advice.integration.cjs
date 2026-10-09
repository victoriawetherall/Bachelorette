// Run against a disposable local PostgreSQL instance. Creates its own database.
// Usage: node tests/advice.integration.cjs <socket-directory> [port]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const socket = process.argv[2];
const port = process.argv[3] || '55468';
if (!socket?.startsWith('/')) throw new Error('Pass the socket directory of a disposable local PostgreSQL instance.');
const database = `quiz_advice_test_${Date.now()}`;
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
const save = (name, body) => ok(asGuest(`SELECT public.quiz_advice_save('${memberId(name)}',$b$${body}$b$);`));
const mine = (name) => ok(asGuest(`SELECT coalesce(public.quiz_advice_mine('${memberId(name)}'),'<none>');`));
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
  for (const file of ['migrations/20261006220000_add-trivia.sql','migrations/20261007233000_update-party-questions.sql','migrations/20261008021000_partial-survey.sql','migrations/20261008170000_quiz-teams.sql','migrations/20261008183000_family-feud.sql','migrations/20261009200000_marriage-advice.sql']) {
    ok(`SET ROLE project_admin; ${fs.readFileSync(file,'utf8')}`,database,true);
  }

  assert.equal(mine('Bri'), '<none>');
  save('Bri', "  Never go to bed angry. Stay up and fight!  ");
  assert.equal(mine('Bri'), 'Never go to bed angry. Stay up and fight!', 'Advice is saved trimmed');
  save('Bri', 'Always say yes, dear.');
  assert.equal(mine('Bri'), 'Always say yes, dear.', 'Saving again replaces the advice');
  save('Bri', '   ');
  assert.equal(mine('Bri'), '<none>', 'Blank advice removes it');

  denied(asGuest(`SELECT public.quiz_advice_save('${memberId('Liv')}','Hi');`), /Nice try, Liv/);
  denied(asGuest(`SELECT public.quiz_advice_save(gen_random_uuid(),'Hi');`), /playing the quiz/);
  denied(asGuest(`SELECT public.quiz_advice_save('${memberId('Deb')}',repeat('x',281));`), /280 characters/);
  save('Deb', 'x'.repeat(280));

  denied(asGuest('SELECT * FROM public.quiz_advice;'), /permission denied/);
  denied('SET ROLE authenticated; SELECT * FROM public.quiz_advice;', /permission denied/);
  console.log('Marriage advice integration checks passed.');
} finally {
  ok(`DROP DATABASE ${database};`,'postgres');
}
