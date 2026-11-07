"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Owner: Member 1. Speak instead of typing, and listen to answers, for people too stressed to type.
// Uses the browser's own Web Speech API: no extra service or key. Speech-to-text works in Chrome and Edge (they send
// the audio to their own speech service); where it isn't available, the mic button is simply not shown.

/** The few parts of the Web Speech API used here (not in TypeScript's DOM types). */
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionConstructor = new () => Recognition;

function getRecognition(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const VOICE_LANGUAGES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी Hindi" },
  { code: "ml-IN", label: "മലയാളം Malayalam" },
  { code: "ta-IN", label: "தமிழ் Tamil" },
  { code: "ar-SA", label: "العربية Arabic" },
  { code: "uk-UA", label: "Українська Ukrainian" },
  { code: "es-ES", label: "Español Spanish" },
  { code: "fr-FR", label: "Français French" },
];

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in the browser's address bar, or type instead.",
  "no-speech": "We didn't hear anything. Try again, a little closer to the microphone.",
  network: "Voice needs an internet connection. You can type instead.",
};

/**
 * Speech to text. `onText` receives each finished phrase; `interim` shows what is being heard right now.
 */
export function useSpeechToText(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  // Checked after mounting, so the server-rendered page and the first browser render match.
  useEffect(() => setSupported(getRecognition() !== null), []);
  useEffect(() => () => recognition.current?.stop(), []);

  const start = useCallback((lang: string) => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event) => {
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (result.isFinal) onTextRef.current(result[0].transcript.trim());
        else live += result[0].transcript;
      }
      setInterim(live);
    };
    r.onerror = (event) => {
      if (event.error !== "aborted") setError(ERRORS[event.error] ?? "Voice input stopped. You can try again or type instead.");
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    recognition.current = r;
    setError(null);
    setListening(true);
    r.start();
  }, []);

  const stop = useCallback(() => recognition.current?.stop(), []);

  return { supported, listening, interim, error, start, stop };
}

/** Mic button with a language picker. Each finished phrase is passed to `onText`. */
export function VoiceInput({ onText, compact = false }: { onText: (text: string) => void; compact?: boolean }) {
  const [lang, setLang] = useState("en-IN");
  const { supported, listening, interim, error, start, stop } = useSpeechToText(onText);
  if (!supported) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => (listening ? stop() : start(lang))}
          aria-pressed={listening}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
            listening ? "bg-red-500 text-white shadow-md" : "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
          }`}
        >
          {listening ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
              </span>
              Listening… tap to stop
            </>
          ) : (
            <>
              <MicIcon /> {compact ? "Speak" : "Speak instead of typing"}
            </>
          )}
        </button>
        {!listening && (
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label="Language you will speak"
            className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            {VOICE_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {listening && interim && <p className="text-sm italic text-slate-500">“{interim}”</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** Reads text aloud with the browser's built-in voice. Hidden where speech output isn't available. */
export function ListenButton({ text, label = "Listen" }: { text: string; label?: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => setSupported(typeof window !== "undefined" && "speechSynthesis" in window), []);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (speaking) {
          window.speechSynthesis.cancel();
          setSpeaking(false);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        setSpeaking(true);
      }}
      className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-white"
    >
      <SpeakerIcon /> {speaking ? "Stop" : label}
    </button>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}
