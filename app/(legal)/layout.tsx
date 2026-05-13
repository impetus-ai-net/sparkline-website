import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Note: this layout doesn't use the @tailwindcss/typography plugin
  // (not installed). The `legal-prose` class in globals.css applies the
  // body/heading rhythm we need without pulling in a 30kb dependency.
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <Navbar />
      <article className="legal-prose relative mx-auto max-w-3xl px-6 pt-32 pb-20">
        {children}
      </article>
      <Footer />
    </main>
  );
}
