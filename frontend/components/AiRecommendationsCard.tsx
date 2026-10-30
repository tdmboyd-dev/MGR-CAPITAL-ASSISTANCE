"use client";

/**
 * AiRecommendationsCard.tsx — MGR CAPITAL ASSISTANCE
 * AI-powered recommendations component for case detail pages
 * Phase 14: AI-Enhanced Search & Recommendations
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
AlertTriangle,
Calendar,
ChevronRight,
FileText,
Lightbulb,
Phone,
RefreshCw,
Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { z } from "zod";

const recommendationSchema = z.object({ caseId: z.string(), generatedAt: z.string(), recommendations: z.array(z.object({
  id: z.string(), type: z.enum(['action', 'training', 'follow_up', 'priority']), title: z.string(), description: z.string(),
  confidence: z.number().finite().min(0).max(1), reasoning: z.string(), suggestedAction: z.string().optional(),
})) });
type AiRecommendation = z.infer<typeof recommendationSchema>['recommendations'][number];

const typeConfig = {
  action: {
    icon: FileText,
    color: "bg-blue-100 text-blue-800 border-blue-200",
    label: "Action",
  },
  follow_up: {
    icon: Phone,
    color: "bg-green-100 text-green-800 border-green-200",
    label: "Follow Up",
  },
  priority: {
    icon: AlertTriangle,
    color: "bg-red-100 text-red-800 border-red-200",
    label: "Priority",
  },
  training: {
    icon: Lightbulb,
    color: "bg-purple-100 text-purple-800 border-purple-200",
    label: "Training",
  },
};

interface AiRecommendationsCardProps {
  caseId: string;
  onActionClick?: (recommendation: AiRecommendation) => void;
}

export function AiRecommendationsCard({ caseId, onActionClick }: AiRecommendationsCardProps) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['case-recommendations', user?.id, caseId],
    enabled: Boolean(user && caseId),
    queryFn: async ({ signal }) => {
      const response = await api.get<unknown>(`/ai/recommendations/case/${encodeURIComponent(caseId)}`, { signal });
      const data = recommendationSchema.parse(response.data);
      if (data.caseId !== caseId) throw new Error('Recommendation case mismatch');
      return data;
    }, retry: false, gcTime: 0,
  });
  const { data, isLoading, isFetching: isRefreshing } = query;
  const error = query.isError ? 'Unable to load AI recommendations' : null;
  const fetchRecommendations = () => { void query.refetch(); };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchRecommendations} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const recommendations = data?.recommendations || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">AI Recommendations</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRecommendations}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {data?.generatedAt && (
          <CardDescription className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Updated {new Date(data.generatedAt).toLocaleTimeString()}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            No recommendations were returned. This does not confirm that the case is on track.
          </p>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => {
              const config = typeConfig[rec.type];
              const Icon = config.icon;

              return (
                <div
                  key={rec.id}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-md border ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{rec.title}</span>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(rec.confidence * 100)}% confidence
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                      {rec.reasoning && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {rec.reasoning}
                        </p>
                      )}
                      {rec.suggestedAction && onActionClick && (
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto mt-2 text-primary"
                          onClick={() => onActionClick(rec)}
                        >
                          {rec.suggestedAction}
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AiRecommendationsCard;
