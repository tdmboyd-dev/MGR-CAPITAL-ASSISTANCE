"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
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
import { toast } from "sonner";
import {
  Building2,
  Palette,
  Rocket,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Globe,
  Image,
  Star,
} from "lucide-react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function ChildCompanySetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [created, setCreated] = useState(false);
  const [createdCompany, setCreatedCompany] = useState<any>(null);

  const [formData, setFormData] = useState({
    companyName: "",
    slug: "",
    plan: "WHITE_LABEL" as "BRANDED" | "WHITE_LABEL",
    logoUrl: "",
    primaryColor: "#2563eb",
    secondaryColor: "#1e40af",
    accentColor: "#f59e0b",
  });

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    if (!slugManuallyEdited && formData.companyName) {
      setFormData((prev) => ({
        ...prev,
        slug: slugify(prev.companyName),
      }));
    }
  }, [formData.companyName, slugManuallyEdited]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/child-companies/accept", {
        name: formData.companyName,
        slug: formData.slug,
        plan: formData.plan,
        logoUrl: formData.logoUrl || undefined,
        branding: {
          primaryColor: formData.primaryColor,
          secondaryColor: formData.secondaryColor,
          accentColor: formData.accentColor,
        },
      });
      return data;
    },
    onSuccess: (data) => {
      toast.success("Child company created successfully!");
      setCreatedCompany(data.data || data);
      setCreated(true);
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.error || "Failed to create child company"
      );
    },
  });

  const handleSubmit = () => {
    if (!formData.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!formData.slug.trim()) {
      toast.error("Company slug is required");
      return;
    }
    createMutation.mutate();
  };

  // Success screen
  if (created) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold">Company Created!</h1>
          <p className="text-muted-foreground mt-2">
            Your child company has been set up and is ready to go
          </p>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Your Company Details</CardTitle>
            <CardDescription>
              Review your new child company information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-muted-foreground">Company Name</span>
              <span className="font-medium">{formData.companyName}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-medium">{formData.slug}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">
                {formData.plan === "WHITE_LABEL"
                  ? "White-Label ($600/yr)"
                  : "Branded ($300/yr)"}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-muted-foreground">Brand Colors</span>
              <div className="flex gap-2">
                <div
                  className="w-6 h-6 rounded-full border"
                  style={{ backgroundColor: formData.primaryColor }}
                  title="Primary"
                />
                <div
                  className="w-6 h-6 rounded-full border"
                  style={{ backgroundColor: formData.secondaryColor }}
                  title="Secondary"
                />
                <div
                  className="w-6 h-6 rounded-full border"
                  style={{ backgroundColor: formData.accentColor }}
                  title="Accent"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="max-w-2xl mx-auto border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </div>
              <div>
                <p className="font-medium">Invite Your Team</p>
                <p className="text-sm text-muted-foreground">
                  Add employees to your child company to start handling cases
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </div>
              <div>
                <p className="font-medium">Complete Compliance Setup</p>
                <p className="text-sm text-muted-foreground">
                  Ensure your company meets all regulatory requirements
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </div>
              <div>
                <p className="font-medium">Start Taking Cases</p>
                <p className="text-sm text-muted-foreground">
                  Begin processing cases and earning revenue through the platform
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={() => router.push("/employee/child-company")}
            className="px-8"
          >
            Go to Company Dashboard
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Building2 className="h-8 w-8" />
          Set Up Your Child Company
        </h1>
        <p className="text-muted-foreground">
          Complete the wizard below to create your child company
        </p>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-4">
        {[
          { num: 1, label: "Company Info", icon: Building2 },
          { num: 2, label: "Plan Selection", icon: Star },
          { num: 3, label: "Branding", icon: Palette },
        ].map((s, index) => (
          <div key={s.num} className="flex items-center gap-2">
            {index > 0 && (
              <div
                className={`w-12 h-0.5 ${
                  step >= s.num ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
            <button
              onClick={() => setStep(s.num)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                step === s.num
                  ? "bg-primary text-primary-foreground"
                  : step > s.num
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <s.icon className="h-4 w-4" />
              <span className="text-sm font-medium hidden md:inline">
                {s.label}
              </span>
              <span className="text-sm font-medium md:hidden">{s.num}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Step 1: Company Info */}
      {step === 1 && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>
              Choose your company name and URL slug
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="e.g. Apex Recovery Solutions"
                value={formData.companyName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    companyName: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                This will be your public-facing company name
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                  <Globe className="h-4 w-4" />
                  mgrcapital.com/
                </div>
                <Input
                  id="slug"
                  placeholder="apex-recovery"
                  value={formData.slug}
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    setFormData((prev) => ({
                      ...prev,
                      slug: slugify(e.target.value),
                    }));
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-generated from company name. You can customize it.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!formData.companyName.trim()}>
                Next: Plan Selection
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Plan Selection */}
      {step === 2 && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Your Plan</CardTitle>
              <CardDescription>
                Choose the plan that best fits your needs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label
                className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  formData.plan === "BRANDED"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value="BRANDED"
                  checked={formData.plan === "BRANDED"}
                  onChange={() =>
                    setFormData((prev) => ({ ...prev, plan: "BRANDED" }))
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-lg">Branded Plan</p>
                    <p className="font-bold text-lg">$300/yr</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Operate under MGR Capital branding with up to 5 employees.
                    You keep 70% of revenue after the tiered founder cut.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  formData.plan === "WHITE_LABEL"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value="WHITE_LABEL"
                  checked={formData.plan === "WHITE_LABEL"}
                  onChange={() =>
                    setFormData((prev) => ({ ...prev, plan: "WHITE_LABEL" }))
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-lg">White-Label Plan</p>
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    </div>
                    <p className="font-bold text-lg">$600/yr</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Fully branded as your own company with custom logo, colors,
                    subdomain, and unlimited employees. You keep 85% of revenue
                    after the tiered founder cut.
                  </p>
                </div>
              </label>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={() => setStep(3)}>
              Next: Branding
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Branding */}
      {step === 3 && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Branding</CardTitle>
              <CardDescription>
                Customize your company's visual identity
                {formData.plan === "BRANDED" &&
                  " (limited customization on Branded plan)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="logoUrl"
                    placeholder="https://example.com/logo.png"
                    value={formData.logoUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        logoUrl: e.target.value,
                      }))
                    }
                    disabled={formData.plan === "BRANDED"}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.plan === "BRANDED"
                    ? "Custom logos are available on the White-Label plan"
                    : "Direct link to your company logo (PNG or SVG recommended)"}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="primaryColor"
                      value={formData.primaryColor}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          primaryColor: e.target.value,
                        }))
                      }
                      className="w-10 h-10 rounded cursor-pointer border"
                      disabled={formData.plan === "BRANDED"}
                    />
                    <Input
                      value={formData.primaryColor}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          primaryColor: e.target.value,
                        }))
                      }
                      className="font-mono"
                      disabled={formData.plan === "BRANDED"}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="secondaryColor"
                      value={formData.secondaryColor}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          secondaryColor: e.target.value,
                        }))
                      }
                      className="w-10 h-10 rounded cursor-pointer border"
                      disabled={formData.plan === "BRANDED"}
                    />
                    <Input
                      value={formData.secondaryColor}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          secondaryColor: e.target.value,
                        }))
                      }
                      className="font-mono"
                      disabled={formData.plan === "BRANDED"}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="accentColor"
                      value={formData.accentColor}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          accentColor: e.target.value,
                        }))
                      }
                      className="w-10 h-10 rounded cursor-pointer border"
                      disabled={formData.plan === "BRANDED"}
                    />
                    <Input
                      value={formData.accentColor}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          accentColor: e.target.value,
                        }))
                      }
                      className="font-mono"
                      disabled={formData.plan === "BRANDED"}
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Brand Preview</Label>
                <div
                  className="p-6 rounded-lg border"
                  style={{ backgroundColor: formData.primaryColor + "10" }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: formData.primaryColor }}
                    >
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p
                        className="font-bold text-lg"
                        style={{ color: formData.primaryColor }}
                      >
                        {formData.companyName || "Your Company"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        mgrcapital.com/{formData.slug || "your-company"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div
                      className="px-4 py-2 rounded text-white text-sm font-medium"
                      style={{ backgroundColor: formData.primaryColor }}
                    >
                      Primary
                    </div>
                    <div
                      className="px-4 py-2 rounded text-white text-sm font-medium"
                      style={{ backgroundColor: formData.secondaryColor }}
                    >
                      Secondary
                    </div>
                    <div
                      className="px-4 py-2 rounded text-white text-sm font-medium"
                      style={{ backgroundColor: formData.accentColor }}
                    >
                      Accent
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Review & Create</CardTitle>
              <CardDescription>
                Confirm your company details before creating
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-muted-foreground">Company Name</span>
                <span className="font-medium">{formData.companyName}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-muted-foreground">Slug</span>
                <span className="font-medium">{formData.slug}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">
                  {formData.plan === "WHITE_LABEL"
                    ? "White-Label ($600/yr)"
                    : "Branded ($300/yr)"}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              size="lg"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Create Child Company
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
