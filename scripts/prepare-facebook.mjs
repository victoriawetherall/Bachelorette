// Usage: node scripts/prepare-facebook.mjs /absolute/selected-directory --normalize
// Originals are never modified. The private mapping stays in ignored .quiz/.
import { readFile, writeFile, mkdir, readdir, copyFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { randomBytes, randomInt } from "node:crypto";
import sharp from "sharp";

const source = process.argv[2];
if (!source || !isAbsolute(source)) throw new Error("Pass the absolute selected-image directory.");
const normalize = process.argv.includes("--normalize");
const manifest = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));
const outputs = manifest.outputs;
const rows = [];
const mapping = [];
await mkdir("public/images/quiz", { recursive: true });
await mkdir(".quiz", { recursive: true });
for (let round = 1; round <= 10; round++) {
  const directory = join(source, `round-${String(round).padStart(2, "0")}`);
  const files = (await readdir(directory)).filter((file) => /\.(png|jpe?g)$/i.test(file));
  if (files.length !== 4 || files.filter((file) => file.startsWith("fake_")).length !== 1) throw new Error(`Round ${round} needs three real images and one fake.`);
  for (let i = files.length - 1; i > 0; i--) { const j = randomInt(i + 1); [files[i], files[j]] = [files[j], files[i]]; }
  const options = [];
  let answer;
  for (const [index, file] of files.entries()) {
    const token = randomBytes(12).toString("hex");
    const filename = `${token}${normalize ? ".png" : ".asset"}`;
    const target = join("public/images/quiz", filename);
    const metadata = await sharp(join(directory, file)).metadata();
    if (normalize) {
      // Equal width, encoding and metadata policy. Preserve proportions and text.
      await sharp(join(directory, file)).rotate().resize({ width: 680 }).png({ compressionLevel: 9 }).toFile(target);
    } else await copyFile(join(directory, file), target);
    const key = "ABCD"[index];
    options.push({ key, image: `/images/quiz/${filename}` });
    if (file.startsWith("fake_")) answer = key;
    mapping.push({ round, key, source: file, target, source_size: [metadata.width, metadata.height] });
  }
  const theme = outputs.find((item) => item.round === round)?.theme ?? `Set ${round}`;
  rows.push({ position: round, prompt: `${theme}: which post is the fake?`, options, answer });
}
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sql = "-- Shuffled once at preparation; the answer key is never bundled into client code.\nINSERT INTO public.quiz_live_questions(round_slug,position,prompt,options,answer) VALUES\n" + rows.map((q) => `('fake',${q.position},${quote(q.prompt)},${quote(JSON.stringify(q.options))}::jsonb,${quote(q.answer)})`).join(",\n") + ";\n";
await writeFile("migrations/20261009143100_facebook-content.sql", sql);
await writeFile(".quiz/facebook-assets.json", JSON.stringify({ normalized: normalize, mapping }, null, 2), { mode: 0o600 });
console.log(`Prepared ${mapping.length} neutral assets and 10 questions. Normalized: ${normalize}. Originals untouched.`);
