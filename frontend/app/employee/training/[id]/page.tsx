"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft,
  Play,
  CheckCircle,
  BookOpen,
  Clock,
  Award,
} from "lucide-react";

export default function TrainingModulePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const moduleId = params.id as string;
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["training-module", moduleId],
    queryFn: async () => {
      const { data } = await api.get(`/training/${moduleId}`);
      return data;
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/training/complete/${moduleId}`, {
        answers: quizAnswers,
      });
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Module completed successfully!");
        queryClient.invalidateQueries({ queryKey: ["training-modules"] });
        router.push("/employee/training");
      } else {
        toast.error(data.error || "Failed to complete module");
      }
    },
    onError: () => {
      toast.error("Failed to complete module");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const module = data?.data;

  if (!module) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold">Module Not Found</h2>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{module.title}</h1>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {module.duration || 15} minutes
            </span>
            {module.completed && (
              <span className="flex items-center gap-1 text-green-500">
                <CheckCircle className="h-4 w-4" />
                Completed
              </span>
            )}
          </div>
        </div>
      </div>

      {!showQuiz ? (
        <>
          {/* Video Player Placeholder */}
          <Card>
            <CardContent className="pt-6">
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                {module.videoUrl ? (
                  <video
                    src={module.videoUrl}
                    controls
                    className="w-full h-full rounded-lg"
                  />
                ) : (
                  <div className="text-center">
                    <Play className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Video content will be displayed here
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Module Content */}
          <Card>
            <CardHeader>
              <CardTitle>Module Content</CardTitle>
              <CardDescription>{module.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {module.content ? (
                  <div dangerouslySetInnerHTML={{ __html: module.content }} />
                ) : (
                  <p className="text-muted-foreground">
                    This module covers important concepts for surplus recovery
                    operations. Complete the video above and then take the quiz
                    to mark this module as complete.
                  </p>
                )}
              </div>

              <div className="mt-6 pt-6 border-t flex justify-end">
                {module.hasQuiz ? (
                  <Button onClick={() => setShowQuiz(true)}>
                    <Award className="h-4 w-4 mr-2" />
                    Take Quiz
                  </Button>
                ) : (
                  <Button
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending || module.completed}
                  >
                    {module.completed ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Already Completed
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Complete
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Quiz Section */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Module Quiz
            </CardTitle>
            <CardDescription>
              Answer the following questions to complete this module.
              You need {module.passingScore || 70}% to pass.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {module.questions?.length > 0 ? (
              <div className="space-y-6">
                {module.questions.map((q: any, index: number) => (
                  <div key={index} className="p-4 rounded-lg border">
                    <p className="font-medium mb-3">
                      {index + 1}. {q.question}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((option: string, optIndex: number) => (
                        <label
                          key={optIndex}
                          className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`question-${index}`}
                            value={option}
                            checked={quizAnswers[index] === option}
                            onChange={() =>
                              setQuizAnswers((prev) => ({
                                ...prev,
                                [index]: option,
                              }))
                            }
                            className="h-4 w-4"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex justify-between pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowQuiz(false)}>
                    Back to Content
                  </Button>
                  <Button
                    onClick={() => completeMutation.mutate()}
                    disabled={
                      completeMutation.isPending ||
                      Object.keys(quizAnswers).length < (module.questions?.length || 0)
                    }
                  >
                    Submit Quiz
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No quiz questions available for this module.
                </p>
                <Button
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Module
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
