"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface Options<T> {
  /** Debounce window; the roadmap asks for ~2s. */
  delayMs?: number;
  onSave: (value: T) => Promise<void>;
}

/**
 * Debounced autosave.
 *
 * Saves are serialized: if edits land while a save is in flight, the hook waits
 * and then saves the newest value rather than firing overlapping PATCHes that
 * could apply out of order. A beforeunload guard warns on unsaved edits so a
 * refresh can't silently drop work.
 */
export function useAutosave<T>(value: T, { delayMs = 2000, onSave }: Options<T>) {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pending = useRef<T | null>(null);
  /** The last value we know is persisted — first render is already saved. */
  const savedRef = useRef<string>(JSON.stringify(value));
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = useCallback(async (next: T) => {
    if (inFlight.current) {
      pending.current = next;
      return;
    }
    inFlight.current = true;
    setState("saving");
    try {
      await onSaveRef.current(next);
      savedRef.current = JSON.stringify(next);
      setState("saved");
    } catch {
      setState("error");
    } finally {
      inFlight.current = false;
      const queued = pending.current;
      pending.current = null;
      // Something changed mid-save — persist the newest value.
      if (queued !== null && JSON.stringify(queued) !== savedRef.current) {
        void flush(queued);
      }
    }
  }, []);

  useEffect(() => {
    const serialized = JSON.stringify(value);
    if (serialized === savedRef.current) return;

    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(value), delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delayMs, flush]);

  // Don't let a refresh drop edits still sitting in the debounce window.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(value) !== savedRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [value]);

  /** Save immediately, e.g. on Cmd+S or when leaving the page. */
  const saveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (JSON.stringify(value) !== savedRef.current) await flush(value);
  }, [value, flush]);

  return { state, saveNow };
}
