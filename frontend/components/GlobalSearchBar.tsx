"use client";

/**
 * Global Search Bar — MGR CAPITAL ASSISTANCE
 * Phase 20: AI-Enhanced Global Search
 *
 * Search across cases, users, documents, and communications
 * with real-time suggestions and results modal.
 */

import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery } from "@tanstack/react-query";
import { globalSearchSchema, searchResultDisplay, searchResultLink, type SearchResult } from "@/lib/globalSearch";
import { z } from "zod";
import api from "@/lib/api";
import { AnimatePresence,motion } from "framer-motion";
import { Briefcase,FileText,Loader2,MessageSquare,Search,User,X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback,useEffect,useRef,useState } from "react";

export function GlobalSearchBar() {
  const { user } = useAuth();
  return <SearchSession key={`${user?.id ?? 'anonymous'}:${user?.role ?? 'none'}`} />;
}

function SearchSession() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<z.infer<typeof globalSearchSchema> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => { requestRef.current?.abort(); }, []);

  const debouncedQuery = useDebounce(query, 200);
  const suggestionQuery = useQuery({
    queryKey: ['search-suggestions', user?.id, user?.role, debouncedQuery],
    enabled: Boolean(user) && debouncedQuery.trim().length >= 2,
    queryFn: async ({ signal }) => {
      const response = await api.get<unknown>('/search/global', { params: { query: debouncedQuery, limit: 5 }, signal });
      return globalSearchSchema.parse(response.data).results.flatMap(result => {
        const link = searchResultLink(result, user?.role ?? '');
        const display = searchResultDisplay(result);
        return link ? [{ type: result.type, text: display.title, subtext: display.subtitle, link }] : [];
      });
    }, retry: false, gcTime: 0,
  });
  const suggestions = query === debouncedQuery && query.trim().length >= 2 ? suggestionQuery.data ?? [] : [];

  // Full search
  const performSearch = useCallback(async () => {
    if (query.trim().length < 2 || !user) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setIsLoading(true);
    setError(null);
    setShowSuggestions(false);

    try {
      const res = await api.get<unknown>(`/search/global?query=${encodeURIComponent(query)}`, { signal: controller.signal });
      const parsed = globalSearchSchema.parse(res.data);
      if (parsed.success && !controller.signal.aborted) {
        setResults(parsed);
        setIsOpen(true);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("Search error:", error);
      setResults(null);
      setError("Search is unavailable. Please try again.");
    } finally {
      if (requestRef.current === controller) setIsLoading(false);
    }
  }, [query, user]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        navigateToResult(suggestions[selectedIndex].link);
      } else {
        performSearch();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setIsOpen(false);
      setQuery("");
    }
  };

  // Navigate to result
  const navigateToResult = (link: string) => {
    if (!link.startsWith("/") || link.startsWith("//") || link.includes("\\")) { setError("The search result has an unsupported destination."); return; }
    router.push(link);
    setIsOpen(false);
    setQuery("");
    setShowSuggestions(false);
  };

  const getResultLink = (result: SearchResult): string | null => searchResultLink(result, user?.role ?? '');

  // Get result icon
  const getResultIcon = (type: string) => {
    switch (type) {
      case "case":
        return <Briefcase className="w-4 h-4" />;
      case "user":
        return <User className="w-4 h-4" />;
      case "document":
        return <FileText className="w-4 h-4" />;
      case "communication":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const formatResult = searchResultDisplay;

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {/* Search Input */}
      <div ref={containerRef} className="relative w-full max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { requestRef.current?.abort(); setIsLoading(false); setQuery(e.target.value); setSelectedIndex(-1); setShowSuggestions(true); }}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && setShowSuggestions(true)}
            placeholder="Search cases, users, documents..."
            className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {isLoading ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
          ) : query && (
            <button
              onClick={() => {
                setQuery("");
                setResults(null);
                setShowSuggestions(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.type}-${index}`}
                  onClick={() => navigateToResult(suggestion.link)}
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    index === selectedIndex ? "bg-gray-50 dark:bg-gray-700" : ""
                  }`}
                >
                  <span className="text-gray-400">{getResultIcon(suggestion.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {suggestion.text}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {suggestion.subtext}
                    </p>
                  </div>
                </button>
              ))}
              <button
                onClick={performSearch}
                className="w-full px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-700"
              >
                Search all for &quot;{query}&quot;
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      {/* Results Modal */}
      <AnimatePresence>
        {isOpen && results && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 top-20 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl max-h-[70vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Search Results
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {results.totalResults} results for &quot;{results.query}&quot; ({results.searchTime}ms)
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Breakdown */}
                <div className="flex gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {results.breakdown.cases > 0 && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      {results.breakdown.cases} cases
                    </span>
                  )}
                  {results.breakdown.users > 0 && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {results.breakdown.users} users
                    </span>
                  )}
                  {results.breakdown.documents > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {results.breakdown.documents} documents
                    </span>
                  )}
                  {results.breakdown.communications > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {results.breakdown.communications} communications
                    </span>
                  )}
                </div>
              </div>

              {/* Results List */}
              <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
                {results.results.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No results found</p>
                    <p className="text-sm mt-1">Try different keywords</p>
                  </div>
                ) : (
                  results.results.map((result) => {
                    const { title, subtitle } = formatResult(result);
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        disabled={!getResultLink(result)}
                        onClick={() => { const link = getResultLink(result); if (link) navigateToResult(link); }}
                        className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <span className="mt-1 text-gray-400">{getResultIcon(result.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {title}
                            </p>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 capitalize">
                              {result.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {subtitle}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Matched: {result.matchedField}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {result.score}%
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
