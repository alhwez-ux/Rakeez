"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{
          isFinal: boolean;
          length: number;
          [index: number]: { transcript: string };
        }>;
      }) => void)
    | null;
};

function recognitionCtor() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function speechError(code: string) {
  if (code === "not-allowed" || code === "service-not-allowed") return "يلزم السماح باستخدام الميكروفون.";
  if (code === "no-speech") return "لم يُلتقط كلام. حاول مرة أخرى أو اكتب الطلب.";
  if (code === "audio-capture") return "تعذر الوصول إلى الميكروفون.";
  if (code === "aborted") return "";
  return "تعذر التعرف على الصوت. يمكنك الكتابة في الحقل.";
}

export function useArabicSpeech() {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const engineRef = useRef<Recognition | null>(null);
  const finalHandler = useRef<(text: string, alternatives: string[]) => void>(() => undefined);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback((onFinal: (text: string, alternatives: string[]) => void) => {
    finalHandler.current = onFinal;
    setError("");
    setInterim("");
    engineRef.current?.abort();
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError("النداء الصوتي متاح في Chrome أو Edge، أو اكتب الطلب في الحقل.");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "ar-SA";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 4;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      engineRef.current = null;
    };
    recognition.onerror = (event) => {
      const message = speechError(event.error);
      if (message) setError(message);
      setListening(false);
    };
    recognition.onresult = (event) => {
      let heard = "";
      const finals: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        if (result.isFinal) {
          finals.push(text);
          for (let alt = 1; alt < result.length; alt += 1) {
            const alternative = result[alt]?.transcript?.trim();
            if (alternative) finals.push(alternative);
          }
        } else {
          heard = text;
        }
      }
      if (heard) setInterim(heard);
      if (finals.length > 0) finalHandler.current(finals[0], finals);
    };
    engineRef.current = recognition;
    recognition.start();
  }, []);

  useEffect(() => () => engineRef.current?.abort(), []);

  return { listening, interim, error, setError, start, stop };
}
