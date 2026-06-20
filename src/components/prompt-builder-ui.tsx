"use client";

import Image from "next/image";
import { useState } from "react";
import type { ReactNode, RefObject } from "react";
import type {
  DictationField,
  DictationPhase,
} from "@/hooks/use-prompt-dictation";
import type { CardIllustration, PromptRole } from "@/lib/prompt-types";

const FIELD_GUIDANCE = {
  context: {
    title: "Context help",
    body: "Describe the situation, goal, available material, and limits.",
    points: [
      "Include facts or source material the model can use.",
      "Keep task steps in Action.",
    ],
  },
  role: {
    title: "Role help",
    body: "Choose the perspective best suited to the hardest decision.",
    points: [
      "The first role leads. The next two support it.",
      "Hover or focus a card to inspect its ability panel.",
    ],
  },
  action: {
    title: "Action help",
    body: "Use one clear step per line.",
    points: [
      "Start with a verb: review, compare, draft, test, or recommend.",
      "Put dependent steps in order.",
    ],
  },
  format: {
    title: "Format help",
    body: "Choose the base output, then add only the requirements it misses.",
    points: [
      "Add required sections, fields, length, or language.",
      "State citation requirements when they matter.",
    ],
  },
  targetAudience: {
    title: "Audience help",
    body: "Describe the person who will use the answer.",
    points: [
      "Name their role, knowledge, and goal.",
      "Include language or accessibility needs when relevant.",
    ],
  },
} as const;

