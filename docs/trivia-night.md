# Liv’s trivia night

The trivia backend is installed in the supplied party project's InsForge PostgreSQL database. The supplied 20-question list with four choices per question is installed and voting is open; no test responses or scores were retained. The browser connection, server database connection and private trivia host password are configured in the Git-ignored `.env.local`. The release branch is ready for Victoria to merge into the original party site. A separate copy is being deployed in Harry’s Vercel account against the same party database.

## How the night works

1. Guests select their existing name, open **Trivia → Secret survey**, and choose one answer per question independently. Send this before the weekend; keep Liv’s guesses for the night. Drafts stay on the device until the guest submits all 20 answers. Each guest can update their one response until voting closes.
2. The organiser opens `/admin/trivia` with the server’s trivia host password. Keep this window private: it contains the survey results.
3. Open `/present/trivia` in a separate window and share that window over Zoom. The host booth also has a downloadable 1920 × 1080 PNG Zoom background.
4. Close the survey before play. One captain from each of the four teams opens **Trivia → Play**, selects their team, and predicts the most popular answer. Liv makes her guess aloud.
5. Once the teams have submitted, reveal the top answer. Each correct team gets **10 points automatically**; tied top answers both qualify. Predictions lock on reveal. Show the remaining answers, then move to the next question. The Family Feud round has a maximum of 200 points.
6. Add later rounds by name and maximum score in the host booth. Select the active round. Captains enter their total for that round; saving again replaces it, so scores never double-count. The leaderboard sums all rounds and refreshes within about two seconds while the page is visible.

Voting cannot reopen once teams start predicting. Revisiting a revealed question preserves its earned points. The app follows the existing name-selection trust model; agree on one captain per team to avoid competing edits.

## Backend connection and setup

This app uses **InsForge**, not a Supabase project. `src/lib/insforge.ts` remains the browser SDK connection for the original RSVP and photo features. `.mcp.json` configures InsForge MCP for coding tools. Trivia now connects directly to the same PostgreSQL database from its Next.js API routes, through `src/lib/trivia/database.ts`.

The supplied project ID is `14499cdb-b2b4-4968-880b-c3554969452d`. Linking it with the current InsForge CLI account returned `PERMISSION_DENIED`, so the supplied PostgreSQL credentials were used instead. A server/admin API key is no longer required by the trivia code.

On October 7:

- The existing database was verified to have 16 guests and its six original application tables.
- The migration and vote → prediction → reveal → round-score flow were rehearsed in a transaction that rolled back completely. Original application table counts were unchanged.
- `migrations/20261006220000_add-trivia.sql` was applied atomically using `npm run setup:trivia -- --apply`, with all trivia objects owned by `project_admin`.
- `migrations/20261007233000_update-party-questions.sql` added the supplied 20-question bank and updated the limits to four choices and 200 Family Feud points. Runtime screens and API validation now read the saved bank. The deployment config keeps the API functions in Singapore, near the backend region.
- The updated game starts with the guest survey open, one Family Feud round, four default team names, and no guest votes, predictions or manual scores. Old browser drafts use a different version and are ignored.

The migrations were applied directly through PostgreSQL rather than through the InsForge CLI migration registry. Do not apply them again through the CLI. `npm run setup:trivia` checks for the current question-bank version and avoids reinstalling it. It can create the original schema and upgrade it to the party list, or upgrade an existing unplayed game; changes roll back unless `--apply` is supplied. The upgrade refuses to proceed if guest votes or Family Feud scoring already exist, so existing responses cannot be silently reassigned to new answers.

The local environment file also contains the supplied existing organiser-login, upload-account and bank settings. `NEXT_PUBLIC_ADMIN_PASSWORD` continues to unlock the original organiser views. Trivia has its own private `TRIVIA_HOST_PASSWORD`, generated and stored locally; copy that value from `.env.local` to unlock `/admin/trivia`, or replace it with your preferred private host password.

For Victoria’s original site deployment:

1. Merge the trivia feature branch into the original site’s production branch.
2. Keep its current browser, upload, bank and organiser environment settings.
3. Add **server-only** `TRIVIA_DATABASE_URL` and `TRIVIA_HOST_PASSWORD` from `.env.local` to the deployment environment. Never prefix them with `NEXT_PUBLIC_`, and never commit `.env.local`.
4. Build and deploy the new website code. The live database migration is already installed.
5. Open `/trivia`, `/admin/trivia` and `/present/trivia` on the deployed domain. Confirm a guest can reach the survey and the host can unlock the booth before sharing the guest link.

The new tables deny access to anonymous and authenticated browser clients. Runtime SQL uses the `project_admin` database role and parameterised queries. Host actions and full results additionally require a signed HTTP-only cookie that expires after 12 hours. Public responses contain only revealed answer counts and team totals.

