import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

// These modules have no runtime imports, so they can run without a Next server.
async function loadTypeScript(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
}
const { FEUD_QUESTIONS, validSurvey, rankAnswers } = await loadTypeScript(
  "../src/lib/trivia/questions.ts",
);
const { scoreFeud, teamTotals } = await loadTypeScript(
  "../src/lib/trivia/types.ts",
);
const ballot = Object.fromEntries(FEUD_QUESTIONS.map((q) => [q.id, 0]));

test("partial ballots accept skipped questions and require valid options", () => {
  assert.equal(FEUD_QUESTIONS.length, 20);
  assert.equal(new Set(FEUD_QUESTIONS.map((q) => q.id)).size, 20);
  assert.equal(validSurvey(ballot), true);
  assert.equal(validSurvey({ ...ballot, animal: -1 }), false);
  assert.equal(validSurvey({ ...ballot, animal: 4 }), false);
  assert.equal(validSurvey({ ...ballot, animal: "1" }), false);
  assert.equal(validSurvey({ ...ballot, extra: 1 }), false);
  const incomplete = { ...ballot };
  delete incomplete.animal;
  assert.equal(validSurvey(incomplete), true);
  assert.equal(validSurvey({ late: 0 }), true);
  assert.equal(validSurvey({}), false);
  assert.equal(validSurvey(null), false);
  assert.equal(validSurvey({ missing: 0 }), false);
});

test("both tied top predictions score, only after reveal, and zero-vote answers never score", () => {
  const votes = [{ ...ballot }, { ...ballot, late: 1 }];
  const results = FEUD_QUESTIONS.map((q) => rankAnswers(q, votes));
  assert.deepEqual(
    results[0].slice(0, 2).map((a) => a.rank),
    [1, 1],
  );
  const predictions = [0, 1, 2, 3].map((answer_index, i) => ({
    team: i + 1,
    question_index: 0,
    answer_index,
  }));
  assert.deepEqual(
    scoreFeud("feud", predictions, FEUD_QUESTIONS, results, []).map(
      (s) => s.points,
    ),
    [0, 0, 0, 0],
  );
  const scored = scoreFeud("feud", predictions, FEUD_QUESTIONS, results, [0]);
  assert.deepEqual(
    scored.map((s) => s.points),
    [10, 10, 0, 0],
  );
  assert.equal(
    teamTotals([...scored, { team: 1, round_id: "music", points: 8 }])[0].total,
    18,
  );
  const empty = FEUD_QUESTIONS.map((q) => rankAnswers(q, []));
  assert.deepEqual(
    scoreFeud("feud", predictions, FEUD_QUESTIONS, empty, [0]).map(
      (s) => s.points,
    ),
    [0, 0, 0, 0],
  );
});

