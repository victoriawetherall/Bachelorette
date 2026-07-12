# Liv's Bachelorette Weekend — Project Context

## What this is

A simple, vibe-coded website for Liv (Olivia)'s bachelorette weekend. Built by
Harry and Victoria as a genuine collaboration — Victoria is brand new to
coding and is learning to build with Claude Code as she goes. Harry navigates
(catches architecture issues, reviews diffs); Victoria drives (writes the
prompts, reads what Claude Code proposes, decides what to accept).

This file is project context for Claude Code. It should NOT wander outside
the V1 scope defined below without being explicitly asked to.

**Tone/vibe of the site itself:** warm, personal, fun — this is for Liv, not
generic event software. Keep copy playful where it fits (the packing list,
the RSVP confirmation), but never at the cost of guests being able to quickly
find the info they need.

## Design direction

- **Visual style:** Playful & colorful — bright accent colors, personality in
  the copy and micro-interactions. Not corporate, not overly minimal.
- **Device priority:** Mobile-first. Most guests will open this on their
  phone, likely from a text/WhatsApp link. Design and test for phone screens
  first; treat desktop/laptop as a secondary check, not the primary target.
- **Navigation:** Separate pages/tabs for each section (Info / RSVP /
  Photos), not one long scrolling page. A simple tab bar or bottom nav suits
  the mobile-first approach better than a desktop-style top menu.
- **Landing page & personalization:** The very first thing a guest sees is a
  landing page where they pick their name from the dropdown — this is the
  one-time identification step, not something repeated on every tab. Once
  picked, that identity should persist across the rest of the site for that
  session (so a guest doesn't have to re-select their name switching from
  RSVP to Photos, etc.) and is what personalizes downstream pages — pre-
  filling their own RSVP if they've already submitted one, and later
  showing their own per-day pricing/payment status in V2. This is still the
  entirety of the site's access control (no passwords) — it's just
  consolidated to one entry step instead of repeated per page.

## The people

- **Liv (Olivia)** — the bride. Not involved in building this; it's a
  surprise-ish labor of love from her siblings.
- **Harry** — co-builder, more experienced with Claude Code, navigating.
- **Victoria** — co-builder, brand new to coding, driving. This project is
  explicitly a learning vehicle for her, not just a means to an end.
- **Bella** — bridesmaid, will help organize but isn't coding. Needs V2 admin
  tools eventually.
- **Guests** — 12–15 people, no accounts. Each guest identifies themselves
  once, on the landing page, by picking their name from a pre-loaded
  dropdown list (populated by Harry/Victoria/Bella ahead of time) rather
  than typing free text. This avoids duplicate/misspelled-name mess and is
  the entirety of the site's "access control" — if you're not on the list,
  there's no name to pick.

## Event details

- **Dates:** October 9–11 (Fri–Sun)
- **Location:** An Airbnb within a few hours' drive of Melbourne — specific
  venue still TBD. Build the info page so location is easy to update once
  confirmed; don't hardcode assumptions about the venue itself.
- **Friday night:** games night — planned for V2+, will need a "present fun
  stuff on a big screen" feature. Out of scope for now.

## Tech stack (and why)

- **Cursor** + **Claude Code** — primary build environment.
- **GitHub** — version control and collaboration between Harry and Victoria.
- **Vercel (Hobby tier)** — deployment.
- **Insforge** — backend (database, storage, and eventually auth-adjacent
  logic), operated via MCP directly from Claude Code. Chosen over Supabase
  specifically because it removes dashboard/RLS-policy complexity that would
  be a lot for a first-time coder — Claude Code can operate the backend
  through prompts rather than Victoria needing to learn a separate admin UI.
  - **Before building anything real:** do a throwaway spike — one dummy
    table, one page, deployed end-to-end — to confirm the Claude Code ↔
    Insforge workflow feels smooth. If it's clunky, pivot to Supabase now,
    not in week six.
  - Known constraint: free tier is 1GB file storage / 500MB database / 5GB
    bandwidth. Compress/resize photos on upload to stay comfortably inside
    this for a 12–15 guest photo dump.
