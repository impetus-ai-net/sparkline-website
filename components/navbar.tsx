import React from "react";
import Image from "next/image";

export default function Navbar() {
  const links = [
    { href: "#how-it-works", label: "Program" },
    { href: "#curriculum", label: "Curriculum" },
    { href: "#compare", label: "Compare" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-black/90">
      <nav className="mx-auto max-w-6xl flex items-center justify-between px-6 py-3.5">
        <a href="/" className="press flex items-center gap-2.5">
          <Image src="/logo.svg" alt="SparkLine" width={26} height={26} priority />
          <span className="text-white font-semibold tracking-tight text-[17px]">
            Spark<span className="text-spark">Line</span>
          </span>
        </a>
        <ul className="hidden md:flex items-center gap-8 text-[13px] font-medium text-white/70">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="press rounded px-1 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4">
          <a
            href="/login"
            className="press hidden sm:inline-block text-[13px] font-medium text-white/65 hover:text-white"
          >
            Log in
          </a>
          <a
            href="/apply"
            className="press inline-flex items-center gap-1.5 rounded-md bg-spark px-3.5 py-1.5 text-[13px] font-semibold text-black hover:bg-spark-200"
          >
            Apply
            <span aria-hidden>→</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
