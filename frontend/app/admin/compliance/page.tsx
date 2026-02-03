"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Users,
  DollarSign,
  Clock,
  Flag,
} from "lucide-react";
import { toast } from "sonner";

interface ComplianceDashboard {
  auditStats: {
    totalLogs: number;
    recentLogs: number;
    failedLogins: number;
    sensitiveAccess: number;
    documentAccess: number;
    flaggedActivities: number;
  };
  caseCompliance: {
    total: number;
    pendingReview: number;
    overdueDocuments: number;
    completed: number;
    complianceRate: number;
  };
  payoutCompliance: {
    total: number;
    pending: number;
    reviewRequired: number;
  };
  trainingCompliance: {
    totalEmployees: number;
    compliant: number;
    overdue: number;
    complianceRate: number;
  };
}

interface CaseComplianceRecord {
  id: string;
  internalId: string;
  clientName: string;
  status: string;
  assigneeName: string;
  documentsCount: number;
  daysSinceUpdate: number;
  complianceFlags: string[];
  isCompliant: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmployeeComplianceRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  tier: string;
  isActive: boolean;
  casesAssigned: number;
  activeCases: number;
  trainingCompleted: number;
  trainingTotal: number;
  overdueTrainingCount: number;
  overdueModules: string[];
  complianceFlags: string[];
  isCompliant: boolean;
}

interface RiskAssessment {
  overallRisk: number;
  riskLevel: string;
  categories: {
    security: { score: number; factors: { failedLogins: number } };
    financial: { score: number; factors: { highValuePayouts: number } };
    operational: { score: number; factors: { staleCases: number } };
    training: { score: number; factors: { overdueTraining: number } };
    documentation: { score: number; factors: { unverifiedDocs: number } };
  };
  recommendations: string[];
  assessedAt: string;
}

