import type { Metadata } from "next";
import { ImageEditor } from "@/components/image-editor";

export const metadata: Metadata = {
  title: "Image Editor",
  description:
    "A local, layer-based image editor — paint, select, adjust, and export, all in the browser. Nothing leaves your device.",
};

export default function ImageEditorPage() {
  return <ImageEditor />;
}