test("PostgreSQL migration preserves the survey and prediction locks, upserts scores, and denies browser access", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE project_admin;
      GRANT CREATE, USAGE ON SCHEMA public TO project_admin;
      SET ROLE project_admin;
      CREATE TABLE public.guests (id uuid PRIMARY KEY, name text);
      INSERT INTO public.guests VALUES ('10000000-0000-4000-8000-000000000001', 'Guest one'), ('10000000-0000-4000-8000-000000000002', 'Guest two');`);
    await db.exec(
      await readFile(
        new URL("../migrations/20261006220000_add-trivia.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec("BEGIN");
    await db.exec(
      await readFile(
        new URL(
          "../migrations/20261007233000_update-party-questions.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../migrations/20261008021000_partial-survey.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec("COMMIT");
    const guest = "10000000-0000-4000-8000-000000000001";
    const feud = "f0000000-0000-4000-8000-000000000001";
    const action = (name, value = null) =>
      db.query("select public.trivia_host_action($1, $2::jsonb)", [
        name,
        JSON.stringify(value),
      ]);

    await t.test(
      "database question bank matches all 20 supplied questions, choice D is valid and E is rejected",
      async () => {
        assert.deepEqual(
          (
            await db.query(
              "SELECT id,prompt,options FROM public.trivia_questions ORDER BY sort_order",
            )
          ).rows,
          FEUD_QUESTIONS,
        );
        assert.equal(
          (
            await db.query(
              "SELECT max_points FROM public.trivia_rounds WHERE kind='family_feud'",
            )
          ).rows[0].max_points,
          200,
        );
        assert.equal(
          (
            await db.query(
              "SELECT public.trivia_valid_survey($1::jsonb) valid",
              [JSON.stringify({ ...ballot, late: 3 })],
            )
          ).rows[0].valid,
          true,
        );
        for (const invalid of [
          { ...ballot, late: 4 },
          { ...ballot, late: 1.5 },
          {},
          { unknown: 1 },
          { late: null },
          { late: "1" },
        ]) {
          assert.equal(
            (
              await db.query(
                "SELECT public.trivia_valid_survey($1::jsonb) valid",
                [JSON.stringify(invalid)],
              )
            ).rows[0].valid,
            false,
          );
          await assert.rejects(
            db.query("SELECT public.trivia_submit_survey($1,$2::jsonb)", [
              guest,
              JSON.stringify(invalid),
            ]),
            /Invalid survey/,
          );
        }
      },
    );

    await t.test(
      "no empty survey reveal or close, and voting updates one row per guest",
      async () => {
        await assert.rejects(action("close_survey"), /Collect at least one/);
        await assert.rejects(action("reveal", 1), /Close the guest survey/);
        // Save five independent answers, leave the rest skipped, then correct one.
        const partial = Object.fromEntries(Object.entries(ballot).slice(0, 5));
        for (const [id, answer] of Object.entries(partial)) {
          await db.query("SELECT public.trivia_submit_survey($1,$2::jsonb)", [
            guest,
            JSON.stringify({ [id]: answer }),
          ]);
        }
        await db.query("SELECT public.trivia_submit_survey($1,$2::jsonb)", [
          guest,
          JSON.stringify({ late: 2 }),
        ]);
        assert.deepEqual(
          (
            await db.query(
              "SELECT answers FROM public.trivia_votes WHERE guest_id=$1",
              [guest],
            )
          ).rows[0].answers,
          { ...partial, late: 2 },
        );
        const partialResults = FEUD_QUESTIONS.map((q) =>
          rankAnswers(q, [{ ...partial, late: 2 }]),
        );
        assert.equal(
          partialResults[0].find(
            (a) => a.option === FEUD_QUESTIONS[0].options[2],
          ).votes,
          1,
        );
        assert.equal(
          partialResults[5].reduce((sum, a) => sum + a.votes, 0),
          0,
        );
        // A repeated save cannot add a second guest response or duplicate votes.
        await db.query("SELECT public.trivia_submit_survey($1,$2::jsonb)", [
          guest,
          JSON.stringify(partial),
        ]);
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::integer n FROM public.trivia_votes",
            )
          ).rows[0].n,
          1,
        );

        await db.query("select public.trivia_submit_survey($1, $2::jsonb)", [
          guest,
          JSON.stringify(ballot),
        ]);
        await db.query("select public.trivia_submit_survey($1, $2::jsonb)", [
          guest,
          JSON.stringify({ ...ballot, animal: 1 }),
        ]);
        assert.equal(
          (
            await db.query(
              "select count(*)::integer n from public.trivia_votes",
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test(
      "closing voting freezes ballots, team predictions replace rather than accumulate",
      async () => {
        await assert.rejects(
          db.query("select public.trivia_save_prediction($1,1,0,0)", [guest]),
          /Predictions locked/,
        );
        await action("close_survey");
        await assert.rejects(
          db.query("select public.trivia_submit_survey($1,$2::jsonb)", [
            guest,
            JSON.stringify(ballot),
          ]),
          /Survey closed/,
        );
        await db.query("select public.trivia_save_prediction($1,1,0,0)", [
          guest,
        ]);
        await db.query("select public.trivia_save_prediction($1,1,0,1)", [
          guest,
        ]);
        assert.equal(
          (
            await db.query(
              "select answer_index from public.trivia_predictions where team=1",
            )
          ).rows[0].answer_index,
          1,
        );
        await assert.rejects(action("open_survey"), /cannot reopen/);
      },
    );
    await t.test(
      "reveal locks late predictions; question navigation cannot remove earned points",
      async () => {
        const before = (
          await db.query("select version from public.trivia_session")
        ).rows[0].version;
        await action("reveal", 1);
        await assert.rejects(
          db.query("select public.trivia_save_prediction($1,2,0,1)", [guest]),
          /Predictions locked/,
        );
        await action("question", 1);
        await action("question", 0);
        const session = (await db.query("select * from public.trivia_session"))
          .rows[0];
        assert.deepEqual(session.scored_questions, [0]);
        assert.equal(session.revealed_count, 4);
        assert.notEqual(session.version, before);
      },
    );
    await t.test(
      "the twentieth question supports four choices and exactly four reveals",
      async () => {
        await action("question", 19);
        await db.query("SELECT public.trivia_save_prediction($1,1,19,3)", [
          guest,
        ]);
        await assert.rejects(
          db.query("SELECT public.trivia_save_prediction($1,2,19,4)", [guest]),
          /Invalid prediction/,
        );
        await assert.rejects(action("question", 20), /Choose a valid question/);
        await assert.rejects(action("reveal", 5), /valid reveal count/);
        await action("reveal", 4);
        assert.equal(
          (await db.query("SELECT revealed_count FROM public.trivia_session"))
            .rows[0].revealed_count,
          4,
        );
      },
    );

    await t.test(
      "manual scores enforce the active round and maximum and replace the prior total",
      async () => {
        await assert.rejects(
          db.query("select public.trivia_save_score($1,1,$2,30)", [
            guest,
            feud,
          ]),
          /Invalid score/,
        );
        await action("add_round", { name: "Music", max_points: 20 });
        const round = (
          await db.query(
            "select id from public.trivia_rounds where kind='manual'",
          )
        ).rows[0].id;
        await assert.rejects(
          db.query("select public.trivia_save_score($1,1,$2,10)", [
            guest,
            round,
          ]),
          /Round changed/,
        );
        await action("round", round);
        await assert.rejects(
          db.query("select public.trivia_save_score($1,1,$2,21)", [
            guest,
            round,
          ]),
          /Invalid score/,
        );
        await db.query("select public.trivia_save_score($1,1,$2,10)", [
          guest,
          round,
        ]);
        await db.query("select public.trivia_save_score($1,1,$2,15)", [
          guest,
          round,
        ]);
        assert.deepEqual(
          (await db.query("select points from public.trivia_scores")).rows,
          [{ points: 15 }],
        );
      },
    );
    await t.test(
      "anon and authenticated cannot read votes or invoke host/scoring functions",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await db.exec(`RESET ROLE; SET ROLE ${role};`);
          await assert.rejects(
            db.query("select * from public.trivia_votes"),
            /permission denied/,
          );
          await assert.rejects(action("reveal", 5), /permission denied/);
          await assert.rejects(
            db.query("select public.trivia_save_prediction($1,1,1,0)", [guest]),
            /permission denied/,
          );
        }
        await db.exec("RESET ROLE; SET ROLE project_admin;");
      },
    );
  } finally {
    await db.close();
  }
});
