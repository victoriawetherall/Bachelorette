// Local-only SDK adapter using the real SQL functions and synthetic test data.
// First keep a fixture with live-quiz.integration.cjs --keep, then:
// node tests/quiz-rehearsal.cjs <quiz_live_test_...> /absolute/socket [port]
const http = require('node:http');
const { Pool } = require('pg');
const database = process.argv[2];
const socket = process.argv[3];
if (!/^quiz_live_test_\d+$/.test(database || '') || !socket?.startsWith('/')) throw new Error('Use a disposable integration-test database and local socket only.');
const pool = new Pool({ database, host: socket, port: Number(process.argv[4] || 55469) });
(async () => {
  await pool.query(`DELETE FROM public.quiz_live_results; DELETE FROM public.quiz_live_submissions;
    DELETE FROM public.ben_predictions; DELETE FROM public.ben_results; DELETE FROM public.feud_choices; DELETE FROM public.feud_votes; DELETE FROM public.quiz_team_captains;
    UPDATE public.quiz_live_rounds SET phase='lobby',current_question_id=NULL,points_per_correct=1;
    UPDATE public.ben_game SET phase='lobby',current_question_id=NULL;
    UPDATE public.feud_game SET phase='lobby',current_question_id=NULL,voting_open=true;`);
  const server = http.createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'OPTIONS') { response.end(); return; }
    let client;
    try {
      const url = new URL(request.url, 'http://localhost');
      client = await pool.connect();
      await client.query('SET ROLE anon');
      let result;
      if (url.pathname === '/api/database/records/guests') {
        // The production landing page reads the same public guest projection.
        await client.query('RESET ROLE');
        result = (await client.query('SELECT id,name,created_at FROM public.guests ORDER BY name')).rows;
      } else if (url.pathname === '/api/database/records/quiz_teams') {
        result = (await client.query(`SELECT t.id,t.name,t.team_number,
          (SELECT jsonb_agg(jsonb_build_object('guest_id',m.guest_id,'display_name',m.display_name,'seat_number',m.seat_number) ORDER BY m.seat_number) FROM public.quiz_team_members m WHERE m.team_id=t.id) AS quiz_team_members
          FROM public.quiz_teams t ORDER BY t.team_number`)).rows;
      } else if (request.method === 'POST' && /^\/api\/database\/rpc\/(feud_|ben_|quiz_)\w+$/.test(url.pathname)) {
        let body = ''; for await (const chunk of request) { body += chunk; if (body.length > 20000) throw new Error('Request too large'); }
        const args = JSON.parse(body || '{}');
        const keys = Object.keys(args);
        if (keys.some((key) => !/^p_\w+$/.test(key))) throw new Error('Invalid argument');
        const fn = url.pathname.split('/').pop();
        const sql = `SELECT public.${fn}(${keys.map((key,i) => `${key} => $${i+1}`).join(',')}) AS value`;
        result = (await client.query(sql, Object.values(args))).rows[0].value;
      } else { response.statusCode = 404; result = { message: 'Unknown rehearsal endpoint' }; }
      response.end(JSON.stringify(result));
    } catch (error) {
      response.statusCode = 400;
      response.end(JSON.stringify({ message: error.message, code: error.code || 'P0001' }));
    } finally { if (client) { await client.query('RESET ROLE'); client.release(); } }
  });
  server.listen(4412, '127.0.0.1', () => console.log(`Quiz rehearsal adapter ready on 4412 (${database}). Host code: test-host-access-code-only`));
  process.on('SIGINT', () => server.close(async () => { await pool.end(); process.exit(0); }));
})();
