"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Briefcase,
  GraduationCap,
  TrendingUp,
  Search,
  RefreshCw,
  Mail,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface HRDashboard {
  totalEmployees: number;
  activeEmployees: number;
  pendingOnboarding: number;
  suspendedEmployees: number;
  tierDistribution: Record<string, number>;
  roleDistribution: Record<string, number>;
  avgTrainingCompletion: number;
  overdueTrainingCount: number;
  newHiresThisMonth: number;
  terminationsThisMonth: number;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  tier: string;
  status: string;
  hireDate: string;
  teamLeadId?: string;
  teamLeadName?: string;
  casesHandled: number;
  trainingProgress: number;
  lastActive: string;
}

interface OnboardingCandidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  appliedDate: string;
  status: string;
  backgroundCheckStatus: string;
  documentsSubmitted: boolean;
  interviewScore?: number;
  notes?: string;
}

interface PerformanceMetric {
  employeeId: string;
  employeeName: string;
  tier: string;
  casesThisMonth: number;
  casesLastMonth: number;
  successRate: number;
  avgResponseTime: number;
  clientSatisfaction: number;
  tierProgressPercent: number;
  flags: string[];
}

interface TrainingCompliance {
  employeeId: string;
  employeeName: string;
  role: string;
  tier: string;
  totalModules: number;
  completedModules: number;
  overdueModules: number;
  certifications: string[];
  lastTrainingDate?: string;
  nextDeadline?: string;
}

interface Team {
  teamLeadId: string;
  teamLeadName: string;
  memberCount: number;
  avgPerformance: number;
  activeCase: number;
  pendingTraining: number;
}

const TIER_LABELS: Record<string, string> = {
  TIER_1_ASSOCIATE: "Tier 1 - Associate",
  TIER_2_SPECIALIST: "Tier 2 - Specialist",
  TIER_3_SENIOR_SPECIALIST: "Tier 3 - Senior Specialist",
  TIER_4_TEAM_LEADER: "Tier 4 - Team Leader",
  TIER_5_EXECUTIVE_PARTNER: "Tier 5 - Executive Partner",
};

const TIER_COLORS: Record<string, string> = {
  TIER_1_ASSOCIATE: "bg-gray-500",
  TIER_2_SPECIALIST: "bg-blue-500",
  TIER_3_SENIOR_SPECIALIST: "bg-green-500",
  TIER_4_TEAM_LEADER: "bg-purple-500",
  TIER_5_EXECUTIVE_PARTNER: "bg-yellow-500",
};

