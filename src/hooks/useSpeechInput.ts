import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { speechService } from "../services/speechService";

type UseSpeechInputOptions = {
  enabled?: boolean;
  languageHint?: string | null;
  onRecordingStart?: () => void;
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onCancelRestore?: () => void;
};

type SpeechRecognitionConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as BrowserWindow;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function pickBestRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }

  return "";
}

function fileExtensionForMimeType(mimeType: string) {
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("mp4")) return ".mp4";
  if (mimeType.includes("ogg")) return ".ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return ".mp3";
  if (mimeType.includes("wav")) return ".wav";
  if (mimeType.includes("m4a")) return ".m4a";
  return ".webm";
}

function normalizeTranscriptionLanguage(language?: string | null) {
  const value = String(language || "").trim().toLowerCase();
  if (!value) return "";
  return value.split(/[-_]/)[0];
}

function getBrowserRecognitionLanguage(languageHint?: string | null) {
  const value = String(languageHint || "").trim();
  if (value) return value;

  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }

  return "en-IN";
}

function humanizeSpeechError(error: unknown) {
  const message = error instanceof Error ? error.message : "Speech input failed.";

  if (/permission|denied|notallowed/i.test(message)) {
    return "Microphone access was denied.";
  }

  if (/device|media/i.test(message)) {
    return "Could not access your microphone.";
  }

  return message;
}

export function useSpeechInput({
  enabled = true,
  languageHint,
  onRecordingStart,
  onInterimTranscript,
  onFinalTranscript,
  onCancelRestore,
}: UseSpeechInputOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<{
    stop: () => void;
    abort: () => void;
  } | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const callbacksRef = useRef({
    onRecordingStart,
    onInterimTranscript,
    onFinalTranscript,
    onCancelRestore,
  });

  useEffect(() => {
    callbacksRef.current = {
      onRecordingStart,
      onInterimTranscript,
      onFinalTranscript,
      onCancelRestore,
    };
  }, [onRecordingStart, onInterimTranscript, onFinalTranscript, onCancelRestore]);

  const isSupported = useMemo(() => {
    if (!enabled) return false;
    if (typeof window === "undefined") return false;

    return (
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined"
    );
  }, [enabled]);

  const cleanupStream = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    mediaStreamRef.current = null;
  }, []);

  const cleanupRecognition = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }

    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }

    recognitionRef.current = null;
  }, []);

  const resetRecorderState = useCallback(() => {
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const cancelInternal = useCallback(
    (shouldRestore = true) => {
      cleanupRecognition();

      try {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }

      cleanupStream();
      resetRecorderState();
      setIsRecording(false);
      setIsTranscribing(false);
      setInterimTranscript("");
      callbacksRef.current.onInterimTranscript?.("");

      if (shouldRestore) {
        callbacksRef.current.onCancelRestore?.();
      }
    },
    [cleanupRecognition, cleanupStream, resetRecorderState]
  );

  const start = useCallback(async () => {
    if (!enabled) return;
    if (!isSupported) {
      setError("Speech input is not supported in this browser.");
      return;
    }
    if (isRecording || isTranscribing) return;

    setError("");
    setInterimTranscript("");
    callbacksRef.current.onRecordingStart?.();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      const mimeType = pickBestRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, {
            mimeType,
            audioBitsPerSecond: 128000,
          })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      const RecognitionCtor = getSpeechRecognitionCtor();
      if (RecognitionCtor) {
        try {
          const recognition = new RecognitionCtor();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = getBrowserRecognitionLanguage(languageHint);

          recognition.onresult = (event: any) => {
            let interim = "";

            for (
              let i = Number(event?.resultIndex || 0);
              i < Number(event?.results?.length || 0);
              i += 1
            ) {
              const result = event.results[i];
              const transcript = String(result?.[0]?.transcript || "").trim();

              if (!transcript) continue;

              if (!result?.isFinal) {
                interim = `${interim} ${transcript}`.trim();
              }
            }

            setInterimTranscript(interim);
            callbacksRef.current.onInterimTranscript?.(interim);
          };

          recognition.onerror = () => {
            // ignore and rely on server transcription
          };

          recognition.onend = () => {
            // browser live recognition can end early; keep recorder alive
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          // ignore browser speech-recognition startup issues
        }
      }
    } catch (err) {
      cancelInternal(true);
      setError(humanizeSpeechError(err));
    }
  }, [cancelInternal, enabled, isRecording, isSupported, isTranscribing, languageHint]);

  const stopRecorderAndBuildBlob = useCallback(async () => {
    return await new Promise<Blob>((resolve, reject) => {
      const recorder = mediaRecorderRef.current;

      if (!recorder) {
        reject(new Error("Recorder is not ready."));
        return;
      }

      const mimeType =
        recorder.mimeType || pickBestRecordingMimeType() || "audio/webm";

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        resolve(blob);
      };

      recorder.onerror = () => {
        reject(new Error("Recording failed."));
      };

      if (recorder.state === "inactive") {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        resolve(blob);
        return;
      }

      recorder.stop();
    });
  }, []);

  const stop = useCallback(async () => {
    if (!isRecording || isTranscribing) return;

    setError("");
    setIsRecording(false);
    cleanupRecognition();

    try {
      const blob = await stopRecorderAndBuildBlob();
      cleanupStream();
      resetRecorderState();

      if (!blob.size) {
        throw new Error("No audio was captured.");
      }

      setIsTranscribing(true);

      const mimeType = blob.type || "audio/webm";
      const extension = fileExtensionForMimeType(mimeType);
      const fileName = `drafting-voice-${Date.now()}${extension}`;

      const file = new File([blob], fileName, { type: mimeType });
      const formData = new FormData();

      formData.append("file", file);

      const normalizedLanguage = normalizeTranscriptionLanguage(languageHint);
      if (normalizedLanguage) {
        formData.append("language", normalizedLanguage);
      }

      formData.append(
        "prompt",
        "This is dictated text for legal drafting. Expect legal terms, names, clauses, notices, agreements, petitions, invoices, breach, indemnity, arbitration, jurisdiction, advocate, affidavit, annexure, plaintiff, defendant, and court-related vocabulary."
      );

      const response = await speechService.transcribe(formData);
      const transcript = String(response.text || "").trim();

      if (!transcript) {
        throw new Error("No speech was detected.");
      }

      setInterimTranscript("");
      callbacksRef.current.onInterimTranscript?.("");
      callbacksRef.current.onFinalTranscript?.(transcript);
    } catch (err) {
      setError(humanizeSpeechError(err));
      callbacksRef.current.onCancelRestore?.();
    } finally {
      setIsTranscribing(false);
    }
  }, [
    cleanupRecognition,
    cleanupStream,
    isRecording,
    isTranscribing,
    languageHint,
    resetRecorderState,
    stopRecorderAndBuildBlob,
  ]);

  const toggle = useCallback(async () => {
    if (isRecording) {
      await stop();
      return;
    }

    await start();
  }, [isRecording, start, stop]);

  useEffect(() => {
    if (!enabled) {
      cancelInternal(true);
      setError("");
    }
  }, [enabled, cancelInternal]);

  useEffect(() => {
    return () => {
      cancelInternal(false);
    };
  }, [cancelInternal]);

  return {
    isSupported,
    isRecording,
    isTranscribing,
    interimTranscript,
    error,
    toggle,
    clearError: () => setError(""),
  };
}