- **Payments:** No Stripe — decided it's overkill for an event this size.
  Guests transfer money directly to Victoria; Victoria marks them as paid
  via the admin view (V2). No payment processor integration needed.

## Data model (build this shape in V1, even though some fields are only used in V2)

**Guest**
- id
- name (pre-loaded, not guest-entered)

> **How the guest list gets loaded in V1 (no admin tool yet):** Victoria or
> Harry adds guest names directly by prompting Claude Code / inserting rows
> via Insforge — no UI for this in V1. This is a manual, developer-side step,
> not a feature guests or organizers interact with through the site. Revisit
> once the V2 admin tool exists.

**Session** (config, not guest-facing — this is what makes attendance
options easy to edit)
- id
- label (e.g. "Friday night", "Saturday day", "Saturday night — staying
  over", "Sunday morning" )
- active (boolean — lets you add a session like "Sunday morning" later, or
  turn one off, without touching the RSVP form's code)

> **Sunday morning specifically:** include it as a Session row now, with
> `active = false`. Nothing to build for it yet — when the plan firms up,
> flipping it to `true` is enough to make it appear on the RSVP form and
> admin view. No code change needed at that point.
>
> This exists specifically because attendance options are still evolving —
> Saturday needs a day-only vs. staying-overnight distinction, and Sunday
> morning is a "maybe" not yet decided. Modeling attendance as a fixed set of
> boolean columns (`attending_friday`, `attending_saturday`...) means every
> new option requires a schema change *and* a form change *and* an admin-view
> change. Modeling it as a list of Sessions means adding a new attendance
> option is "add one row" — the RSVP form and admin view both just render
> whatever Sessions are marked `active`, so nothing else needs to change.

**RSVP**
- id
- guest_id (fk → Guest)
- dietary_vegetarian (boolean)
- dietary_vegan (boolean)
- dietary_gluten_free (boolean)
- dietary_allergy (boolean)
- dietary_notes (text, optional — free text for anything the checkboxes
  don't cover, e.g. specifics of an allergy)
- drinks_alcohol (boolean — simple alcohol / non-alcohol preference)
- payment_status (enum: `unpaid` | `paid` — V2, set by Victoria via admin
  view once a guest has transferred money; not guest-editable)
- submitted_at

**RSVP_Session** (join table — which Sessions a given RSVP is attending)
- rsvp_id (fk → RSVP)
- session_id (fk → Session)

> Why this shape: V2's personalized pricing needs to know which specific
> sessions each guest attends (day-only vs. overnight changes accommodation
> cost, for instance). Capturing granular attendance in V1 means no one has
> to re-fill a form later — same data, captured once, and easy to extend as
> the Friday/Saturday/Sunday plan firms up.

> **After submitting:** show a fun, personalized touch rather than a plain
> "Thanks!" — e.g. a joke or gif themed to Liv. Keep it lightweight (a static
> set of a few variants is fine for V1; no need to build anything dynamic).

> **Payment status is guest-visible:** even though marking-as-paid is a V2,
> organizer-only action, guests should be able to see their own
> paid/unpaid status once they've identified themselves via the landing
> page — no separate login needed, since identity is already established.

**Photo**
- id
- guest_id (fk → Guest, who uploaded it)
- category (enum: `pre_weekend` | `weekend`)
- storage_path (Insforge storage reference)
- uploaded_at

> Two distinct upload buckets, same table, split by `category`:
> - **`pre_weekend`** — guests upload photos ahead of time (e.g. old photos
>   of Liv, throwbacks) for Harry/Victoria/Bella to use *during* the weekend
>   — think games night, a slideshow, decorations. **Organizer-only
>   visibility** — guests can upload but cannot browse this bucket; no
>   guest-facing gallery for it. Not part of the end-of-weekend "everyone
>   gets a copy" download.
>   - Exact future use is still undecided (TV slideshow? printed physical
>     copies?) — V2+ question, not needed for V1. For now just get the
>     content in and organizer-viewable; don't build a slideshow/export
>     feature until this is settled.
> - **`weekend`** — photos taken during the event itself. These are the ones
>   that get bundled into the "download all as ZIP" feature so every guest
>   leaves with a copy.

## V1 scope (build this now)

1. **Landing page** — first thing every guest sees. They pick their name
   from the dropdown here (once, not per-page); that identity persists for
   the rest of their visit and personalizes the RSVP page (pre-fill if
   already submitted) and, later, payment status.
2. **Weekend info page** — dates, location (placeholder until venue
   confirmed), schedule, what to bring. Static content, no backend needed for
   this piece.
3. **RSVP** — guest ticks which active Sessions they're attending (Friday
   night, Saturday day, Saturday night/staying over, and Sunday morning if
   it's switched on), ticks dietary/allergy checkboxes (with a free-text
   field for specifics), and sets an alcohol / non-alcohol preference.
   Stored in Insforge. On submit, show a fun, personalized touch (joke/gif
   themed to Liv) rather than a plain thank-you.
4. **Photo upload + gallery** — two clearly separated upload areas:
   - **Pre-weekend uploads**: guests submit photos ahead of time (throwbacks,
     old photos of Liv) for the organizers to use during the weekend. Upload
     form is guest-facing; the gallery/viewing side is **organizer-only**
     (Harry/Victoria/Bella) — no guest-facing browse or download for this
     bucket. Eventual use (TV slideshow, physical prints) is undecided —
     don't build that part yet, just get the content collected.
   - **Weekend uploads**: photos from the event itself, uploaded by any
     guest from any device. Include a **"download all as ZIP"** feature
     (small serverless function zipping this bucket only) so every guest
     leaves with a copy — easy to forget until it's suddenly needed the week
     after the wedding.
5. **Admin: RSVP view** — a read-only, organizer-only page (Harry/Victoria/
   Bella) listing all RSVPs — who's coming to which Sessions, dietary needs,
   alcohol preference. Pulled forward from V2 because this is the core
   information needed to actually start planning the event (catering,
   sleeping arrangements, etc.). This is *view only* in V1 — marking
   payments as paid and editing the guest list through a UI stay in V2.

## V2+ scope (explicitly NOT part of this build yet)

Do not build, scaffold, or add dependencies for any of the following unless
explicitly asked:

- Admin tools beyond the V1 RSVP view — managing/editing the guest list
  through a UI, editing RSVPs on guests' behalf
- Marking guests as paid (admin action) — no Stripe or any payment
  processor; guests transfer money to Victoria directly and she flips
  `payment_status` to `paid` via the admin view
- Personalized per-day pricing calculator, CSV export
- Group send announcements (SMS/email)
- Games night big-screen presentation feature

## Build phases (roughly one per working session, no rush — 3 months of runway)

1. **Setup & spike** — Cursor + GitHub repo + Vercel "hello world" deploy +
   Insforge connected via MCP + one dummy table round-tripped end to end.
   Goal: Victoria understands what deploys where before real features exist.
2. **Landing page + static info page** — name-selection dropdown that
   persists identity for the session, plus hardcoded weekend details (no
   RSVP/photo backend yet). Good place for Victoria to get comfortable with
   edit → commit → see it go live.
3. **RSVP** — Session config table, per-session attendance checkboxes,
   dietary + alcohol preference, stored in Insforge.
4. **Photo upload + download-all** — upload from any device, gallery view,
   zip-download function.
5. **Admin RSVP view** — read-only page for Harry/Victoria/Bella to see all
   RSVPs at a glance (attendance by session, dietary needs, alcohol
   preference).
6. **Polish + real-guest test** — send the link to 2–3 actual invitees before
   the full group; fix what breaks.

## Working conventions

- Victoria writes prompts and reviews what Claude Code proposes; she decides
  what to accept. Harry reviews for architecture issues before they compound,
  but doesn't just build it himself and narrate.
- Small, frequent commits over big ones — easier for Victoria to follow what
  changed and why.
- Keep PRs scoped to one phase/feature at a time.
- When in doubt about whether something is V1 or V2, check this file before
  building it.
