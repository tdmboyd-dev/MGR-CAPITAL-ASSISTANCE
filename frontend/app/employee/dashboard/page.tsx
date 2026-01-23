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
import { DonutChartComponent, BarChartComponent } from "@/components/ui/charts";
import { formatCurrency } from "@/lib/utils";
import { FileText, DollarSign, BookOpen, CheckCircle, ArrowRight } from "lucide-react";

export default function EmployeeDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["employee-stats"],
    queryFn: async () => {
      const { data } = await api.get("/cases/my-stats");
      return data;
    },
  });

  const { data: training } = useQuery({
    queryKey: ["training-progress"],
    queryFn: async () => {
      const { data } = await api.get("/training/progress");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {user?.name || "Employee"}</h1>
        <p className="text-muted-foreground">
          Your performance dashboard and tasks
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assigned Cases
            </CardTitle>
            <FileText className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.assignedCases || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Closed This Month
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.closedThisMonth || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Commission Earned
            </CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.commissionCents || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Training Progress
            </CardTitle>
            <BookOpen className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {training?.completedModules || 0}/{training?.totalModules || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>My Case Status</CardTitle>
            <CardDescription>Breakdown of your assigned cases</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChartComponent
              data={[
                { name: "New", value: stats?.newCases || 3 },
                { name: "In Progress", value: stats?.inProgressCases || 5 },
                { name: "Docs Pending", value: stats?.docsPending || 2 },
                { name: "Closed", value: stats?.closedCases || 8 },
              ]}
              height={220}
              centerLabel="Active"
              centerValue={stats?.assignedCases || 18}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Performance</CardTitle>
            <CardDescription>Cases closed per month</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChartComponent
              data={[
                { name: "Jan", value: 2 },
                { name: "Feb", value: 3 },
                { name: "Mar", value: 4 },
                { name: "Apr", value: 3 },
                { name: "May", value: 5 },
                { name: "Jun", value: stats?.closedThisMonth || 4 },
              ]}
              height={220}
              color="#22c55e"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Cases</CardTitle>
              <CardDescription>Your latest assigned cases</CardDescription>
            </div>
            <Link href="/employee/cases" className="text-sm text-primary flex items-center gap-1">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {stats?.recentCases?.length > 0 ? (
              <div className="space-y-3">
                {stats.recentCases.map((caseItem: any) => (
                  <Link
                    key={caseItem.id}
                    href={`/employee/cases/${caseItem.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium">{caseItem.caseCode}</p>
                      <p className="text-sm text-muted-foreground">
                        {caseItem.state} - {caseItem.county}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        caseItem.status === "SIGNED"
                          ? "bg-green-100 text-green-700"
                          : caseItem.status === "RESEARCHING"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {caseItem.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No cases assigned yet
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Training Modules</CardTitle>
              <CardDescription>Continue your learning</CardDescription>
            </div>
            <Link href="/employee/training" className="text-sm text-primary flex items-center gap-1">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {training?.modules?.length > 0 ? (
              <div className="space-y-3">
                {training.modules.slice(0, 5).map((module: any) => (
                  <Link
                    key={module.id}
                    href={`/employee/training/${module.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium">{module.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {module.duration} min
                      </p>
                    </div>
                    {module.completed ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                        Pending
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No training modules available
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
