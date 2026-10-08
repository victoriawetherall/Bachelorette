import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import nextEnvironment from "@next/env";
import pg from "pg";

nextEnvironment.loadEnvConfig(process.cwd());
const connectionString = process.env.TRIVIA_DATABASE_URL;
if (!connectionString)
  throw new Error("Set TRIVIA_DATABASE_URL in .env.local.");
const apply = process.argv.includes("--apply");
const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 15000,
});
const tables = [
  "trivia_rounds",
  "trivia_session",
  "trivia_votes",
  "trivia_scores",
  "trivia_predictions",
];
const functions = [
  "trivia_submit_survey",
  "trivia_save_prediction",
  "trivia_save_score",
  "trivia_host_action",
];

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('liv-trivia-20261006220000'))",
  );
  const existing = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])",
    [tables],
  );
  if (existing.rows.length === tables.length) {
    const controls = await client.query(
      "SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND proname = ANY($1::text[])",
      [functions],
    );
    assert.equal(
      controls.rows.length,
      functions.length,
      "Trivia has tables but its control functions are incomplete.",
    );
  } else {
    assert.equal(
      existing.rows.length,
      0,
      "Some trivia tables already exist. Inspect them before applying this migration.",
    );
    await client.query("SET LOCAL ROLE project_admin");
    const migration = await readFile(
      new URL("../migrations/20261006220000_add-trivia.sql", import.meta.url),
      "utf8",
    );
    await client.query(migration);
  }
  const questionBank = (
    await client.query(
      "SELECT to_regclass('public.trivia_questions') AS table_name",
    )
  ).rows[0].table_name;
  if (questionBank) {
    const version = (
      await client.query(
        "SELECT question_set_version FROM public.trivia_session WHERE id='liv-weekend'",
      )
    ).rows[0]?.question_set_version;
    assert.equal(
      version,
      "liv-party-20-v2",
      "Inspect the existing question bank before replacing it.",
    );
    await client.query("ROLLBACK");
    console.log(
      "The 20-question party list is already installed; nothing changed.",
    );
  } else {
    await client.query("SET LOCAL ROLE project_admin");
    await client.query(
      await readFile(
        new URL(
          "../migrations/20261007233000_update-party-questions.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const state = (
      await client.query(
        "SELECT survey_open, question_index, revealed_count FROM public.trivia_session WHERE id = 'liv-weekend'",
      )
    ).rows[0];
    assert.deepEqual(state, {
      survey_open: true,
      question_index: 0,
      revealed_count: 0,
    });
    const permissions = (
      await client.query(
        "SELECT has_table_privilege('anon','public.trivia_votes','SELECT') AS anon_read, has_table_privilege('authenticated','public.trivia_votes','SELECT') AS authenticated_read",
      )
    ).rows[0];
    assert.deepEqual(permissions, {
      anon_read: false,
      authenticated_read: false,
    });
    if (apply) {
      await client.query("NOTIFY pgrst, 'reload schema'");
      await client.query("COMMIT");
      console.log(
        "Installed the 20-question party list with four choices each. Voting is open; existing votes were not deleted.",
      );
    } else {
      await client.query("ROLLBACK");
      console.log(
        "Migration rehearsal passed and rolled back. Run with --apply to install it.",
      );
    }
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
