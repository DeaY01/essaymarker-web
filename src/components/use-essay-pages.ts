"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_PAGES } from "@/lib/essay-rules";
import { PhotoError, preparePhoto } from "@/lib/prepare-photo";

export interface EssayPageDraft {
  id: string;
  file: File;
  /** Extra clockwise rotation chosen by the student. */
  rotation: number;
  /** Bumped on every reprocess so stale results are ignored. */
  version: number;
  status: "processing" | "ready" | "error";
  blob?: Blob;
  previewUrl?: string;
  error?: string;
}

let nextId = 0;
const createId = () => `page-${Date.now()}-${nextId++}`;

export function useEssayPages() {
  const [pages, setPages] = useState<EssayPageDraft[]>([]);
  const pagesRef = useRef<EssayPageDraft[]>([]);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  // Release preview images when the component goes away.
  useEffect(
    () => () => {
      for (const page of pagesRef.current) {
        if (page.previewUrl) URL.revokeObjectURL(page.previewUrl);
      }
    },
    [],
  );

  const process = useCallback(async (id: string, file: File, rotation: number, version: number) => {
    let update: Partial<EssayPageDraft>;
    try {
      const blob = await preparePhoto(file, rotation);
      update = { status: "ready", blob, previewUrl: URL.createObjectURL(blob), error: undefined };
    } catch (error) {
      update = {
        status: "error",
        blob: undefined,
        previewUrl: undefined,
        error: error instanceof PhotoError ? error.message : "This photo could not be processed.",
      };
    }

    setPages((current) =>
      current.map((page) => {
        if (page.id !== id || page.version !== version) {
          return page;
        }
        if (page.previewUrl) URL.revokeObjectURL(page.previewUrl);
        return { ...page, ...update };
      }),
    );

    // The page was removed or reprocessed meanwhile; drop the unused preview.
    const stillCurrent = pagesRef.current.some((page) => page.id === id && page.version === version);
    if (!stillCurrent && update.previewUrl) URL.revokeObjectURL(update.previewUrl);
  }, []);

  /** Adds photos in the order given. Returns a message if some were not added. */
  const addFiles = useCallback(
    (files: Iterable<File>): string | null => {
      const incoming = Array.from(files);
      const room = MAX_PAGES - pagesRef.current.length;
      const accepted = incoming.filter((file) => file.type.startsWith("image/") || file.type === "");
      const toAdd = accepted.slice(0, Math.max(room, 0));

      const drafts = toAdd.map<EssayPageDraft>((file) => ({
        id: createId(),
        file,
        rotation: 0,
        version: 0,
        status: "processing",
      }));
      if (drafts.length > 0) {
        const next = [...pagesRef.current, ...drafts];
        pagesRef.current = next;
        setPages(next);
        for (const draft of drafts) void process(draft.id, draft.file, 0, 0);
      }

      if (accepted.length < incoming.length) {
        return "Only photos can be uploaded. Other files were ignored.";
      }
      if (toAdd.length < accepted.length) {
        return `An essay can have up to ${MAX_PAGES} pages. Extra photos were not added.`;
      }
      return null;
    },
    [process],
  );

  const rotate = useCallback(
    (id: string) => {
      const page = pagesRef.current.find((candidate) => candidate.id === id);
      if (!page) return;
      const rotation = (page.rotation + 90) % 360;
      const version = page.version + 1;
      setPages((current) =>
        current.map((candidate) =>
          candidate.id === id ? { ...candidate, rotation, version, status: "processing" } : candidate,
        ),
      );
      pagesRef.current = pagesRef.current.map((candidate) =>
        candidate.id === id ? { ...candidate, rotation, version } : candidate,
      );
      void process(id, page.file, rotation, version);
    },
    [process],
  );

  const move = useCallback((id: string, offset: -1 | 1) => {
    setPages((current) => {
      const index = current.findIndex((page) => page.id === id);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setPages((current) => {
      const page = current.find((candidate) => candidate.id === id);
      if (page?.previewUrl) URL.revokeObjectURL(page.previewUrl);
      return current.filter((candidate) => candidate.id !== id);
    });
    pagesRef.current = pagesRef.current.filter((candidate) => candidate.id !== id);
  }, []);

  const clear = useCallback(() => {
    for (const page of pagesRef.current) {
      if (page.previewUrl) URL.revokeObjectURL(page.previewUrl);
    }
    pagesRef.current = [];
    setPages([]);
  }, []);

  return { pages, addFiles, rotate, move, remove, clear };
}
