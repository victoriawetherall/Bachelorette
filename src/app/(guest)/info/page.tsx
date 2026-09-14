"use client";

import { useGuest } from "@/lib/useGuest";

export default function InfoPage() {
  const guest = useGuest();

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <header className="space-y-1 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-500">
          The Weekend
        </p>
        <h1 className="text-2xl font-bold text-rose-700">
          {guest ? `Hey ${guest.name}, here's the plan! 🎉` : "Here's the plan! 🎉"}
        </h1>
      </header>

      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-300 bg-rose-100/60 text-rose-400">
        <span className="text-4xl">📸</span>
        <span className="text-sm font-medium">Photo of Liv coming soon!</span>
      </div>

      <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-rose-700">
          🐤 Howdy chooks!
        </h2>
        <p className="text-sm text-gray-700">
          Dust off those dancing shoes and get ready for a weekend of fine
          wine, silly games and the odd penis straw (heh heh) to celebrate
          Liv tying the knot. We would love for you to join us for as much
          of the weekend as you can, but appreciate everyone has busy lives.
          If coming on Saturday, we request that you arrive at the Airbnb by
          10am to get settled before the fun begins!
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-700">
          <div>
            <h3 className="mb-1 font-semibold text-rose-600">📅 When</h3>
            <p>Friday 9th – Sunday 11th October</p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-rose-600">📍 Where</h3>
            <p>20 Sucklings Lane, Korweinguboora</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-rose-700">
          🗓️ What&rsquo;s on the agenda, I hear you ask?
        </h2>

        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <h3 className="font-semibold text-rose-600">Friday</h3>
            <p className="mt-1">
              A quiet night in with dinner and drinks by the fire. Some of
              Liv&rsquo;s favourite meals will make an appearance (cheds, I
              mean you).
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-rose-600">Saturday</h3>
            <ul className="mt-1 space-y-2">
              <li>
                <span className="font-semibold">10am</span> — Light
                refreshments and bubbles to start off the day with a bang.
                Please arrive on time if journeying in the morning.
              </li>
              <li>
                <span className="font-semibold">11am</span> — We&rsquo;ll be
                leaning into Liv&rsquo;s love of art and design by creating
                our very own lino printed clothing. The perfect opportunity
                to give that old tee in the back of your wardrobe a new
                lease on life. Bring spare clothes that you would like to
                print on — simple cotton t-shirts work well, but be as
                creative as you like!
              </li>
              <li>
                <span className="font-semibold">1pm</span> — A long lunch
                served by our very own private chef in the comfort of our
                accommodation. Expect to taste the best produce of the
                region, interspersed with plenty of fun and games.
              </li>
              <li>
                <span className="font-semibold">3pm</span> — Let the games
                begin! We all know Liv is highly competitive, so may the
                best chook win!
              </li>
              <li>
                <span className="font-semibold">Evening</span> — Disco
                rodeo house party ft cowboy boots and homemade pizzas. Start
                practicing that strut!
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-rose-600">Sunday</h3>
            <ul className="mt-1 space-y-2">
              <li>
                <span className="font-semibold">10am</span> — A light
                recovery brekky (and cleanup) followed by a stroll around
                the Daylesford Sunday Market. Perhaps pick up a local
                relish or honey to savour the weekend.
              </li>
              <li>
                <span className="font-semibold">11:30am</span> — Soak away
                that hangover with a trip to the Hepburn Bathhouse &amp;
                Spa.
              </li>
              <li>
                <span className="font-semibold">1:30pm</span> — One final
                meal together at the pub before heading our separate ways.
                (Please note this is not covered in the weekend cost.)
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-rose-700">
          🎒 What to bring
        </h2>
        <p className="mb-2 text-sm text-gray-700">
          Please dress up on Saturday as you would to visit a winery or nice
          lunch. Avoid white where possible.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>Bathers, robe and sandals if attending the mineral springs</li>
          <li>
            Plain clothes for lino printing (you may want an apron too to be
            extra careful)
          </li>
          <li>Warm clothes for the evening as the region gets cold</li>
          <li>
            Cowboy disco dress-up fun! Bring the sparkle, feathers and
            boot-scooting glam of your dreams (please keep this theme
            secret from our gorgeous bride!)
          </li>
          <li>All the other essentials — you know the drill, you&rsquo;re not children!</li>
        </ul>
        <p className="mt-3 text-sm text-gray-700">
          You do not need to bring snacks or drinks, as we will be supplying
          everything!
        </p>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-rose-700">
          🎉 What next?
        </h2>
        <ul className="space-y-3 text-sm text-gray-700">
          <li>
            <span className="font-semibold">RSVP</span> — Head over to the
            RSVP tab to let us know your attendance and any dietary
            requirements.
          </li>
          <li>
            <span className="font-semibold">Travel</span> — Korweinguboora
            is approximately 1.5hrs from Melbourne. If you need a lift, let
            us know and we will try to find you a car pool. Alternately,
            catch the V-Line to Ballan, and we can pick you up. Timetable
            can be found{" "}
            <a
              href="https://www.vline.com.au/getattachment/37906cc5-c2d9-48b7-b4ef-5ed168db50e2/Ballarat-timetable-(2)"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-rose-600 underline"
            >
              here
            </a>
            .
          </li>
          <li>
            <span className="font-semibold">Memories</span> — We want to see
            all your fave pics of you and Liv over the years. Please upload
            them in the photos tab for us to use on the weekend.
          </li>
          <li>
            <span className="font-semibold">Cost</span> — All food, drinks
            and activities are included in the cost (except Sunday lunch).
            We appreciate your prompt payment. If there are any concerns,
            please reach out to Vic.
          </li>
          <li>
            <span className="font-semibold">Photo album</span> — Please add
            all your best pics from the weekend to our photo album, which
            will be downloadable at the end of the weekend.
          </li>
        </ul>
      </section>

      <p className="text-center text-sm italic text-gray-500">
        Ask any questions if you have them!
      </p>
    </main>
  );
}
