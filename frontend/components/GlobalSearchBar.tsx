"use client";

/**
 * Global Search Bar — MGR CAPITAL ASSISTANCE
 * Phase 20: AI-Enhanced Global Search
 *
 * Search across cases, users, documents, and communications
 * with real-time suggestions and results modal.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, FileText, User, MessageSquare, Briefcase, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";

interface SearchResult {
  type: "case" | "user" | "document" | "communication";
  id: string;
  matchedField: string;
  score: number;
  // Case fields
  caseCode?: string;
  status?: string;
  ownerName?: string;
  propertyAddress?: string;
  // User fields
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  // Document fields
  fileName?: string;
  documentType?: string;
  caseId?: string;
  // Communication fields
  subject?: string;
  preview?: string;
  direction?: string;
}

interface SearchResponse {
  success: boolean;
  query: string;
  totalResults: number;
  results: SearchResult[];
  breakdown: {
    cases: number;
    users: number;
    documents: number;
    communications: number;
  };
  searchTime: number;
}

interface Suggestion {
  type: string;
  text: string;
  subtext: string;
  link: string;
}

export function GlobalSearchBar() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced search for suggestions
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/search/suggestions?query=${encodeURIComponent(query)}`);
        if (res.data.success) {
          setSuggestions(res.data.suggestions);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error("Suggestions error:", error);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Full search
  const performSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const res = await api.get(`/search/global?query=${encodeURIComponent(query)}`);
      if (res.data.success) {
        setResults(res.data);
        setIsOpen(true);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

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
    router.push(link);
    setIsOpen(false);
    setQuery("");
    setShowSuggestions(false);
  };

  // Get result link
  const getResultLink = (result: SearchResult): string => {
    switch (result.type) {
      case "case":
        return `/cases/${result.id}`;
      case "user":
        return `/users/${result.id}`;
      case "document":
        return `/cases/${result.caseId}/documents/${result.id}`;
      case "communication":
        return `/cases/${result.caseId}/communications`;
      default:
        return "#";
    }
  };

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

  // Format result display
  const formatResult = (result: SearchResult): { title: string; subtitle: string } => {
    switch (result.type) {
      case "case":
        return {
          title: result.caseCode || "Case",
          subtitle: result.ownerName || result.propertyAddress || result.status || "",
        };
      case "user":
        return {
          title: `${result.firstName || ""} ${result.lastName || ""}`.trim() || result.email || "User",
          subtitle: result.role || "",
        };
      case "document":
        return {
          title: result.fileName || "Document",
          subtitle: `${result.documentType} • Case: ${result.caseCode || result.caseId}`,
        };
      case "communication":
        return {
          title: result.subject || "Communication",
          subtitle: result.preview || "",
        };
      default:
        return { title: "Result", subtitle: "" };
    }
  };

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
            onChange={(e) => setQuery(e.target.value)}
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
                setSuggestions([]);
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
                Search all for "{query}"
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
                      {results.totalResults} results for "{results.query}" ({results.searchTime}ms)
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
                        onClick={() => navigateToResult(getResultLink(result))}
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
