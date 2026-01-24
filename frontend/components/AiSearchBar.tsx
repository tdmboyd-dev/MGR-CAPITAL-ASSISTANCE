"use client";

/**
 * AiSearchBar.tsx — MGR CAPITAL ASSISTANCE
 * AI-powered semantic search component
 * Phase 14: AI-Enhanced Search & Recommendations
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, FileText, Briefcase, MessageSquare, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  type: "cases" | "docs" | "comms";
  title: string;
  snippet: string;
  score: number;
  metadata: Record<string, any>;
}

interface SearchResponse {
  success: boolean;
  query: string;
  type: string;
  results: SearchResult[];
  totalCount: number;
  processingTimeMs: number;
}

const typeIcons = {
  cases: Briefcase,
  docs: FileText,
  comms: MessageSquare,
};

const typeColors = {
  cases: "bg-blue-100 text-blue-800",
  docs: "bg-green-100 text-green-800",
  comms: "bg-purple-100 text-purple-800",
};

export function AiSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<"all" | "cases" | "docs" | "comms">("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        // Fetch suggestions
        const suggestRes = await fetch(
          `/api/ai/search/suggestions?query=${encodeURIComponent(query)}`,
          { credentials: "include" }
        );
        if (suggestRes.ok) {
          const data = await suggestRes.json();
          setSuggestions(data.suggestions || []);
        }

        // Fetch search results
        const searchRes = await fetch(
          `/api/ai/search?query=${encodeURIComponent(query)}&type=${selectedType}&limit=8`,
          { credentials: "include" }
        );
        if (searchRes.ok) {
          const data: SearchResponse = await searchRes.json();
          setResults(data.results);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, selectedType]);

  const handleResultClick = useCallback((result: SearchResult) => {
    setIsOpen(false);
    setQuery("");

    // Navigate based on result type
    switch (result.type) {
      case "cases":
        router.push(`/employee/cases/${result.id}`);
        break;
      case "docs":
        router.push(`/employee/documents?id=${result.id}`);
        break;
      case "comms":
        router.push(`/employee/comms?highlight=${result.id}`);
        break;
    }
  }, [router]);

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    inputRef.current?.focus();
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full max-w-xl" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="AI Search: cases, documents, communications..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isLoading && (
          <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Filter Tabs */}
      {isOpen && query.length >= 2 && (
        <div className="flex gap-1 mt-2 mb-1">
          {(["all", "cases", "docs", "comms"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-2 py-1 text-xs rounded ${
                selectedType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Results Dropdown */}
      {isOpen && (query.length >= 2 || suggestions.length > 0) && (
        <Card className="absolute z-50 w-full mt-1 max-h-96 overflow-auto shadow-lg">
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-2 border-b">
              <p className="text-xs text-muted-foreground mb-1">Suggestions</p>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((s, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleSuggestionClick(s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {results.length > 0 ? (
            <div className="divide-y">
              {results.map((result) => {
                const Icon = typeIcons[result.type];
                return (
                  <div
                    key={`${result.type}-${result.id}`}
                    className="p-3 hover:bg-muted cursor-pointer"
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded ${typeColors[result.type]}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{result.title}</span>
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(result.score * 100)}%
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {result.snippet}
                        </p>
                        {result.metadata.status && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {result.metadata.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : query.length >= 2 && !isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              No results found for "{query}"
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}

export default AiSearchBar;
