"use client";
import { apiFailure } from "@/lib/apiFailure";

import { Button } from "@/components/ui/button";
import {
Card,
CardContent,
CardDescription,
CardHeader,
CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs,TabsContent,TabsList,TabsTrigger } from "@/components/ui/tabs";
import { z } from "zod";
import Link from "next/link";
import { api } from "@/lib/api";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import {
Activity,
BookOpen,
Cog,
Database,
RotateCcw,
Save,
Settings,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const DEFAULT_CONFIGS = {
  training: {
    passingScorePercent: 80,
    maxQuizAttempts: 3,
    moduleExpirationDays: 90,
    autoAssignOnHire: true,
    requireQuizForCompletion: true,
    tierProgressionEnabled: true,
  },
  ingestion: {
    autoProcessEnabled: true,
    highValueThresholdCents: 1000000,
    duplicateCheckEnabled: true,
    maxBatchSize: 1000,
    retryFailedRecords: true,
    notifyOnHighValue: true,
  },
  ops: {
    alertEmailEnabled: true,
    alertEmailRecipients: "",
    volatilityThreshold: 70,
    metricsRetentionDays: 365,
    focusFeedMaxItems: 20,
    heatmapRefreshMinutes: 30,
  },
  system: {
    maintenanceMode: false,
    maxFileUploadMB: 50,
    sessionTimeoutMinutes: 60,
    auditLogRetentionDays: 730,
    twoFactorRequired: false,
    passwordMinLength: 12,
  },
};

type ConfigSections = typeof DEFAULT_CONFIGS;
type ConfigKey = keyof ConfigSections;
const configSchema = z.object({
  training: z.object({ passingScorePercent: z.number().int().min(0).max(100), maxQuizAttempts: z.number().int().min(1).max(10), moduleExpirationDays: z.number().int().nonnegative(), autoAssignOnHire: z.boolean(), requireQuizForCompletion: z.boolean(), tierProgressionEnabled: z.boolean() }),
  ingestion: z.object({ autoProcessEnabled: z.boolean(), highValueThresholdCents: z.number().int().nonnegative(), duplicateCheckEnabled: z.boolean(), maxBatchSize: z.number().int().min(100).max(10000), retryFailedRecords: z.boolean(), notifyOnHighValue: z.boolean() }),
  ops: z.object({ alertEmailEnabled: z.boolean(), alertEmailRecipients: z.string(), volatilityThreshold: z.number().min(0).max(100), metricsRetentionDays: z.number().int().min(30), focusFeedMaxItems: z.number().int().min(5).max(100), heatmapRefreshMinutes: z.number().int().min(5).max(120) }),
  system: z.object({ maintenanceMode: z.boolean(), maxFileUploadMB: z.number().int().min(1).max(500), sessionTimeoutMinutes: z.number().int().min(5).max(480), auditLogRetentionDays: z.number().int().min(90), twoFactorRequired: z.boolean(), passwordMinLength: z.number().int().min(8).max(32) }),
});

export default function FounderConfigPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("training");
  const [formData, setFormData] = useState<Partial<ConfigSections>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["founder-config"],
    queryFn: async ({ signal }) => {
      const response = await api.get<unknown>('/settings/founder-config', { signal });
      return z.object({ success: z.literal(true), data: configSchema.partial() }).parse(response.data).data;
    }, retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: ConfigKey; value: ConfigSections[ConfigKey] }) => {
      const validated = configSchema.shape[key].parse(value);
      const { data } = await api.patch<unknown>(`/settings/founder-config/${key}`, { value: validated });
      return z.object({ success: z.literal(true) }).parse(data);
    },
    onSuccess: () => {
      toast.success("Configuration saved successfully");
      queryClient.invalidateQueries({ queryKey: ["founder-config"] });
    },
    onError: (errorUnknown: unknown) => {
      const error = apiFailure(errorUnknown);
      toast.error(error.response?.data?.error || "Failed to save configuration");
    },
  });

  const getConfig = <S extends ConfigKey>(section: S): ConfigSections[S] => ({ ...DEFAULT_CONFIGS[section], ...data?.[section], ...formData[section] });
  const updateConfig = <S extends ConfigKey, F extends keyof ConfigSections[S]>(section: S, field: F, value: ConfigSections[S][F]) => {
    setFormData(previous => ({ ...previous, [section]: { ...getConfig(section), [field]: value } }));
  };

  const handleSave = (section: ConfigKey) => {
    const config = getConfig(section);
    saveMutation.mutate({ key: section, value: config });
  };

  const handleReset = (section: ConfigKey) => {
    setFormData((prev) => {
      const newData = { ...prev };
      delete newData[section];
      return newData;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) return <div role="alert" className="space-y-4 p-6"><h1 className="text-2xl font-bold">Operational configuration is unavailable</h1><p>This screen&apos;s configuration API has not been qualified. Defaults are not proof that security or automation settings are enforced. No configuration was saved.</p><Link href="/founder/command-center" className="underline">Open saved feature settings in Command Center</Link></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="h-8 w-8" />
          System Configuration
        </h1>
        <p className="text-muted-foreground">
          Manage platform settings and operational parameters
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="training" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Training
          </TabsTrigger>
          <TabsTrigger value="ingestion" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Ingestion
          </TabsTrigger>
          <TabsTrigger value="ops" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Ops
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Cog className="h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        {/* Training Config */}
        <TabsContent value="training">
          <Card>
            <CardHeader>
              <CardTitle>Training Configuration</CardTitle>
              <CardDescription>
                Configure training module settings, quiz requirements, and tier progression
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="passingScore">Passing Score (%)</Label>
                  <Input
                    id="passingScore"
                    type="number"
                    min="0"
                    max="100"
                    value={getConfig("training").passingScorePercent}
                    onChange={(e) =>
                      updateConfig("training", "passingScorePercent", parseInt(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum score required to pass quizzes
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxAttempts">Max Quiz Attempts</Label>
                  <Input
                    id="maxAttempts"
                    type="number"
                    min="1"
                    max="10"
                    value={getConfig("training").maxQuizAttempts}
                    onChange={(e) =>
                      updateConfig("training", "maxQuizAttempts", parseInt(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum attempts before lockout
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiration">Module Expiration (days)</Label>
                  <Input
                    id="expiration"
                    type="number"
                    min="0"
                    value={getConfig("training").moduleExpirationDays}
                    onChange={(e) =>
                      updateConfig("training", "moduleExpirationDays", parseInt(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Days until completion expires (0 = never)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={getConfig("training").autoAssignOnHire}
                      onChange={(e) =>
                        updateConfig("training", "autoAssignOnHire", e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    Auto-assign on hire
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically assign required modules to new employees
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={getConfig("training").tierProgressionEnabled}
                      onChange={(e) =>
                        updateConfig("training", "tierProgressionEnabled", e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    Enable tier progression
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Allow automatic tier advancement based on training
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => handleReset("training")}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button onClick={() => handleSave("training")} disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ingestion Config */}
        <TabsContent value="ingestion">
          <Card>
            <CardHeader>
              <CardTitle>Ingestion Configuration</CardTitle>
              <CardDescription>
                Configure data ingestion settings, thresholds, and processing rules
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="highValue">High Value Threshold ($)</Label>
                  <Input
                    id="highValue"
                    type="number"
                    min="0"
                    value={(getConfig("ingestion").highValueThresholdCents / 100).toFixed(0)}
                    onChange={(e) =>
                      updateConfig("ingestion", "highValueThresholdCents", parseInt(e.target.value) * 100)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Records above this value are flagged as high priority
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batchSize">Max Batch Size</Label>
                  <Input
                    id="batchSize"
                    type="number"
                    min="100"
                    max="10000"
                    value={getConfig("ingestion").maxBatchSize}
                    onChange={(e) =>
                      updateConfig("ingestion", "maxBatchSize", parseInt(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum records per ingestion batch
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={getConfig("ingestion").autoProcessEnabled}
                      onChange={(e) =>
                        updateConfig("ingestion", "autoProcessEnabled", e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    Auto-process enabled
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically process ingested records
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={getConfig("ingestion").duplicateCheckEnabled}
                      onChange={(e) =>
                        updateConfig("ingestion", "duplicateCheckEnabled", e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    Duplicate detection
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Check for duplicate records before importing
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={getConfig("ingestion").notifyOnHighValue}
                      onChange={(e) =>
                        updateConfig("ingestion", "notifyOnHighValue", e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    Notify on high value
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Send alerts when high-value records are detected
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => handleReset("ingestion")}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button onClick={() => handleSave("ingestion")} disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ops Config */}
        <TabsContent value="ops">
          <Card>
            <CardHeader>
              <CardTitle>Operations Configuration</CardTitle>
              <CardDescription>
                Configure alerts, metrics, and operational thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="volatility">Volatility Threshold</Label>
                  <Input
                    id="volatility"
                    type="number"
                    min="0"
                    max="100"
                    value={getConfig("ops").volatilityThreshold}
                    onChange={(e) =>
                      updateConfig("ops", "volatilityThreshold", parseInt(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Alert when jurisdiction volatility exceeds this score
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retention">Metrics Retention (days)</Label>
                  <Input
                    id="retention"
                    type="number"
                    min="30"
                    value={getConfig("ops").metricsRetentionDays}
                    onChange={(e) =>
                      updateConfig("ops", "metricsRetentionDays", parseInt(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Days to retain metrics data
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="focusFeed">Focus Feed Max Items</Label>
                  <Input
                    id="focusFeed"
                    type="number"
                    min="5"
                    max="100"
                    value={getConfig("ops").focusFeedMaxItems}
                    onChange={(e) =>
                      updateConfig("ops", "focusFeedMaxItems", parseInt(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum items in the focus feed
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heatmap">Heatmap Refresh (minutes)</Label>
                  <Input
                    id="heatmap"
                    type="number"
                    min="5"
                    max="120"
                    value={getConfig("ops").heatmapRefreshMinutes}
                    onChange={(e) =>
                      updateConfig("ops", "heatmapRefreshMinutes", parseInt(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    How often to refresh the case heatmap
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={getConfig("ops").alertEmailEnabled}
                      onChange={(e) =>
                        updateConfig("ops", "alertEmailEnabled", e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    Email alerts enabled
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Send email notifications for critical alerts
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipients">Alert Recipients</Label>
                  <Input
                    id="recipients"
                    type="text"
                    placeholder="email@example.com"
                    value={getConfig("ops").alertEmailRecipients}
                    onChange={(e) =>
                      updateConfig("ops", "alertEmailRecipients", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated email addresses
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => handleReset("ops")}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button onClick={() => handleSave("ops")} disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Config */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                Configure system-wide settings and security parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="maxUpload">Max File Upload (MB)</Label>
                  <Input
                    id="maxUpload"
                    type="number"
                    min="1"
                    max="500"
                    value={getConfig("system").maxFileUploadMB}
                    onChange={(e) =>
                      updateConfig("system", "maxFileUploadMB", parseInt(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum file upload size
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Session Timeout (minutes)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min="5"
                    max="480"
                    value={getConfig("system").sessionTimeoutMinutes}
                    onChange={(e) =>
                      updateConfig("system", "sessionTimeoutMinutes", parseInt(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Inactive session timeout
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="audit">Audit Log Retention (days)</Label>
                  <Input
                    id="audit"
                    type="number"
                    min="90"
                    value={getConfig("system").auditLogRetentionDays}
                    onChange={(e) =>
                      updateConfig("system", "auditLogRetentionDays", parseInt(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Days to retain audit logs
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password Min Length</Label>
                  <Input
                    id="password"
                    type="number"
                    min="8"
                    max="32"
                    value={getConfig("system").passwordMinLength}
                    onChange={(e) =>
                      updateConfig("system", "passwordMinLength", parseInt(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum password length
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={getConfig("system").maintenanceMode}
                      onChange={(e) =>
                        updateConfig("system", "maintenanceMode", e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    Maintenance mode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Disable access for non-founders
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={getConfig("system").twoFactorRequired}
                      onChange={(e) =>
                        updateConfig("system", "twoFactorRequired", e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    Require 2FA
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Require two-factor authentication for all users
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => handleReset("system")}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button onClick={() => handleSave("system")} disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
