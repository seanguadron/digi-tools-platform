"use client";

import { useEffect, useRef, useState } from "react";
import type { PromptDraft } from "@/lib/prompt-builder-state";

export type DictationField =
  | "context"
  | "action"
  | "formatNotes"
  | "targetAudience";

export type DictationPhase = "recording" | "review";
type DictationOutcome = "review" | "submit";

type SpeechResultEvent = Event & {
  results: ArrayLike<{
    0: {
      transcript: string;
    };
    isFinal: boolean;
  }>;
};

type SpeechErrorEvent = Event & {
  error: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type AudioContextConstructor = typeof AudioContext;

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const speechWindow = window as Window &
    typeof globalThis & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

  return (
    speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
  );
}

function getAudioContextConstructor() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const audioWindow = window as Window &
    typeof globalThis & {
      webkitAudioContext?: AudioContextConstructor;
    };

  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
}

function appendTranscript(currentValue: string, transcript: string) {
  const cleanTranscript = transcript.trim();

  if (!currentValue.trim()) {
    return cleanTranscript;
  }

  const separator = currentValue.endsWith("\n") ? "" : " ";
  return `${currentValue}${separator}${cleanTranscript}`;
}

export function usePromptDictation({
  draft,
  onApply,
}: {
  draft: PromptDraft;
  onApply: (field: DictationField, value: string) => void;
}) {
  const [listeningField, setListeningField] =
    useState<DictationField | null>(null);
  const [phase, setPhase] = useState<DictationPhase | null>(null);
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const activeFieldRef = useRef<DictationField | null>(null);
  const activeLabelRef = useRef("");
  const baseValueRef = useRef("");
  const transcriptRef = useRef("");
  const pendingOutcomeRef = useRef<DictationOutcome>("review");

  function stopAudioMonitoring() {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close();
    }

    waveformRef.current
      ?.querySelectorAll<HTMLElement>("[data-level-bar]")
      .forEach((bar) => {
        bar.style.transform = "scaleY(0.16)";
      });
  }

  function startAudioMonitoring(stream: MediaStream) {
    const AudioContextClass = getAudioContextConstructor();
    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    const values = new Uint8Array(analyser.frequencyBinCount);

    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
    audioContextRef.current = audioContext;

    function drawMeter() {
      analyser.getByteFrequencyData(values);
      const bars =
        waveformRef.current?.querySelectorAll<HTMLElement>("[data-level-bar]");

      bars?.forEach((bar, index) => {
        const bucket = Math.floor((index / bars.length) * values.length);
        const level = Math.max(0.16, values[bucket] / 255);
        bar.style.transform = `scaleY(${level})`;
      });

      animationFrameRef.current = window.requestAnimationFrame(drawMeter);
    }

    drawMeter();
  }

  function clearState() {
    activeFieldRef.current = null;
    activeLabelRef.current = "";
    baseValueRef.current = "";
    transcriptRef.current = "";
    pendingOutcomeRef.current = "review";
    setListeningField(null);
    setPhase(null);
    setTranscript("");
  }

  function complete(outcome: DictationOutcome) {
    const field = activeFieldRef.current;
    const label = activeLabelRef.current;
    const finalTranscript = transcriptRef.current.trim();

    stopAudioMonitoring();

    if (outcome === "submit" && field && finalTranscript) {
      onApply(field, appendTranscript(baseValueRef.current, finalTranscript));
      setMessage(`${label} updated from speech.`);
      clearState();
      return;
    }

    setPhase("review");
    setMessage(
      finalTranscript
        ? "Recording stopped. Review the text, then use it or cancel."
        : "Recording stopped without capturing text.",
    );
  }

  function cancel(silent = false) {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
    stopAudioMonitoring();
    clearState();

    if (!silent) {
      setMessage("Dictation cancelled. Nothing was added.");
    }
  }

  function stop() {
    const recognition = recognitionRef.current;
    if (!recognition) {
      complete("review");
      return;
    }

    pendingOutcomeRef.current = "review";
    setMessage("Stopping the microphone...");

    try {
      recognition.stop();
    } catch {
      recognitionRef.current = null;
      complete("review");
    }
  }

  function submit() {
    if (!transcriptRef.current.trim()) {
      return;
    }

    const recognition = recognitionRef.current;
    if (!recognition) {
      complete("submit");
      return;
    }

    pendingOutcomeRef.current = "submit";
    setMessage("Finishing the dictation...");

    try {
      recognition.stop();
    } catch {
      recognitionRef.current = null;
      complete("submit");
    }
  }

  async function start(field: DictationField, label: string) {
    if (listeningField === field && phase === "recording") {
      stop();
      return;
    }

    cancel(true);

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setMessage(
        "Speech input is not available in this browser. Chrome or Edge generally provide the best support.",
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Live microphone activity is not available in this browser.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMessage(
        "Microphone permission was blocked. Allow microphone access for localhost, then try again.",
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang || navigator.language;

    recognition.onresult = (event) => {
      const nextTranscript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      transcriptRef.current = nextTranscript;
      setTranscript(nextTranscript);
    };

    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        "not-allowed":
          "Microphone permission was blocked. Allow microphone access for localhost, then try again.",
        "audio-capture":
          "No microphone was available. Check your input device and browser permissions.",
        "no-speech":
          "No speech was detected. Try again and speak after listening begins.",
        network:
          "Speech recognition could not reach its recognition service. Check your connection and try again.",
      };

      setMessage(
        messages[event.error] ??
          "Speech input stopped before text was captured.",
      );
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        complete(pendingOutcomeRef.current);
      }
    };

    activeFieldRef.current = field;
    activeLabelRef.current = label;
    baseValueRef.current = draft[field];
    transcriptRef.current = "";
    pendingOutcomeRef.current = "review";
    recognitionRef.current = recognition;
    audioStreamRef.current = stream;
    setListeningField(field);
    setPhase("recording");
    setTranscript("");
    setMessage(`Listening for ${label.toLowerCase()}...`);

    try {
      startAudioMonitoring(stream);
      recognition.start();
    } catch {
      recognitionRef.current = null;
      stopAudioMonitoring();
      clearState();
      setMessage("Speech input could not start. Wait a moment and try again.");
    }
  }

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      recognition?.abort();
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      const audioContext = audioContextRef.current;
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close();
      }
    };
  }, []);

  return {
    listeningField,
    phase,
    transcript,
    message,
    setMessage,
    waveformRef,
    start,
    cancel,
    stop,
    submit,
  };
}
