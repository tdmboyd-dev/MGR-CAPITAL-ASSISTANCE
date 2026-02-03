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
  Users,
  UserCheck,
  GraduationCap,
  Search,
  RefreshCw,
  Mail,
  CheckCircle,
  Clock,
  Briefcase,
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
  TIER_1_ASSOCIATE: "Tier 1",
  TIER_2_SPECIALIST: "Tier 2",
  TIER_3_SENIOR_SPECIALIST: "Tier 3",
  TIER_4_TEAM_LEADER: "Tier 4",
  TIER_5_EXECUTIVE_PARTNER: "Tier 5",
};

export default function AdminHRPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

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
            HR Overview
          </h1>
          <p className="text-muted-foreground">
            View employee information and training status
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
                  <p className="text-2xl font-bold">{dashboard.overdueTrainingCount}</p>
                  <p className="text-xs text-muted-foreground">Overdue Training</p>
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
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Employees</CardTitle>
                  <CardDescription>View employee directory</CardDescription>
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
                            <Badge variant="secondary">
                              {TIER_LABELS[emp.tier] || emp.tier}
                            </Badge>
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
              <CardDescription>Monitor training progress</CardDescription>
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
              <CardDescription>View team structure</CardDescription>
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
                            <p className="text-muted-foreground">Active Cases</p>
                            <p className="font-medium">{team.activeCase}</p>
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