export function roleCategoryCode(category: string) {
  return category
    .replace(/ roles$/i, "")
    .split(/\s+/)
    .filter((word) => !["and", "of"].includes(word.toLowerCase()))
    .map((word) => word.slice(0, 1))
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function CardIllustrationFrame({
  illustration,
  fallback,
  className,
  badge,
}: {
  illustration?: CardIllustration;
  fallback: string;
  className: string;
  badge?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage =
    illustration?.status === "generated" && illustration.src && !imageFailed;

  return (
    <span
      className={[
        className,
        "card-illustration-frame",
        showImage ? "has-generated-image" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {showImage ? (
        <Image
          className="card-illustration-image"
          src={illustration.src}
          alt=""
          width={256}
          height={256}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="card-illustration-placeholder">{fallback}</span>
      )}
      {badge ? (
        <span className="role-card-portrait-category">{badge}</span>
      ) : null}
    </span>
  );
}

export function RoleAvatar({
  role,
  index,
}: {
  role: PromptRole;
  index: number;
}) {
  const initials = role.name
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.slice(0, 1))
    .join("")
    .toUpperCase();

  return (
    <CardIllustrationFrame
      className={`role-card-portrait role-avatar-tone-${(index % 4) + 1}`}
      illustration={role.illustration}
      fallback={initials}
      badge={roleCategoryCode(role.category)}
    />
  );
}

export function RoleCardFace({
  role,
  index,
  status,
}: {
  role: PromptRole;
  index: number;
  status?: string;
}) {
  return (
    <>
      <span className="role-card-topline">
        <span>Role</span>
        <span>{roleCategoryCode(role.category)}</span>
      </span>
      <RoleAvatar role={role} index={index} />
      <span className="role-card-name">{role.name}</span>
      {status ? (
        <span className="role-card-footer" aria-hidden="true">
          {status}
        </span>
      ) : null}
    </>
  );
}

export function DictationSession({
  activeField,
  field,
  label,
  phase,
  transcript,
  waveformRef,
  onCancel,
  onStop,
  onSubmit,
}: {
  activeField: DictationField | null;
  field: DictationField;
  label: string;
  phase: DictationPhase | null;
  transcript: string;
  waveformRef: RefObject<HTMLDivElement | null>;
  onCancel: () => void;
  onStop: () => void;
  onSubmit: () => void;
}) {
  if (activeField !== field || !phase) {
    return null;
  }

  const isRecording = phase === "recording";

  return (
    <div
      className={`dictation-session ${
        isRecording ? "is-recording" : "is-reviewing"
      }`}
      aria-label={`${label} dictation`}
    >
      <div className="dictation-session-header">
        <span className="dictation-session-state">
          <span className="recording-indicator" aria-hidden="true" />
          {isRecording ? `Listening to ${label}` : "Recording stopped"}
        </span>
        <span>
          {transcript ? `${transcript.length} characters` : "No text yet"}
        </span>
      </div>

      <div
        className="audio-meter"
        ref={waveformRef}
        aria-label={
          isRecording ? "Live microphone activity" : "Microphone stopped"
        }
        role="img"
      >
        {Array.from({ length: 18 }, (_, index) => (
          <span data-level-bar key={index} />
        ))}
      </div>

      <p
        className={
          transcript
            ? "dictation-transcript"
            : "dictation-transcript is-empty"
        }
      >
        {transcript ||
          "Start speaking. Your words will appear here before they are added."}
      </p>

      <div className="dictation-actions">
        <button
          className="dictation-action dictation-action-quiet"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        {isRecording ? (
          <button
            className="dictation-action dictation-action-stop"
            type="button"
            onClick={onStop}
          >
            <span aria-hidden="true" />
            Stop
          </button>
        ) : null}
        <button
          className="dictation-action dictation-action-submit"
          type="button"
          onClick={onSubmit}
          disabled={!transcript.trim()}
        >
          Use text
        </button>
      </div>
    </div>
  );
}

export type CraftDictationApi = {
  activeField: DictationField | null;
  phase: DictationPhase | null;
  transcript: string;
  waveformRef: RefObject<HTMLDivElement | null>;
  start: (field: DictationField, label: string) => void;
  cancel: () => void;
  stop: () => void;
  submit: () => void;
};

export function CraftDictationField({
  id,
  field,
  label,
  value,
  placeholder,
  rows,
  required,
  attention,
  onChange,
  dictation,
}: {
  id: string;
  field: DictationField;
  label: string;
  value: string;
  placeholder: string;
  rows: number;
  required?: boolean;
  attention?: boolean;
  onChange: (value: string) => void;
  dictation: CraftDictationApi;
}) {
  const isRecording =
    dictation.activeField === field && dictation.phase === "recording";
  const lowerLabel = label.toLowerCase();

  return (
    <>
      <span className="dictation-control">
        <textarea
          id={id}
          className={attention ? "is-attention-target" : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          required={required}
        />
        <button
          className={isRecording ? "mic-button is-listening" : "mic-button"}
          type="button"
          onClick={() => dictation.start(field, label)}
          aria-pressed={isRecording}
          aria-label={
            isRecording ? `Stop dictating ${lowerLabel}` : `Dictate ${lowerLabel}`
          }
        >
          {isRecording ? "Stop" : "Mic"}
        </button>
      </span>
      <DictationSession
        activeField={dictation.activeField}
        field={field}
        label={label}
        phase={dictation.phase}
        transcript={dictation.transcript}
        waveformRef={dictation.waveformRef}
        onCancel={dictation.cancel}
        onStop={dictation.stop}
        onSubmit={dictation.submit}
      />
    </>
  );
}

function InfoDisclosure({
  field,
}: {
  field: keyof typeof FIELD_GUIDANCE;
}) {
  const guidance = FIELD_GUIDANCE[field];

  return (
    <details className="info-disclosure">
      <summary aria-label={`More information about ${guidance.title}`}>
        <span aria-hidden="true">i</span>
      </summary>
      <div className="info-panel">
        <strong>{guidance.title}</strong>
        <p>{guidance.body}</p>
        <ul>
          {guidance.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function FieldHeading({
  field,
  label,
  hint,
  controlId,
  labelControl = true,
}: {
  field: keyof typeof FIELD_GUIDANCE;
  label: string;
  hint?: string;
  controlId: string;
  labelControl?: boolean;
}) {
  return (
    <div className="field-label">
      <div className="field-title-row">
        {labelControl ? (
          <label htmlFor={controlId}>
            <strong>{label}</strong>
          </label>
        ) : (
          <strong id={`${controlId}-label`}>{label}</strong>
        )}
        <InfoDisclosure field={field} />
      </div>
      {hint ? <small id={`${controlId}-hint`}>{hint}</small> : null}
    </div>
  );
}

export function CraftCard({
  letter,
  complete,
  children,
}: {
  letter: string;
  complete: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={complete ? "craft-card is-complete" : "craft-card"}
      aria-label={`${letter} section${complete ? ", complete" : ""}`}
    >
      <div className="craft-card-content">{children}</div>
    </section>
  );
}

export function FlowActions({
  onBack,
  onNext,
  nextLabel = "Next",
  onSecondary,
  secondaryLabel,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
}) {
  return (
    <div className="flow-panel-actions">
      {onBack ? (
        <button
          className="button button-secondary"
          type="button"
          onClick={onBack}
        >
          Back
        </button>
      ) : (
        <span />
      )}
      <div className="flow-panel-actions-end">
        {onSecondary && secondaryLabel ? (
          <button
            className="button button-secondary"
            type="button"
            onClick={onSecondary}
          >
            {secondaryLabel}
          </button>
        ) : null}
        {onNext ? (
          <button
            className="button button-primary"
            type="button"
            onClick={onNext}
          >
            {nextLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