export default function AdminCompliancePage() {
  const [caseFilter, setCaseFilter] = useState<string>("all");

  // Fetch compliance dashboard
  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<ComplianceDashboard>({
    queryKey: ["compliance-dashboard"],
    queryFn: async () => {
      const { data } = await api.get("/compliance/dashboard");
      return data.data;
    },
  });

  // Fetch case compliance
  const { data: casesData, isLoading: casesLoading } = useQuery<{ cases: CaseComplianceRecord[]; summary: any }>({
    queryKey: ["compliance-cases"],
    queryFn: async () => {
      const { data } = await api.get("/compliance/cases");
      return data.data;
    },
  });

  // Fetch employee compliance
  const { data: employeesData, isLoading: employeesLoading } = useQuery<{ employees: EmployeeComplianceRecord[]; summary: any }>({
    queryKey: ["compliance-employees"],
    queryFn: async () => {
      const { data } = await api.get("/compliance/employees");
      return data.data;
    },
  });

  // Fetch risk assessment
  const { data: riskData, isLoading: riskLoading } = useQuery<RiskAssessment>({
    queryKey: ["compliance-risk"],
    queryFn: async () => {
      const { data } = await api.get("/compliance/risk-assessment");
      return data.data;
    },
  });

  // Flag mutation
  const flagMutation = useMutation({
    mutationFn: async (params: { resourceType: string; resourceId: string; reason: string; severity: string }) => {
      await api.post("/compliance/flag", params);
    },
    onSuccess: () => {
      toast.success("Item flagged for review");
      refetchDashboard();
    },
    onError: () => {
      toast.error("Failed to flag item");
    },
  });

  const cases = casesData?.cases || [];
  const filteredCases = caseFilter === "all"
    ? cases
    : caseFilter === "compliant"
    ? cases.filter((c) => c.isCompliant)
    : cases.filter((c) => !c.isCompliant);

  const getRiskColor = (score: number) => {
    if (score >= 70) return "text-red-500";
    if (score >= 40) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Shield className="h-7 w-7 md:h-8 md:w-8" />
            Compliance Overview
          </h1>
          <p className="text-muted-foreground">
            Monitor compliance across cases, employees, and operations
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchDashboard()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Dashboard Stats */}
      {dashboardLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : dashboard ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboard.auditStats.totalLogs}</p>
                  <p className="text-xs text-muted-foreground">Audit Logs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                {dashboard.caseCompliance.complianceRate >= 80 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                <div>
                  <p className="text-2xl font-bold">{dashboard.caseCompliance.complianceRate}%</p>
                  <p className="text-xs text-muted-foreground">Case Compliance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                {dashboard.trainingCompliance.complianceRate >= 80 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                <div>
                  <p className="text-2xl font-bold">{dashboard.trainingCompliance.complianceRate}%</p>
                  <p className="text-xs text-muted-foreground">Training Compliance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboard.payoutCompliance.reviewRequired}</p>
                  <p className="text-xs text-muted-foreground">Pending Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Risk Assessment Card */}
      {!riskLoading && riskData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${getRiskColor(riskData.overallRisk)}`} />
              Risk Assessment
            </CardTitle>
            <CardDescription>
              Overall risk level: <span className={`font-bold ${getRiskColor(riskData.overallRisk)}`}>{riskData.riskLevel}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              {Object.entries(riskData.categories).map(([key, value]) => (
                <div key={key} className="text-center">
                  <p className="text-sm text-muted-foreground capitalize">{key}</p>
                  <p className={`text-2xl font-bold ${getRiskColor(value.score)}`}>{value.score}</p>
                </div>
              ))}
            </div>
            {riskData.recommendations.length > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Recommendations:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {riskData.recommendations.map((rec, idx) => (
                    <li key={idx}>- {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="cases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
        </TabsList>

        {/* Cases Tab */}
        <TabsContent value="cases">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Case Compliance</CardTitle>
                  <CardDescription>Monitor case status and compliance flags</CardDescription>
                </div>
                <Select value={caseFilter} onValueChange={setCaseFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cases</SelectItem>
                    <SelectItem value="compliant">Compliant</SelectItem>
                    <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {casesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Case ID</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Docs</TableHead>
                        <TableHead>Days Since Update</TableHead>
                        <TableHead>Flags</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCases.map((caseRecord) => (
                        <TableRow key={caseRecord.id}>
                          <TableCell className="font-medium">{caseRecord.internalId}</TableCell>
                          <TableCell>{caseRecord.clientName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{caseRecord.status}</Badge>
                          </TableCell>
                          <TableCell>{caseRecord.assigneeName}</TableCell>
                          <TableCell>{caseRecord.documentsCount}</TableCell>
                          <TableCell>
                            <Badge variant={caseRecord.daysSinceUpdate > 7 ? "destructive" : "secondary"}>
                              {caseRecord.daysSinceUpdate} days
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {caseRecord.complianceFlags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {caseRecord.complianceFlags.map((flag) => (
                                  <Badge key={flag} variant="destructive" className="text-xs">
                                    {flag.replace(/_/g, " ")}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </TableCell>
                          <TableCell>
                            {!caseRecord.isCompliant && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  flagMutation.mutate({
                                    resourceType: "CASE",
                                    resourceId: caseRecord.id,
                                    reason: "Non-compliant case flagged for review",
                                    severity: "MEDIUM",
                                  })
                                }
                                disabled={flagMutation.isPending}
                              >
                                <Flag className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle>Employee Compliance</CardTitle>
              <CardDescription>Monitor employee training and performance compliance</CardDescription>
            </CardHeader>
            <CardContent>
              {employeesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Active Cases</TableHead>
                        <TableHead>Training</TableHead>
                        <TableHead>Overdue</TableHead>
                        <TableHead>Flags</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(employeesData?.employees || []).map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">{emp.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{emp.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{emp.tier}</Badge>
                          </TableCell>
                          <TableCell>{emp.activeCases}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{
                                    width: `${
                                      emp.trainingTotal > 0
                                        ? (emp.trainingCompleted / emp.trainingTotal) * 100
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs">
                                {emp.trainingCompleted}/{emp.trainingTotal}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {emp.overdueTrainingCount > 0 ? (
                              <Badge variant="destructive">{emp.overdueTrainingCount}</Badge>
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </TableCell>
                          <TableCell>
                            {emp.complianceFlags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {emp.complianceFlags.map((flag) => (
                                  <Badge key={flag} variant="destructive" className="text-xs">
                                    {flag.replace(/_/g, " ")}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
