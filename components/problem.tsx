import React from "react";
import { Reveal } from "@/components/ui/reveal";

const problems = [
  {
    title: "Priced for the few",
    body:
      "LaunchX, LeanGap, and most quality programs gate access behind $3,000–$8,000+ tuition. The teens who would benefit most can't afford to apply.",
  },
  {
    title: "Locked to a city or season",
    body:
      "Most accelerators run a couple of weeks per year, in one zip code. If your summer is booked, you're out — and a real company isn't built in two weeks anyway.",
  },
  {
    title: "Judges, not investors",
    body:
      "Programs that end with a panel and a plaque don't change much. We end with real angel investors writing real checks.",
  },
];

export default function Problem() {
  return (
    <section className="relative py-20 md:py-32 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-12 md:gap-16">
          <Reveal className="md:col-span-5">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-spark">
              The problem
            </p>
            <h2 className="mt-3 text-4xl md:text-5xl font-bold tracking-[-0.02em] text-white leading-[1.05]">
              Youth entrepreneurship is broken.
            </h2>
            <p className="mt-5 text-lg text-white/75 leading-relaxed">
              Talented teens don't need another business-plan competition.
              They need access — and right now that's reserved for the
              families who can afford the tuition or happen to live in the
              right city.
            </p>
          </Reveal>

          <div className="md:col-span-7">
            <ol className="divide-y divide-white/10 border-t border-white/10">
              {problems.map((p, i) => (
                <Reveal key={p.title} delay={i * 80} as="li" className="py-7">
                  <div className="flex items-baseline gap-5">
                    <span className="text-sm font-medium tabular-nums text-white/30">
                      0{i + 1}
                    </span>
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight text-white">
                        {p.title}
                      </h3>
                      <p className="mt-2 text-[15px] text-white/75 leading-relaxed">
                        {p.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
