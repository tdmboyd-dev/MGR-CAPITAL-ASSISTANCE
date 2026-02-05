"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
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
import { formatCurrency } from "@/lib/utils";
import {
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Star,
  Users,
  DollarSign,
  FileText,
  Sparkles,
  Lock,
  TrendingUp,
} from "lucide-react";

export default function ChildCompanyPage() {
  const { user } = useAuth();

  const { data: eligibility, isLoading } = useQuery({
    queryKey: ["child-company-eligibility"],
    queryFn: async () => {
      const { data } = await api.get("/child-companies/eligibility");
      return data;
    },
  });

  const { data: myCompany } = useQuery({
    queryKey: ["my-child-company"],
    queryFn: async () => {
      const { data } = await api.get("/child-companies/mine");
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Already has a company - show dashboard
  if (myCompany?.data) {
    const company = myCompany.data;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Building2 className="h-8 w-8" />
            {company.name}
          </h1>
          <p className="text-muted-foreground">
            Your child company dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Status
              </CardTitle>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <Badge
                className={
                  company.status === "ACTIVE"
                    ? "bg-green-500 text-white"
                    : company.status === "PENDING"
                    ? "bg-yellow-500 text-white"
                    : "bg-gray-500 text-white"
                }
              >
                {company.status}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Plan
              </CardTitle>
              <Star className="h-5 w-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">
                {company.plan === "WHITE_LABEL" ? "White-Label" : "Branded"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Employees
              </CardTitle>
              <Users className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{company.employeeCount || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Revenue
              </CardTitle>
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(company.totalRevenueCents || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Details</CardTitle>
              <CardDescription>Your child company configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-muted-foreground">Slug</span>
                <span className="font-medium">{company.slug}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">
                  {company.plan === "WHITE_LABEL" ? "White-Label ($600/yr)" : "Branded ($300/yr)"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">
                  {new Date(company.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-muted-foreground">Your Revenue Share</span>
                <span className="font-medium text-green-600">
                  {company.plan === "WHITE_LABEL" ? "85%" : "70%"} after founder cut
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Manage your child company</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3">
                <Link
                  href="/employee/child-company/cases"
                  className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <span>View Cases</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/employee/child-company/employees"
                  className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-purple-500" />
                    <span>Manage Team</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/employee/child-company/payouts"
                  className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                    <span>Revenue & Payouts</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/employee/child-company/settings"
                  className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-yellow-500" />
                    <span>Company Settings</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isEligible = eligibility?.eligible === true;
  const requirements = eligibility?.requirements || [];
  const progress = eligibility?.progress || {};

  // Eligible - show the offer
  if (isEligible) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-yellow-500" />
            Child Company Offer
          </h1>
          <p className="text-muted-foreground">
            Congratulations, {user?.name || "Employee"}! You are eligible to launch your own child company.
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>
              Run your own company under the MGR Capital umbrella with full operational support
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Your Own Brand</p>
                <p className="text-sm text-muted-foreground">
                  Operate under your company name with your branding and team
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Full Platform Access</p>
                <p className="text-sm text-muted-foreground">
                  Access to cases, training, compliance tools, and the complete MGR system
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Revenue Share Partnership</p>
                <p className="text-sm text-muted-foreground">
                  Small platform fee supports infrastructure; you keep the majority of revenue
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Branded Plan</CardTitle>
              <CardDescription>Operate with MGR Capital branding</CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">$300</span>
                <span className="text-muted-foreground">/year</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Full platform access</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Case management tools</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Training & compliance</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Up to 5 employees</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-sm text-muted-foreground">No custom branding</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-sm text-muted-foreground">No custom domain</span>
              </div>
              <div className="pt-4 border-t text-center">
                <p className="text-sm text-muted-foreground">Revenue share</p>
                <p className="text-lg font-bold text-green-600">You keep 70%</p>
                <p className="text-xs text-muted-foreground">after tiered founder cut</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground px-3">
                Recommended
              </Badge>
            </div>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">White-Label Plan</CardTitle>
              <CardDescription>Fully branded as your own company</CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">$600</span>
                <span className="text-muted-foreground">/year</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Everything in Branded</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Custom logo & colors</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Custom subdomain</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Unlimited employees</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">White-label client portal</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Priority support</span>
              </div>
              <div className="pt-4 border-t text-center">
                <p className="text-sm text-muted-foreground">Revenue share</p>
                <p className="text-lg font-bold text-green-600">You keep 85%</p>
                <p className="text-xs text-muted-foreground">after tiered founder cut</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center">
          <Link href="/employee/child-company/setup">
            <Button size="lg" className="px-8">
              <Building2 className="h-5 w-5 mr-2" />
              Accept Offer & Set Up Company
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Not eligible - show requirements and progress
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Building2 className="h-8 w-8" />
          Child Company Program
        </h1>
        <p className="text-muted-foreground">
          Meet the requirements below to unlock the ability to launch your own child company
        </p>
      </div>

      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-yellow-500" />
            Not Yet Eligible
          </CardTitle>
          <CardDescription>
            Complete the requirements below to qualify for a child company offer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {requirements.map((req: any, index: number) => (
              <div
                key={index}
                className="flex items-start gap-3 p-4 rounded-lg bg-background"
              >
                {req.met ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <Clock className="h-5 w-5 text-yellow-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{req.label}</p>
                  <p className="text-sm text-muted-foreground">{req.description}</p>
                  {req.current !== undefined && req.target !== undefined && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>
                          {req.current} / {req.target}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            req.met ? "bg-green-500" : "bg-yellow-500"
                          }`}
                          style={{
                            width: `${Math.min(100, (req.current / req.target) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {requirements.length === 0 && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-background">
                  <Clock className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Minimum Cases Closed</p>
                    <p className="text-sm text-muted-foreground">
                      Close at least 20 cases successfully
                    </p>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{progress.casesClosed || 0} / 20</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-yellow-500 transition-all"
                          style={{
                            width: `${Math.min(100, ((progress.casesClosed || 0) / 20) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-background">
                  <Clock className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Training Completion</p>
                    <p className="text-sm text-muted-foreground">
                      Complete all required training modules
                    </p>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>
                          {progress.trainingComplete || 0} / {progress.trainingTotal || 10}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-yellow-500 transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              ((progress.trainingComplete || 0) /
                                (progress.trainingTotal || 10)) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-background">
                  <Clock className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Tenure Requirement</p>
                    <p className="text-sm text-muted-foreground">
                      Be an active employee for at least 6 months
                    </p>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{progress.monthsActive || 0} / 6 months</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-yellow-500 transition-all"
                          style={{
                            width: `${Math.min(100, ((progress.monthsActive || 0) / 6) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
