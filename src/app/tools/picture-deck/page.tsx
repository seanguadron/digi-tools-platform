import type { Metadata } from "next";
import { PictureDeck } from "@/components/picture-deck";

export const metadata: Metadata = {
  title: "PICTURE Deck",
  description:
    "Build a structured image-generation prompt for Midjourney and other diffusion models.",
};

export default function PictureDeckPage() {
  return <PictureDeck />;
}