## Verification

- `npm run build` checks the production bundle and TypeScript. Next.js was patched from 15.5.20 to 15.5.27 after the dependency audit identified a [published security issue](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4).
- `npm run test:trivia` runs the ballot, tie-scoring, PostgreSQL migration, duplicate submission, reveal-lock, manual score, and database permission checks using an isolated PGlite database.
- A live connection check confirmed the real database → API → mobile survey and host booth flow. Host login/logout worked, invalid and locked writes were rejected, and all trivia response/score tables stayed empty with 16 guests intact.
- The browser flow was exercised against an isolated PostgreSQL wire-protocol fixture through the real Next.js API routes and `pg` client, including survey saves, tied automatic scores, late prediction locks, score corrections, reload persistence and host logout. Live database rehearsal and public-key permissions were checked separately; the deployed website has not yet been verified.

## Previews (isolated sample votes)

[Presentation screen](images/trivia-presentation-preview.png) · [Mobile team screen](images/trivia-mobile-preview.png)

## The 20 party survey questions

The following questions and four choices are stored in the database and shown in this order. Guest votes determine the most popular answer.

1. **If Liv is running late, what's the most likely reason?**
   A. Forgot to get dressed · B. Hungover · C. Thought the breakfast was at 7:30PM · D. Liv is never running late

2. **Which award would Liv win in this friendship group?**
   A. Best Dressed · B. Best Listener · C. Best Planner · D. Best Wingwoman

3. **Which animal is Liv most like?**
   A. Quokka - Always Happy · B. Eagle - High Achiever · C. Honeybadger - Brave · D. Dolphin - Smart

4. **What is Liv's role on a group holiday?**
   A. The Accountant · B. The Planner · C. The Leader · D. The Party Girl

5. **You have a bad day, and Liv comes round to support you. What does she bring?**
   A. Wine · B. Chocolate · C. Tissues · D. Recorded episodes of the Biggest Loser

6. **What would Liv's completely useless superpower be?**
   A. can detect if someone wants to redesign their home, 70% of the time · B. Able to talk to anteaters · C. Can fall asleep at will on trams · D. Can change eye colour one shade

7. **What would Liv spend a surprise $500 on first?**
   A. A night out with Ben · B. MCC Dues · C. A new art piece · D. Sportsbet Multi

8. **Which of the four main characters in Sex and the City is Liv most like?**
   A. Charlotte · B. Miranda · C. Carrie · D. Samantha

9. **If Liv decided to become an online influencer, what niche would she choose?**
   A. TradWife + Sourdough · B. Skincare · C. Crypto grift · D. Conspiracy Theories

10. **Which topic is Liv the worst at giving advice on?**
    A. Should I propose to my boyfriend? · B. Which fund should I put my super into? · C. Should I quit my job and move to London? · D. Should I take this pinger?

11. **Liv gets two tickets to the Brownlow. Ben can't make it. Who does she take as her plus-one?**
    A. Hughesy · B. Pete Evans · C. Karl Stefanovic · D. ScoMo

12. **What would be the worst job imaginable for Liv?**
    A. Sex Ed Teacher at Xavier College · B. Bali Booze Bus Tour Guide · C. International Student Recruiter at Melbourne Uni · D. Pork Crackling Taste Tester

13. **Liv sees a man defecate on the Number 8 tram going into the city. What does she say?**
    A. Good Heavens! · B. Holy Shit · C. Code Brown · D. Who ordered the BBQ Chicken?

14. **Liv calls you at 2am asking you to bail her out, what crime has she committed?**
    A. Ripped jeans at the MCC · B. Doing 20km in a 5km carpark · C. Stealing steaks down her pants at Coles · D. Using the KFC Free Wifi to call her friends

15. **Nobody can eat until Liv completes a task. Which one do you pick?**
    A. Solve a Rubiks cube · B. Make $1000 busking · C. Have 10 people join her pyramid scheme · D. Get 1000 people to follow her "Fat Pigeons of Melbourne" insta

16. **Which of these four songs would most likely be played at Liv's funeral?**
    A. My Neck, My Back · B. Fuck the Police · C. WAP · D. Who Let the Dogs Out

17. **How many cats do you think Liv and Ben will have in the next 10 years?**
    A. 0 · B. 1 · C. 2-5 · D. 10+

18. **Which Harry Potter Character would most likely ask Liv to the Yule Ball**
    A. Harry · B. Ron · C. Draco · D. Hagrid

19. **What do you like most about Liv?**
    A. How she makes you laugh · B. How she is always loyal · C. How she gives the best advice · D. How she makes you a better person

20. **If Liv told you she had legally changed her name, what would her new name be?**
    A. Schapelle · B. Trixie · C. Watermelonandrea · D. Whoa-Livia
