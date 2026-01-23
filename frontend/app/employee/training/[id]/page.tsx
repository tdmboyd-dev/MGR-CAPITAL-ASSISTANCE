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
import { Confetti } from "@/components/ui/confetti";
import { toast } from "sonner";
import {
  ArrowLeft,
  Play,
  CheckCircle,
  BookOpen,
  Clock,
  Award,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface QuizResult {
  passed: boolean;
  score: number;
  required: number;
  feedback: Array<{
    questionIndex: number;
    correct: boolean;
    explanation: string;
  }>;
}

export default function TrainingModulePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const moduleId = params.id as string;
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["training-module", moduleId],
    queryFn: async () => {
      const { data } = await api.get(`/training/${moduleId}`);
      return data;
    },
  });

  const quizMutation = useMutation({
    mutationFn: async () => {
      const answersArray = Object.values(quizAnswers);
      const { data } = await api.post(`/training/${moduleId}/quiz`, {
        answers: answersArray,
      });
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        const result = data.data as QuizResult;
        setQuizResult(result);
        if (result.passed) {
          setShowConfetti(true);
          toast.success(`Congratulations! You passed with ${result.score}%!`);
          queryClient.invalidateQueries({ queryKey: ["training-modules"] });
          setTimeout(() => setShowConfetti(false), 4000);
        } else {
          toast.error(`You scored ${result.score}%. Need ${result.required}% to pass. Try again!`);
        }
      } else {
        toast.error(data.error || "Failed to submit quiz");
      }
    },
    onError: () => {
      toast.error("Failed to submit quiz");
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/training/${moduleId}/quiz`, {
        answers: [],
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Module completed successfully!");
      queryClient.invalidateQueries({ queryKey: ["training-modules"] });
      router.push("/employee/training");
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
      <Confetti active={showConfetti} />

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
              You need {module.passingScore || 80}% to pass.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {quizResult ? (
              /* Quiz Results */
              <div className="space-y-6">
                <div className={`p-6 rounded-lg text-center ${
                  quizResult.passed
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-red-500/10 border border-red-500/20"
                }`}>
                  {quizResult.passed ? (
                    <>
                      <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                      <h3 className="text-xl font-bold text-green-600 dark:text-green-400">
                        Congratulations! You Passed!
                      </h3>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-12 w-12 mx-auto mb-3 text-red-500" />
                      <h3 className="text-xl font-bold text-red-600 dark:text-red-400">
                        Not Quite There Yet
                      </h3>
                    </>
                  )}
                  <p className="text-3xl font-bold mt-2">{quizResult.score}%</p>
                  <p className="text-muted-foreground">
                    Required: {quizResult.required}%
                  </p>
                </div>

                {/* Feedback */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Question Review</h4>
                  {quizResult.feedback.map((fb, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        fb.correct
                          ? "border-green-500/30 bg-green-500/5"
                          : "border-red-500/30 bg-red-500/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {fb.correct ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium">Question {index + 1}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {fb.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between pt-4 border-t">
                  {quizResult.passed ? (
                    <Button onClick={() => router.push("/employee/training")}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Continue to Training
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setQuizResult(null);
                          setQuizAnswers({});
                        }}
                      >
                        Try Again
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowQuiz(false);
                          setQuizResult(null);
                          setQuizAnswers({});
                        }}
                      >
                        Review Content
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : module.questions?.length > 0 ? (
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
                          className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                            quizAnswers[index] === optIndex
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-muted"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${index}`}
                            value={optIndex}
                            checked={quizAnswers[index] === optIndex}
                            onChange={() =>
                              setQuizAnswers((prev) => ({
                                ...prev,
                                [index]: optIndex,
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
                    onClick={() => quizMutation.mutate()}
                    disabled={
                      quizMutation.isPending ||
                      Object.keys(quizAnswers).length < (module.questions?.length || 0)
                    }
                  >
                    {quizMutation.isPending ? "Submitting..." : "Submit Quiz"}
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
