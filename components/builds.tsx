import React from "react";
import {
  Rocket,
  Cpu,
  Microscope,
  Palette,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

type Build = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const BUILDS: Build[] = [
  {
    icon: Rocket,
    title: "Startup",
    body: "Build a real company. Lean Canvas, business model, GTM, pitch deck.",
  },
  {
    icon: Cpu,
    title: "Hardware",
    body: "Ship a working prototype. Project scoping, BOM planning, milestone-driven build, demo.",
  },
  {
    icon: Microscope,
    title: "Research",
    body: "Run a real study. Methodology design, data collection, analysis, presentation.",
  },
  {
    icon: Palette,
    title: "Creative",
    body: "Launch a creative project — game, film, music, app. Concept, build, distribution, audience.",
  },
  {
    icon: HeartHandshake,
    title: "Social Impact",
    body: "Tackle a real problem. Stakeholder discovery, intervention design, pilot, scale plan.",
  },
];

export default function Builds() {
  return (
    <section className="relative py-16 sm:py-20 md:py-28 px-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.22em] text-spark">
            What you can build
          </p>
          <h2 className="mt-3 text-[32px] sm:text-4xl md:text-5xl font-bold tracking-[-0.02em] text-white leading-[1.05]">
            Five ways to build with SparkLine.
          </h2>
          <p className="mt-4 sm:mt-5 text-base sm:text-[17px] text-white/75 leading-relaxed">
            One curriculum. Five project types. All eligible.
          </p>
        </Reveal>

        <ul className="mt-10 sm:mt-12 grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BUILDS.map((b, i) => {
            const Icon = b.icon;
            return (
              <Reveal
                key={b.title}
                as="li"
                delay={i * 60}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-spark/15 text-spark">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg sm:text-xl font-semibold tracking-tight text-white">
                  {b.title}
                </h3>
                <p className="mt-2 text-[14px] sm:text-[15px] text-white/75 leading-relaxed">
                  {b.body}
                </p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
