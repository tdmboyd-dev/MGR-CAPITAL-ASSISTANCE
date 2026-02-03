"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Settings,
  Building2,
  Palette,
  CreditCard,
  ArrowLeft,
  Save,
  Loader2,
  AlertTriangle,
  Trash2,
  XCircle,
  Star,
  Upload,
  Globe,
  Mail,
  CheckCircle,
  Sparkles,
} from "lucide-react";

// Validation Schemas
const companySettingsSchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  contactEmail: z.string().email("Please enter a valid email address"),
});

const brandingSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Please enter a valid hex color"),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Please enter a valid hex color"),
  logoUrl: z.string().url("Please enter a valid URL").or(z.literal("")),
});

type CompanySettingsFormValues = z.infer<typeof companySettingsSchema>;
type BrandingFormValues = z.infer<typeof brandingSchema>;

export default function ChildCompanySettingsPage() {
  const queryClient = useQueryClient();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Fetch company data
  const { data: companyData, isLoading, error } = useQuery({
    queryKey: ["my-child-company"],
    queryFn: async () => {
      const { data } = await api.get("/child-companies/mine");
      return data;
    },
  });

  const company = companyData?.data;

  // Company Settings Form
  const companyForm = useForm<CompanySettingsFormValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      name: "",
      slug: "",
      contactEmail: "",
    },
    values: company
      ? {
          name: company.name || "",
          slug: company.slug || "",
          contactEmail: company.contactEmail || "",
        }
      : undefined,
  });

  // Branding Form
  const brandingForm = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      primaryColor: "#2563eb",
      secondaryColor: "#1e40af",
      logoUrl: "",
    },
    values: company?.branding
      ? {
          primaryColor: company.branding.primaryColor || "#2563eb",
          secondaryColor: company.branding.secondaryColor || "#1e40af",
          logoUrl: company.logoUrl || "",
        }
      : undefined,
  });

  // Update Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<CompanySettingsFormValues & BrandingFormValues & { branding?: object }>) => {
      const response = await api.patch("/child-companies/mine", data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Settings updated successfully");
      queryClient.invalidateQueries({ queryKey: ["my-child-company"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to update settings");
    },
  });

  // Upgrade Plan Mutation
  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/child-companies/mine/upgrade");
      return response.data;
    },
    onSuccess: () => {
      toast.success("Plan upgraded successfully!");
      queryClient.invalidateQueries({ queryKey: ["my-child-company"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to upgrade plan");
    },
  });

  // Cancel Subscription Mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/child-companies/mine/cancel");
      return response.data;
    },
    onSuccess: () => {
      toast.success("Subscription cancelled");
      setCancelDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-child-company"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to cancel subscription");
    },
  });

  // Delete Company Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete("/child-companies/mine");
      return response.data;
    },
    onSuccess: () => {
      toast.success("Company deleted");
      setDeleteDialogOpen(false);
      // Redirect to main child company page
      window.location.href = "/employee/child-company";
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to delete company");
    },
  });

  // Handle Company Settings Submit
  const onCompanySettingsSubmit = (data: CompanySettingsFormValues) => {
    updateSettingsMutation.mutate(data);
  };

  // Handle Branding Submit
  const onBrandingSubmit = (data: BrandingFormValues) => {
    updateSettingsMutation.mutate({
      logoUrl: data.logoUrl || undefined,
      branding: {
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
      },
    });
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load company settings. Please try again later.
          </AlertDescription>
        </Alert>
        <Link href="/employee/child-company">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  // No Company State
  if (!company) {
    return (
      <div className="space-y-6">
        <Alert>
          <Building2 className="h-4 w-4" />
          <AlertTitle>No Company Found</AlertTitle>
          <AlertDescription>
            You don't have a child company set up yet. Please set up your company first.
          </AlertDescription>
        </Alert>
        <Link href="/employee/child-company">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go to Child Company
          </Button>
        </Link>
      </div>
    );
  }

  const isWhiteLabel = company.plan === "WHITE_LABEL";
  const canEditBranding = isWhiteLabel;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/employee/child-company"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Settings className="h-8 w-8" />
              Company Settings
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 ml-8">
            Manage your child company configuration
          </p>
        </div>
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
      </div>

      {/* Company Details Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Details
          </CardTitle>
          <CardDescription>
            Update your company's basic information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={companyForm.handleSubmit(onCompanySettingsSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Apex Recovery Solutions"
                  {...companyForm.register("name")}
                />
                {companyForm.formState.errors.name && (
                  <p className="text-sm text-red-600">
                    {companyForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Display Slug</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                    <Globe className="h-4 w-4" />
                    mgrcapital.com/
                  </div>
                  <Input
                    id="slug"
                    placeholder="apex-recovery"
                    {...companyForm.register("slug")}
                  />
                </div>
                {companyForm.formState.errors.slug && (
                  <p className="text-sm text-red-600">
                    {companyForm.formState.errors.slug.message}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="contact@yourcompany.com"
                    {...companyForm.register("contactEmail")}
                  />
                </div>
                {companyForm.formState.errors.contactEmail && (
                  <p className="text-sm text-red-600">
                    {companyForm.formState.errors.contactEmail.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={updateSettingsMutation.isPending}>
                {updateSettingsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Branding Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Branding Settings
          </CardTitle>
          <CardDescription>
            Customize your company's visual identity
            {!canEditBranding && " (Upgrade to White-Label to unlock)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={brandingForm.handleSubmit(onBrandingSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="logoUrl"
                    placeholder="https://example.com/logo.png"
                    disabled={!canEditBranding}
                    {...brandingForm.register("logoUrl")}
                  />
                </div>
                {brandingForm.formState.errors.logoUrl && (
                  <p className="text-sm text-red-600">
                    {brandingForm.formState.errors.logoUrl.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {canEditBranding
                    ? "Direct link to your company logo (PNG or SVG recommended)"
                    : "Custom logos are available on the White-Label plan"}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandingForm.watch("primaryColor")}
                      onChange={(e) => brandingForm.setValue("primaryColor", e.target.value)}
                      disabled={!canEditBranding}
                      className="w-10 h-10 rounded cursor-pointer border disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <Input
                      id="primaryColor"
                      disabled={!canEditBranding}
                      className="font-mono"
                      {...brandingForm.register("primaryColor")}
                    />
                  </div>
                  {brandingForm.formState.errors.primaryColor && (
                    <p className="text-sm text-red-600">
                      {brandingForm.formState.errors.primaryColor.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandingForm.watch("secondaryColor")}
                      onChange={(e) => brandingForm.setValue("secondaryColor", e.target.value)}
                      disabled={!canEditBranding}
                      className="w-10 h-10 rounded cursor-pointer border disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <Input
                      id="secondaryColor"
                      disabled={!canEditBranding}
                      className="font-mono"
                      {...brandingForm.register("secondaryColor")}
                    />
                  </div>
                  {brandingForm.formState.errors.secondaryColor && (
                    <p className="text-sm text-red-600">
                      {brandingForm.formState.errors.secondaryColor.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Brand Preview */}
              <div className="space-y-2">
                <Label>Brand Preview</Label>
                <div
                  className="p-6 rounded-lg border"
                  style={{ backgroundColor: brandingForm.watch("primaryColor") + "10" }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: brandingForm.watch("primaryColor") }}
                    >
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p
                        className="font-bold text-lg"
                        style={{ color: brandingForm.watch("primaryColor") }}
                      >
                        {company.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        mgrcapital.com/{company.slug}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div
                      className="px-4 py-2 rounded text-white text-sm font-medium"
                      style={{ backgroundColor: brandingForm.watch("primaryColor") }}
                    >
                      Primary
                    </div>
                    <div
                      className="px-4 py-2 rounded text-white text-sm font-medium"
                      style={{ backgroundColor: brandingForm.watch("secondaryColor") }}
                    >
                      Secondary
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!canEditBranding || updateSettingsMutation.isPending}
              >
                {updateSettingsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Branding
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Plan Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Plan Information
          </CardTitle>
          <CardDescription>
            Your current subscription plan and upgrade options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  isWhiteLabel ? "bg-primary text-primary-foreground" : "bg-blue-500 text-white"
                }`}
              >
                <Star className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-lg">
                  {isWhiteLabel ? "White-Label Plan" : "Branded Plan"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isWhiteLabel
                    ? "Full branding customization, unlimited employees"
                    : "MGR Capital branding, up to 5 employees"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{isWhiteLabel ? "$600" : "$300"}</p>
              <p className="text-sm text-muted-foreground">/year</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              {isWhiteLabel ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              <span className="text-sm">Custom Logo</span>
            </div>
            <div className="flex items-center gap-2">
              {isWhiteLabel ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              <span className="text-sm">Custom Colors</span>
            </div>
            <div className="flex items-center gap-2">
              {isWhiteLabel ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              <span className="text-sm">Unlimited Employees</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">
                {isWhiteLabel ? "85% Revenue Share" : "70% Revenue Share"}
              </span>
            </div>
          </div>

          {!isWhiteLabel && (
            <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Upgrade to White-Label</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Get custom branding, unlimited employees, and keep 85% of revenue.
                    Upgrade for just $300 more per year.
                  </p>
                  <Button
                    className="mt-3"
                    onClick={() => upgradeMutation.mutate()}
                    disabled={upgradeMutation.isPending}
                  >
                    {upgradeMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Upgrading...
                      </>
                    ) : (
                      <>
                        <Star className="h-4 w-4 mr-2" />
                        Upgrade Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Billing Information
          </CardTitle>
          <CardDescription>
            Your billing details and payment information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Current Plan Cost</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(isWhiteLabel ? 60000 : 30000)}
              </p>
              <p className="text-xs text-muted-foreground">/year</p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Next Billing Date</p>
              <p className="text-2xl font-bold mt-1">
                {company.nextBillingDate
                  ? formatDate(company.nextBillingDate)
                  : "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">
                {company.nextBillingDate ? "Annual renewal" : "Not set"}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Payment Method</p>
              <p className="text-lg font-bold mt-1">
                {company.paymentMethod || "Not configured"}
              </p>
              <p className="text-xs text-muted-foreground">
                {company.paymentMethodLast4
                  ? `**** ${company.paymentMethodLast4}`
                  : "Add payment method"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cancel Subscription */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 dark:border-red-800">
            <div>
              <p className="font-medium">Cancel Subscription</p>
              <p className="text-sm text-muted-foreground">
                Your company will remain active until the end of the billing period
              </p>
            </div>
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950">
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Subscription
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Subscription</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to cancel your subscription? Your company will remain
                    active until the end of the current billing period.
                  </DialogDescription>
                </DialogHeader>
                <Alert variant="warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    After cancellation, you will lose access to premium features and your
                    employees will no longer be able to access the platform.
                  </AlertDescription>
                </Alert>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                    Keep Subscription
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      "Yes, Cancel Subscription"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Separator />

          {/* Delete Company */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
            <div>
              <p className="font-medium text-red-600 dark:text-red-400">Delete Company</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your company and all associated data. This cannot be undone.
              </p>
            </div>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Company
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Company</DialogTitle>
                  <DialogDescription>
                    This action is permanent and cannot be undone. All company data,
                    employee records, and case history will be permanently deleted.
                  </DialogDescription>
                </DialogHeader>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>This action is irreversible</AlertTitle>
                  <AlertDescription>
                    You will lose all data associated with this company including:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All employee accounts and data</li>
                      <li>All case records and history</li>
                      <li>All revenue and payout records</li>
                      <li>All branding and configuration</li>
                    </ul>
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="deleteConfirm">
                    Type <span className="font-mono font-bold">{company.name}</span> to confirm
                  </Label>
                  <Input
                    id="deleteConfirm"
                    placeholder="Enter company name"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteDialogOpen(false);
                      setDeleteConfirmText("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate()}
                    disabled={
                      deleteMutation.isPending || deleteConfirmText !== company.name
                    }
                  >
                    {deleteMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete Company Permanently"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
