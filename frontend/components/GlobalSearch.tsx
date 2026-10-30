"use client";

import { Button } from "@/components/ui/button";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { api } from "@/lib/api";
import { AnimatePresence,motion } from "framer-motion";
import { Briefcase,FileText,Loader2,Search,Settings,Users,X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { globalSearchSchema, searchResultDisplay, searchResultLink } from "@/lib/globalSearch";
import { useRouter } from "next/navigation";
import { useEffect,useRef,useState } from "react";

interface SearchResult {
  id: string;
  type: "case" | "client" | "document" | "employee" | "setting" | "communication";
  title: string;
  subtitle?: string;
  link: string;
}

const typeIcons: Record<string, import("lucide-react").LucideIcon> = {
  case: Briefcase,
  client: Users,
  document: FileText,
  employee: Users,
  setting: Settings,
};

const typeColors: Record<string, string> = {
  case: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",
  client: "text-green-500 bg-green-100 dark:bg-green-900/30",
  document: "text-purple-500 bg-purple-100 dark:bg-purple-900/30",
  employee: "text-orange-500 bg-orange-100 dark:bg-orange-900/30",
  setting: "text-gray-500 bg-gray-100 dark:bg-gray-800",
};

export function GlobalSearch() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Keyboard shortcut to open search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { data, isFetching: loading, error } = useQuery({
    queryKey: ['global-search', user?.id, user?.role, debouncedQuery],
    enabled: open && Boolean(user) && debouncedQuery.trim().length >= 2,
    queryFn: async ({ signal }) => {
      const response = await api.get<unknown>('/search/global', { params: { query: debouncedQuery, limit: 20 }, signal });
      return globalSearchSchema.parse(response.data);
    },
    retry: false,
    gcTime: 0,
  });
  const results: SearchResult[] = query === debouncedQuery && query.trim().length >= 2
    ? (data?.results ?? []).flatMap(result => {
        const link = searchResultLink(result, user?.role ?? '');
        return link ? [{ id: result.id, type: result.type === 'user' ? 'employee' : result.type, ...searchResultDisplay(result), link }] : [];
      }) : [];
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) { setQuery(''); setSelectedIndex(0); }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, Math.min(prev + 1, results.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        router.push(results[selectedIndex].link);
        changeOpen(false);
      } else if (e.key === "Escape") {
        changeOpen(false);
      }
    };

  if (!user) return null;

  return (
    <>
      {/* Search Button */}
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search...</span>
        <span className="inline-flex lg:hidden">Search</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Search Dialog */}
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>

          {/* Search Input */}
          <div className="flex items-center border-b px-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Search cases, clients, documents..."
              className="h-14 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setQuery("")}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {error ? <p role="alert" className="p-4 text-destructive">Search is unavailable. Please retry; no results were invented.</p> : loading || query !== debouncedQuery ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : results.length > 0 ? (
              <AnimatePresence>
                {results.map((result, index) => {
                  const Icon = typeIcons[result.type] || FileText;
                  const colorClass = typeColors[result.type] || typeColors.document;

                  return (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <button
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                          index === selectedIndex
                            ? "bg-accent"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => {
                          router.push(result.link);
                          changeOpen(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className={`p-2 rounded-lg ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{result.title}</p>
                          {result.subtitle && (
                            <p className="text-sm text-muted-foreground truncate">
                              {result.subtitle}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground capitalize">
                          {result.type}
                        </span>
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            ) : query.length >= 2 ? (
              <div className="py-8 text-center text-muted-foreground">
                No results found for &quot;{query}&quot;
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Start typing to search...
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <div className="flex gap-2">
              <kbd className="rounded border px-1.5 py-0.5 bg-muted">↑↓</kbd>
              <span>Navigate</span>
              <kbd className="rounded border px-1.5 py-0.5 bg-muted ml-2">↵</kbd>
              <span>Select</span>
              <kbd className="rounded border px-1.5 py-0.5 bg-muted ml-2">Esc</kbd>
              <span>Close</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default GlobalSearch;