export default function FounderHRPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [newCandidateOpen, setNewCandidateOpen] = useState(false);
  const [newCandidate, setNewCandidate] = useState({ name: "", email: "", phone: "" });

  // Fetch HR dashboard
  const { data: dashboard, isLoading: dashboardLoading } = useQuery<HRDashboard>({
    queryKey: ["hr-dashboard"],
    queryFn: async () => {
      const { data } = await api.get("/hr/dashboard");
      return data.data;
    },
  });

  // Fetch employees
  const { data: employeesData, isLoading: employeesLoading } = useQuery<{ employees: Employee[] }>({
    queryKey: ["hr-employees"],
    queryFn: async () => {
      const { data } = await api.get("/hr/employees");
      return data.data;
    },
  });

  // Fetch onboarding candidates
  const { data: onboardingData, isLoading: onboardingLoading } = useQuery<{ candidates: OnboardingCandidate[] }>({
    queryKey: ["hr-onboarding"],
    queryFn: async () => {
      const { data } = await api.get("/hr/onboarding");
      return data.data;
    },
  });

  // Fetch performance metrics
  const { data: performanceData, isLoading: performanceLoading } = useQuery<{ metrics: PerformanceMetric[] }>({
    queryKey: ["hr-performance"],
    queryFn: async () => {
      const { data } = await api.get("/hr/performance");
      return data.data;
    },
  });

  // Fetch training compliance
  const { data: trainingData, isLoading: trainingLoading } = useQuery<{ compliance: TrainingCompliance[] }>({
    queryKey: ["hr-training-compliance"],
    queryFn: async () => {
      const { data } = await api.get("/hr/training-compliance");
      return data.data;
    },
  });

  // Fetch teams
  const { data: teamsData, isLoading: teamsLoading } = useQuery<{ teams: Team[] }>({
    queryKey: ["hr-teams"],
    queryFn: async () => {
      const { data } = await api.get("/hr/teams");
      return data.data;
    },
  });

  // Update employee status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/hr/employees/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] });
      toast.success("Employee status updated");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  // Update employee tier mutation
  const updateTierMutation = useMutation({
    mutationFn: async ({ id, tier }: { id: string; tier: string }) => {
      await api.patch(`/hr/employees/${id}/tier`, { tier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      toast.success("Employee tier updated");
    },
    onError: () => {
      toast.error("Failed to update tier");
    },
  });

  // Add onboarding candidate mutation
  const addCandidateMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; phone: string }) => {
      await api.post("/hr/onboarding", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-onboarding"] });
      setNewCandidateOpen(false);
      setNewCandidate({ name: "", email: "", phone: "" });
      toast.success("Candidate added");
    },
    onError: () => {
      toast.error("Failed to add candidate");
    },
  });

  // Approve onboarding mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/hr/onboarding/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      queryClient.invalidateQueries({ queryKey: ["hr-dashboard"] });
      toast.success("Candidate approved");
    },
    onError: () => {
      toast.error("Failed to approve candidate");
    },
  });

  // Reject onboarding mutation
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/hr/onboarding/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-onboarding"] });
      toast.success("Candidate rejected");
    },
    onError: () => {
      toast.error("Failed to reject candidate");
    },
  });

  // Send training reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      await api.post(`/hr/training/remind/${employeeId}`);
    },
    onSuccess: () => {
      toast.success("Reminder sent");
    },
    onError: () => {
      toast.error("Failed to send reminder");
    },
  });

  const employees = employeesData?.employees || [];
  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Users className="h-7 w-7 md:h-8 md:w-8" />
            Human Resources
          </h1>
          <p className="text-muted-foreground">
            Manage employees, onboarding, performance, and training compliance
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
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
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboard.totalEmployees}</p>
                  <p className="text-xs text-muted-foreground">Total Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboard.activeEmployees}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboard.pendingOnboarding}</p>
                  <p className="text-xs text-muted-foreground">Pending Onboarding</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboard.avgTrainingCompletion}%</p>
                  <p className="text-xs text-muted-foreground">Avg Training</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Employees</CardTitle>
                  <CardDescription>View and manage employee records</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
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
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cases</TableHead>
                        <TableHead>Training</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">{emp.name}</TableCell>
                          <TableCell>{emp.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{emp.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={emp.tier}
                              onValueChange={(tier) =>
                                updateTierMutation.mutate({ id: emp.id, tier })
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(TIER_LABELS).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={emp.status === "ACTIVE" ? "default" : "secondary"}
                            >
                              {emp.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{emp.casesHandled}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{ width: `${emp.trainingProgress}%` }}
                                />
                              </div>
                              <span className="text-xs">{emp.trainingProgress}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {emp.status === "ACTIVE" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: emp.id,
                                      status: "INACTIVE",
                                    })
                                  }
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      id: emp.id,
                                      status: "ACTIVE",
                                    })
                                  }
                                >
                                  <UserCheck className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
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

        {/* Onboarding Tab */}
        <TabsContent value="onboarding">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Onboarding Candidates</CardTitle>
                  <CardDescription>Manage new hire onboarding process</CardDescription>
                </div>
                <Dialog open={newCandidateOpen} onOpenChange={setNewCandidateOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Candidate
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Candidate</DialogTitle>
                      <DialogDescription>
                        Enter details for the new onboarding candidate
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={newCandidate.name}
                          onChange={(e) =>
                            setNewCandidate({ ...newCandidate, name: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newCandidate.email}
                          onChange={(e) =>
                            setNewCandidate({ ...newCandidate, email: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={newCandidate.phone}
                          onChange={(e) =>
                            setNewCandidate({ ...newCandidate, phone: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setNewCandidateOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => addCandidateMutation.mutate(newCandidate)}
                        disabled={
                          addCandidateMutation.isPending ||
                          !newCandidate.name ||
                          !newCandidate.email
                        }
                      >
                        Add Candidate
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {onboardingLoading ? (
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
                        <TableHead>Email</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Background</TableHead>
                        <TableHead>Interview</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(onboardingData?.candidates || []).map((candidate) => (
                        <TableRow key={candidate.id}>
                          <TableCell className="font-medium">{candidate.name}</TableCell>
                          <TableCell>{candidate.email}</TableCell>
                          <TableCell>
                            {new Date(candidate.appliedDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                candidate.status === "APPROVED"
                                  ? "default"
                                  : candidate.status === "PENDING"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {candidate.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                candidate.backgroundCheckStatus === "PASSED"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {candidate.backgroundCheckStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>{candidate.interviewScore || "N/A"}</TableCell>
                          <TableCell>
                            {candidate.status === "PENDING" && (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600"
                                  onClick={() => approveMutation.mutate(candidate.id)}
                                  disabled={approveMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600"
                                  onClick={() => rejectMutation.mutate(candidate.id)}
                                  disabled={rejectMutation.isPending}
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              </div>
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

        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Track employee performance and tier progress</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceLoading ? (
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
                        <TableHead>Employee</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>This Month</TableHead>
                        <TableHead>Last Month</TableHead>
                        <TableHead>Trend</TableHead>
                        <TableHead>Success Rate</TableHead>
                        <TableHead>Tier Progress</TableHead>
                        <TableHead>Flags</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(performanceData?.metrics || []).map((metric) => (
                        <TableRow key={metric.employeeId}>
                          <TableCell className="font-medium">
                            {metric.employeeName}
                          </TableCell>
                          <TableCell>
                            <Badge className={TIER_COLORS[metric.tier] || "bg-gray-500"}>
                              {TIER_LABELS[metric.tier] || metric.tier}
                            </Badge>
                          </TableCell>
                          <TableCell>{metric.casesThisMonth}</TableCell>
                          <TableCell>{metric.casesLastMonth}</TableCell>
                          <TableCell>
                            {metric.casesThisMonth > metric.casesLastMonth ? (
                              <ChevronUp className="h-4 w-4 text-green-500" />
                            ) : metric.casesThisMonth < metric.casesLastMonth ? (
                              <ChevronDown className="h-4 w-4 text-red-500" />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                metric.successRate >= 70
                                  ? "default"
                                  : metric.successRate >= 50
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {metric.successRate}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{ width: `${metric.tierProgressPercent}%` }}
                                />
                              </div>
                              <span className="text-xs">{metric.tierProgressPercent}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {metric.flags.length > 0 ? (
                              <div className="flex gap-1">
                                {metric.flags.map((flag) => (
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

        {/* Training Tab */}
        <TabsContent value="training">
          <Card>
            <CardHeader>
              <CardTitle>Training Compliance</CardTitle>
              <CardDescription>Monitor employee training progress and certifications</CardDescription>
            </CardHeader>
            <CardContent>
              {trainingLoading ? (
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
                        <TableHead>Employee</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Overdue</TableHead>
                        <TableHead>Certifications</TableHead>
                        <TableHead>Next Deadline</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(trainingData?.compliance || []).map((item) => (
                        <TableRow key={item.employeeId}>
                          <TableCell className="font-medium">
                            {item.employeeName}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{
                                    width: `${
                                      item.totalModules > 0
                                        ? (item.completedModules / item.totalModules) * 100
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs">
                                {item.completedModules}/{item.totalModules}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.overdueModules > 0 ? (
                              <Badge variant="destructive">
                                {item.overdueModules} overdue
                              </Badge>
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </TableCell>
                          <TableCell>
                            {item.certifications.length > 0
                              ? item.certifications.join(", ")
                              : "None"}
                          </TableCell>
                          <TableCell>
                            {item.nextDeadline
                              ? new Date(item.nextDeadline).toLocaleDateString()
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {item.overdueModules > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  sendReminderMutation.mutate(item.employeeId)
                                }
                                disabled={sendReminderMutation.isPending}
                              >
                                <Mail className="h-4 w-4" />
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

        {/* Teams Tab */}
        <TabsContent value="teams">
          <Card>
            <CardHeader>
              <CardTitle>Teams Overview</CardTitle>
              <CardDescription>View team performance and workload</CardDescription>
            </CardHeader>
            <CardContent>
              {teamsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(teamsData?.teams || []).map((team) => (
                    <Card key={team.teamLeadId}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-primary/10 rounded-full">
                            <Briefcase className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{team.teamLeadName}</p>
                            <p className="text-xs text-muted-foreground">Team Lead</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Members</p>
                            <p className="font-medium">{team.memberCount}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Performance</p>
                            <p className="font-medium">{team.avgPerformance}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Active Cases</p>
                            <p className="font-medium">{team.activeCase}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Pending Training</p>
                            <p className="font-medium">{team.pendingTraining}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
