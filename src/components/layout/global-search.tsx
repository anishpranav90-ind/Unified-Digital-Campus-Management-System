"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import type { SearchResult } from "@/lib/data/search";

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as { results: SearchResult[] };
          setResults(data.results);
          setOpen(true);
        }
      } catch {
        // aborted or offline
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Derived: a query shorter than two characters never shows stale results.
  const visibleResults = query.trim().length >= 2 ? results : [];

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => visibleResults.length && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && visibleResults[0]) go(visibleResults[0].href);
          }}
          placeholder="Search campus…"
          aria-label="Search UniSync"
          className="focus-ring h-9 w-full rounded-xl border border-line bg-slate-50 pl-9 pr-8 text-sm placeholder:text-slate-400 focus:bg-white"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
        ) : query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-96 overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-lift">
          {visibleResults.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted">No matches for “{query}”.</p>
          ) : (
            visibleResults.map((result) => (
              <button
                key={`${result.module}-${result.id}-${result.href}`}
                type="button"
                onClick={() => go(result.href)}
                className="flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <span className="line-clamp-1">{result.title}</span>
                  <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                    {result.module}
                  </span>
                </span>
                <span className="line-clamp-1 text-xs text-muted">{result.subtitle}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
