"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  GraduationCap,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  FileText,
  Clock,
  Award,
} from "lucide-react";
import Link from "next/link";

interface TrainingProgressItem {
  moduleId: string;
  title: string;
  status: string;
  progress: number;
  bestScore: number | null;
  completedAt: string | null;
}

interface EmployeeComplianceData {
  trainingProgress: TrainingProgressItem[];
  completedCount: number;
  totalCount: number;
  overdueCount: number;
  certifications: string[];
  complianceRate: number;
}

export default function EmployeeCompliancePage() {
  // Fetch employee's own compliance data
  const { data, isLoading, refetch } = useQuery<EmployeeComplianceData>({
    queryKey: ["employee-compliance"],
    queryFn: async () => {
      // Get current user's training progress
      const { data: trainingData } = await api.get("/employees/me/training");
      const progress: TrainingProgressItem[] = trainingData.data || [];

      const completedCount = progress.filter((p) => p.status === "COMPLETED").length;
      const totalCount = progress.length;
      // Status-based: NOT_STARTED, IN_PROGRESS, COMPLETED
      const overdueCount = progress.filter((p) => p.status === "IN_PROGRESS" && p.progress < 50).length;

      const certifications = progress
        .filter((p) => p.status === "COMPLETED" && p.title.toLowerCase().includes("certification"))
        .map((p) => p.title);

      return {
        trainingProgress: progress,
        completedCount,
        totalCount,
        overdueCount,
        certifications,
        complianceRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100,
      };
    },
  });

  const isCompliant = data ? data.overdueCount === 0 : true;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Shield className="h-7 w-7 md:h-8 md:w-8" />
            My Compliance
          </h1>
          <p className="text-muted-foreground">
            Track your training progress and compliance status
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Compliance Status */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Status Banner */}
          <Card className={isCompliant ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                {isCompliant ? (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                )}
                <div>
                  <p className="text-lg font-bold">
                    {isCompliant ? "You are compliant" : "Action Required"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isCompliant
                      ? "All training modules are up to date"
                      : `You have ${data.overdueCount} overdue training module(s)`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{data.complianceRate}%</p>
                    <p className="text-xs text-muted-foreground">Compliance Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{data.completedCount}/{data.totalCount}</p>
                    <p className="text-xs text-muted-foreground">Modules Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{data.overdueCount}</p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{data.certifications.length}</p>
                    <p className="text-xs text-muted-foreground">Certifications</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Training Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Training Progress</CardTitle>
              <CardDescription>Your assigned training modules and their status</CardDescription>
            </CardHeader>
            <CardContent>
              {data.trainingProgress.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No training modules assigned</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.trainingProgress.map((module) => {
                    const isComplete = module.status === "COMPLETED";
                    const isInProgress = module.status === "IN_PROGRESS";
                    const notStarted = module.status === "NOT_STARTED";

                    return (
                      <div
                        key={module.moduleId}
                        className={`p-4 rounded-lg border ${
                          isComplete
                            ? "border-green-200 bg-green-50 dark:bg-green-950/20"
                            : isInProgress
                            ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20"
                            : "border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isComplete ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : isInProgress ? (
                              <Clock className="h-5 w-5 text-blue-500" />
                            ) : (
                              <FileText className="h-5 w-5 text-gray-400" />
                            )}
                            <div>
                              <p className="font-medium">{module.title}</p>
                              {module.bestScore !== null && (
                                <p className="text-xs text-muted-foreground">
                                  Best Score: {module.bestScore}%
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant={
                              isComplete
                                ? "default"
                                : isInProgress
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {isComplete
                              ? "Completed"
                              : isInProgress
                              ? "In Progress"
                              : "Not Started"}
                          </Badge>
                        </div>

                        {!isComplete && (
                          <>
                            <Progress value={module.progress} className="h-2 mb-2" />
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                {module.progress}% complete
                              </span>
                            </div>
                          </>
                        )}

                        {isComplete && module.completedAt && (
                          <p className="text-sm text-green-600">
                            Completed on {new Date(module.completedAt).toLocaleDateString()}
                          </p>
                        )}

                        {!isComplete && (
                          <div className="mt-3">
                            <Link href={`/employee/training/${module.moduleId}`}>
                              <Button size="sm" variant={isInProgress ? "default" : "outline"}>
                                {isInProgress ? "Continue Training" : "Start Module"}
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Certifications */}
          {data.certifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Your Certifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.certifications.map((cert, idx) => (
                    <Badge key={idx} variant="default" className="text-sm py-1 px-3">
                      <Award className="h-3 w-3 mr-1" />
                      {cert}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
