import type { Metadata } from "next";
import { VectorEditor } from "@/components/vector-editor";

export const metadata: Metadata = {
  title: "Vector Editor",
  description:
    "A local SVG vector editor — draw shapes, style fills and strokes, and export clean SVG, all in the browser. Nothing leaves your device.",
};

export default function VectorEditorPage() {
  return <VectorEditor />;
}
