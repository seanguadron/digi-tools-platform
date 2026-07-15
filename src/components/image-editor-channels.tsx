"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ChannelKey, ChannelView } from "@/lib/image-editor/channels";
import { composite } from "@/lib/image-editor/raster";
import type { ImageDoc } from "@/lib/image-editor/types";

const THUMB_W = 44;
const THUMB_H = 32;

// Draw one channel's thumbnail from the shared composite. Individual channels
// render grayscale; "rgb" renders the colour composite. Transforming the small
// thumbnail (not the full doc) keeps this cheap.
function drawChannelThumb(
  canvas: HTMLCanvasElement,
  flat: HTMLCanvasElement,
  channel: ChannelKey | "rgb",
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, THUMB_W, THUMB_H);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(flat, 0, 0, THUMB_W, THUMB_H);
  if (channel === "rgb") {
    return;
  }
  const offset = channel === "r" ? 0 : channel === "g" ? 1 : channel === "b" ? 2 : 3;
  const img = ctx.getImageData(0, 0, THUMB_W, THUMB_H);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i + offset];
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function ChannelThumb({
  flat,
  channel,
}: {
  flat: HTMLCanvasElement;
  channel: ChannelKey | "rgb";
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      drawChannelThumb(ref.current, flat, channel);
    }
  }, [flat, channel]);
  return (
    <canvas
      ref={ref}
      width={THUMB_W}
      height={THUMB_H}
      className="image-editor-channel-thumb"
      aria-hidden="true"
    />
  );
}

const ROWS: { key: ChannelKey; label: string }[] = [
  { key: "r", label: "Red" },
  { key: "g", label: "Green" },
  { key: "b", label: "Blue" },
  { key: "a", label: "Alpha" },
];

interface ChannelsProps {
  doc: ImageDoc;
  channelView: ChannelView;
  onChannelViewChange: (next: ChannelView) => void;
  onLoadChannel: (channel: ChannelKey) => void;
}

export function ImageEditorChannels({
  doc,
  channelView,
  onChannelViewChange,
  onLoadChannel,
}: ChannelsProps) {
  const flat = useMemo(() => composite(doc), [doc]);
  const rgbAll = channelView.r && channelView.g && channelView.b;

  return (
    <div className="image-editor-channels">
      <ul className="image-editor-channel-list">
        <li className="image-editor-channel-row">
          <button
            type="button"
            className="image-editor-layer-eye"
            aria-pressed={rgbAll}
            aria-label={rgbAll ? "Hide RGB channels" : "Show RGB channels"}
            onClick={() =>
              onChannelViewChange({
                ...channelView,
                r: !rgbAll,
                g: !rgbAll,
                b: !rgbAll,
              })
            }
          >
            {rgbAll ? "◉" : "○"}
          </button>
          <ChannelThumb flat={flat} channel="rgb" />
          <span className="image-editor-channel-name">RGB</span>
          <span />
        </li>
        {ROWS.map((row) => {
          const on = channelView[row.key];
          return (
            <li key={row.key} className="image-editor-channel-row">
              <button
                type="button"
                className="image-editor-layer-eye"
                aria-pressed={on}
                aria-label={`${on ? "Hide" : "Show"} ${row.label} channel`}
                onClick={() =>
                  onChannelViewChange({ ...channelView, [row.key]: !on })
                }
              >
                {on ? "◉" : "○"}
              </button>
              <ChannelThumb flat={flat} channel={row.key} />
              <span className="image-editor-channel-name">{row.label}</span>
              <button
                type="button"
                className="image-editor-icon-btn"
                title={`Load ${row.label} as selection`}
                aria-label={`Load ${row.label} channel as selection`}
                onClick={() => onLoadChannel(row.key)}
              >
                ⬚
              </button>
            </li>
          );
        })}
      </ul>
      <p className="image-editor-hint">
        Toggle an eye to preview a channel; a single channel shows in grayscale.
        Use ⬚ to load a channel as a selection.
      </p>
    </div>
  );
}
