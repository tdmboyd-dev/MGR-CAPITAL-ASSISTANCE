"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkeletonList } from "@/components/ui/skeleton";
import { BookOpen, Play, CheckCircle, Clock, Lock } from "lucide-react";

export default function EmployeeTrainingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["training-modules"],
    queryFn: async () => {
      const { data } = await api.get("/training");
      return data;
    },
  });

  const modules = data?.data || [];
  const completedCount = modules.filter((m: any) => m.completed).length;
  const totalCount = modules.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Training Center</h1>
        <p className="text-muted-foreground">
          Complete required modules to advance your career
        </p>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Overall Progress</p>
              <p className="text-2xl font-bold">
                {completedCount} of {totalCount} modules completed
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">{progressPercent}%</p>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-primary rounded-full h-3 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Module List */}
      <Card>
        <CardHeader>
          <CardTitle>Training Modules</CardTitle>
          <CardDescription>
            Click on a module to start or continue learning
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonList items={5} />
          ) : modules.length > 0 ? (
            <div className="space-y-3">
              {modules.map((module: any, index: number) => {
                const isLocked = module.locked;
                const isCompleted = module.completed;
                const isInProgress = module.progress > 0 && !isCompleted;

                return (
                  <div
                    key={module.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      isLocked
                        ? "bg-muted/30 opacity-60"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          isCompleted
                            ? "bg-green-500/10"
                            : isInProgress
                            ? "bg-blue-500/10"
                            : isLocked
                            ? "bg-muted"
                            : "bg-primary/10"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : isLocked ? (
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <BookOpen className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            Module {index + 1}: {module.title}
                          </span>
                          {isCompleted && (
                            <Badge variant="success" className="text-xs">
                              Completed
                            </Badge>
                          )}
                          {isInProgress && (
                            <Badge variant="info" className="text-xs">
                              In Progress
                            </Badge>
                          )}
                          {module.required && (
                            <Badge variant="outline" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {module.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {module.duration || 15} min
                          </span>
                          {module.progress > 0 && !isCompleted && (
                            <span>{module.progress}% complete</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      {isLocked ? (
                        <Button variant="outline" disabled>
                          <Lock className="h-4 w-4 mr-2" />
                          Locked
                        </Button>
                      ) : isCompleted ? (
                        <Link href={`/employee/training/${module.id}`}>
                          <Button variant="outline">
                            Review
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/employee/training/${module.id}`}>
                          <Button>
                            <Play className="h-4 w-4 mr-2" />
                            {isInProgress ? "Continue" : "Start"}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No training modules available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
