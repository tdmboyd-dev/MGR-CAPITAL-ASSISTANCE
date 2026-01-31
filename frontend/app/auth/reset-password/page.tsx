"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { Loader2, Lock, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const formSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const missingParams = !userId || !token;

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
  });

  const onSubmit = async (data: FormValues) => {
    if (missingParams) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          token,
          newPassword: data.newPassword,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setIsSuccess(true);
        toast.success("Password reset successfully!", {
          description: "You can now log in with your new password.",
        });
      } else {
        setErrorMessage(
          result.message || "Password reset link is invalid or has expired. Please request a new one."
        );
      }
    } catch (err) {
      setErrorMessage("Something went wrong. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        <Card className="border-none shadow-2xl backdrop-blur-xl bg-white/75 dark:bg-slate-900/75 rounded-2xl overflow-hidden">
          <CardHeader className="space-y-1 pb-8 pt-10 px-10 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mx-auto mb-6 h-20 w-20 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl"
            >
              {isSuccess ? (
                <CheckCircle className="h-10 w-10 text-white" strokeWidth={2.5} />
              ) : missingParams ? (
                <AlertCircle className="h-10 w-10 text-white" strokeWidth={2.5} />
              ) : (
                <Lock className="h-10 w-10 text-white" strokeWidth={2.5} />
              )}
            </motion.div>
            <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {isSuccess
                ? "Password Reset!"
                : missingParams
                ? "Invalid Link"
                : "Set New Password"}
            </CardTitle>
            <CardDescription className="text-base text-slate-600 dark:text-slate-400 mt-2">
              {isSuccess
                ? "Your password has been reset successfully."
                : missingParams
                ? "This password reset link is invalid or incomplete."
                : "Enter your new password below"}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-10 pb-10">
            {isSuccess ? (
              <div className="space-y-6">
                <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                  You can now log in with your new password.
                </p>
                <Link href="/auth/login">
                  <Button className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-base shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300">
                    Go to Login
                  </Button>
                </Link>
              </div>
            ) : missingParams ? (
              <div className="space-y-6">
                <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                  Please request a new password reset link from the forgot password page.
                </p>
                <Link href="/auth/forgot-password">
                  <Button className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-base shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300">
                    Request New Link
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {errorMessage && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-400">
                      {errorMessage}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label
                    htmlFor="newPassword"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    New Password
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Enter new password"
                    className="h-12 px-4 rounded-xl border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm"
                    {...register("newPassword")}
                    disabled={isLoading}
                  />
                  {errors.newPassword && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      {errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    className="h-12 px-4 rounded-xl border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm"
                    {...register("confirmPassword")}
                    disabled={isLoading}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <p>Password must contain:</p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    <li>At least 8 characters</li>
                    <li>One uppercase letter</li>
                    <li>One lowercase letter</li>
                    <li>One number</li>
                    <li>One special character</li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !isValid}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-base shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </form>
            )}

            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 mt-6 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-8">
          {new Date().getFullYear()} MGR Capital Assistance - Secure - Private - Sovereign
        </p>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
