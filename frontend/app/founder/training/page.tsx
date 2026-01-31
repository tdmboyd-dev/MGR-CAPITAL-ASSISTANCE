"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  Users,
  Trophy,
  BarChart3,
  Search,
  RefreshCw,
  BookOpen,
} from "lucide-react";

interface TrainingModule {
  id: string;
  name: string;
  category: string;
  status: string;
  enrolledCount: number;
  completionRate: number;
  avgScore: number;
  createdAt: string;
}

const MODULE_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  DRAFT: "bg-gray-100 text-gray-700",
  ARCHIVED: "bg-yellow-100 text-yellow-700",
};

export default function FounderTrainingPage() {
  const [search, setSearch] = useState("");

  const { data: modulesData, isLoading, refetch } = useQuery<TrainingModule[]>({
    queryKey: ["training-modules"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/training/modules");
        return Array.isArray(data) ? data : data?.data || [];
      } catch {
        return [];
      }
    },
  });

  const modules = modulesData || [];

  const filteredModules = modules.filter((mod) => {
    const term = search.toLowerCase();
    return (
      mod.name?.toLowerCase().includes(term) ||
      mod.category?.toLowerCase().includes(term) ||
      mod.status?.toLowerCase().includes(term)
    );
  });

  const stats = {
    totalModules: modules.length,
    activeTrainees: modules.reduce((sum, m) => sum + (m.enrolledCount || 0), 0),
    completionRate:
      modules.length > 0
        ? Math.round(
            modules.reduce((sum, m) => sum + (m.completionRate || 0), 0) / modules.length
          )
        : 0,
    avgScore:
      modules.length > 0
        ? Math.round(
            modules.reduce((sum, m) => sum + (m.avgScore || 0), 0) / modules.length
          )
        : 0,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GraduationCap className="w-8 h-8 text-blue-600" />
            Training Management
          </h1>
          <p className="text-muted-foreground">
            Manage training modules, track progress, and monitor completion rates
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Modules</p>
                <p className="text-2xl font-bold">{stats.totalModules}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Trainees</p>
                <p className="text-2xl font-bold">{stats.activeTrainees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <Trophy className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold">{stats.completionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-full">
                <BarChart3 className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Score</p>
                <p className="text-2xl font-bold">{stats.avgScore}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search training modules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Training Modules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Training Modules ({filteredModules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredModules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No training modules yet. Create your first module to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Category</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Enrolled</th>
                    <th className="text-right p-3 font-medium">Completion %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModules.map((mod) => (
                    <tr
                      key={mod.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-3 font-medium">{mod.name}</td>
                      <td className="p-3 text-muted-foreground">{mod.category}</td>
                      <td className="p-3">
                        <Badge className={MODULE_STATUS_COLORS[mod.status] || "bg-gray-100 text-gray-700"}>
                          {mod.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">{mod.enrolledCount}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                mod.completionRate >= 80
                                  ? "bg-green-500"
                                  : mod.completionRate >= 50
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(mod.completionRate, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">
                            {mod.completionRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
