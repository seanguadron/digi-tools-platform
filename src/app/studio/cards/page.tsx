import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardStudio } from "@/components/card-studio";
import { ART_PACKS } from "../../../../scripts/art-pack.mjs";

// An authoring surface, not a tool: deliberately absent from the tool registry
// so it has no nav tab, no home card, and nothing links to it. It only exists
// while the dev server is running — the production build 404s, matching the
// route handler it talks to (enforced by check:security S4).
export const metadata: Metadata = {
  title: "Card Studio",
  description: "Development-only authoring surface for the card decks.",
  robots: { index: false, follow: false },
};

export default function CardStudioPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <CardStudio packs={ART_PACKS.map((pack) => ({ ...pack }))} />;
}
