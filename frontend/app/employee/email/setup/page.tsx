"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Mail,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Copy,
  Globe,
  DollarSign,
  Server,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
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

const emailSchema = z.object({
  localPart: z
    .string()
    .min(2, "Username must be at least 2 characters")
    .max(64, "Username must be under 64 characters")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Only letters, numbers, dots, hyphens, and underscores allowed"
    ),
  domain: z
    .string()
    .min(4, "Domain is required")
    .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid domain format"),
});

type EmailFormData = z.infer<typeof emailSchema>;

interface AvailabilityResult {
  available: boolean;
  email: string;
  message?: string;
}

interface CreatedAccount {
  email: string;
  tempPassword: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  dnsRecords?: Array<{ type: string; name: string; value: string; priority?: number }>;
}

export default function EmailSetupPage() {
  const [step, setStep] = useState(1);
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [createdAccount, setCreatedAccount] = useState<CreatedAccount | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      localPart: "",
      domain: "",
    },
  });

  const localPart = watch("localPart");
  const domain = watch("domain");
  const fullEmail = localPart && domain ? `${localPart}@${domain}` : "";

  const checkAvailability = useMutation({
    mutationFn: async (email: string) => {
      const { data } = await api.get(
        `/email-hosting/check?email=${encodeURIComponent(email)}`
      );
      return data as AvailabilityResult;
    },
    onSuccess: (data) => {
      setAvailability(data);
      if (data.available) {
        toast.success("Email address is available!");
        setStep(3);
      } else {
        toast.error(data.message || "Email address is not available");
      }
    },
    onError: () => {
      toast.error("Failed to check availability");
    },
  });

  const createAccount = useMutation({
    mutationFn: async (email: string) => {
      const [local, dom] = email.split("@");
      const { data } = await api.post("/email-hosting/accounts", {
        localPart: local,
        domain: dom,
      });
      return data as CreatedAccount;
    },
    onSuccess: (data) => {
      setCreatedAccount(data);
      setStep(4);
      toast.success("Email account created successfully!");
    },
    onError: () => {
      toast.error("Failed to create email account");
    },
  });

  const onSubmitStep1 = handleSubmit(() => {
    setStep(2);
    checkAvailability.mutate(fullEmail);
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Setup Wizard</h1>
          <p className="text-sm text-muted-foreground">
            Create your professional email account
          </p>
        </div>
        <Link href="/employee/email">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            My Accounts
          </Button>
        </Link>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s < step
                  ? "bg-green-600 text-white"
                  : s === step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <CheckCircle className="h-4 w-4" /> : s}
            </div>
            {s < 4 && (
              <div
                className={`flex-1 h-1 rounded ${
                  s < step ? "bg-green-600" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Pricing Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium">Pricing</p>
              <p className="text-sm text-muted-foreground">
                $12.00 one-time setup fee + $6.00/month recurring
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Enter Email */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Step 1: Choose Your Email Address
            </CardTitle>
            <CardDescription>
              Enter your desired email username and domain
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmitStep1} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="localPart">Username</Label>
                <Input
                  id="localPart"
                  placeholder="john.doe"
                  {...register("localPart")}
                />
                {errors.localPart && (
                  <p className="text-sm text-red-500">
                    {errors.localPart.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">@</span>
                  <Input
                    id="domain"
                    placeholder="yourdomain.com"
                    {...register("domain")}
                  />
                </div>
                {errors.domain && (
                  <p className="text-sm text-red-500">
                    {errors.domain.message}
                  </p>
                )}
              </div>

              {fullEmail && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">
                    Your email will be:
                  </p>
                  <p className="font-medium">{fullEmail}</p>
                </div>
              )}

              <Button type="submit" className="w-full">
                Check Availability
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Checking Availability */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Step 2: Checking Availability
            </CardTitle>
            <CardDescription>
              Verifying <strong>{fullEmail}</strong> is available
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checkAvailability.isPending ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">
                  Checking availability...
                </p>
              </div>
            ) : availability && !availability.available ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                  <Shield className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Not Available</p>
                    <p className="text-sm">
                      {availability.message ||
                        "This email address is already taken."}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep(1);
                    setAvailability(null);
                  }}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Try a Different Address
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm & Create */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Step 3: Confirm & Create
            </CardTitle>
            <CardDescription>
              Review your email account details before creating
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                Available!
              </p>
              <p className="text-lg font-bold text-green-800 dark:text-green-300">
                {fullEmail}
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Email Address</span>
                <span className="font-medium">{fullEmail}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Setup Fee</span>
                <span className="font-medium">$12.00</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Monthly Cost</span>
                <span className="font-medium">$6.00/mo</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Billing Starts</span>
                <span className="font-medium">Today</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setAvailability(null);
                }}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => createAccount.mutate(fullEmail)}
                disabled={createAccount.isPending}
                className="flex-1"
              >
                {createAccount.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Create Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Credentials & DNS */}
      {step === 4 && createdAccount && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Account Created Successfully
              </CardTitle>
              <CardDescription>
                Save your credentials below. The temporary password will not be
                shown again.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
                  Save these credentials now!
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                        {createdAccount.email}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(createdAccount.email)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Temp Password
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                        {createdAccount.tempPassword}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(createdAccount.tempPassword)
                        }
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="h-5 w-5" />
                Mail Client Settings
              </CardTitle>
              <CardDescription>
                Use these settings to configure Outlook, Thunderbird, or any
                email client
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <h4 className="font-medium">Incoming Mail (IMAP)</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Server</span>
                      <code className="font-mono">
                        {createdAccount.imapHost}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Port</span>
                      <code className="font-mono">
                        {createdAccount.imapPort}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Security</span>
                      <code className="font-mono">SSL/TLS</code>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium">Outgoing Mail (SMTP)</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Server</span>
                      <code className="font-mono">
                        {createdAccount.smtpHost}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Port</span>
                      <code className="font-mono">
                        {createdAccount.smtpPort}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Security</span>
                      <code className="font-mono">STARTTLS</code>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {createdAccount.dnsRecords && createdAccount.dnsRecords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  DNS Records
                </CardTitle>
                <CardDescription>
                  Add these DNS records to your domain registrar for email
                  delivery
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-3 pr-4">Type</th>
                        <th className="py-3 pr-4">Name</th>
                        <th className="py-3 pr-4">Value</th>
                        <th className="py-3">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {createdAccount.dnsRecords.map((record, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-3 pr-4 font-mono">
                            {record.type}
                          </td>
                          <td className="py-3 pr-4 font-mono max-w-[150px] truncate">
                            {record.name}
                          </td>
                          <td className="py-3 pr-4 font-mono max-w-[250px] truncate">
                            {record.value}
                          </td>
                          <td className="py-3 font-mono">
                            {record.priority ?? "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Link href="/employee/email" className="flex-1">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to My Accounts
              </Button>
            </Link>
            <Button
              onClick={() => {
                setStep(1);
                setAvailability(null);
                setCreatedAccount(null);
              }}
              className="flex-1"
            >
              <Mail className="h-4 w-4 mr-2" />
              Create Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
