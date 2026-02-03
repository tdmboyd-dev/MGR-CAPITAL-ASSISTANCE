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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SkeletonTable } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Edit,
  Trash2,
  Users,
  Clock,
  CheckCircle,
  BarChart3,
  RefreshCw,
} from "lucide-react";

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  duration: number;
  required: boolean;
  order: number;
  createdAt: string;
  _count?: {
    completions: number;
  };
}

export default function AdminTrainingPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<TrainingModule | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    duration: 15,
    required: true,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-training-modules"],
    queryFn: async () => {
      const { data } = await api.get("/training/admin");
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["training-stats"],
    queryFn: async () => {
      const { data } = await api.get("/training/stats");
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (moduleData: typeof formData) => {
      const { data } = await api.post("/training", moduleData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-training-modules"] });
      setIsCreateOpen(false);
      setFormData({ title: "", description: "", duration: 15, required: true });
      toast.success("Training module created");
    },
    onError: () => {
      toast.error("Failed to create module");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...moduleData }: { id: string } & typeof formData) => {
      const { data } = await api.patch(`/training/${id}`, moduleData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-training-modules"] });
      setEditingModule(null);
      toast.success("Training module updated");
    },
    onError: () => {
      toast.error("Failed to update module");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/training/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-training-modules"] });
      toast.success("Training module deleted");
    },
    onError: () => {
      toast.error("Failed to delete module");
    },
  });

  const modules = data?.data || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingModule) {
      updateMutation.mutate({ id: editingModule.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditDialog = (module: TrainingModule) => {
    setEditingModule(module);
    setFormData({
      title: module.title,
      description: module.description,
      duration: module.duration,
      required: module.required,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="h-8 w-8" />
            Training Management
          </h1>
          <p className="text-muted-foreground">
            Create and manage training modules for employees
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingModule(null);
                setFormData({ title: "", description: "", duration: 15, required: true });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Module
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Training Module</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Module title"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Module description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 15 }))}
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Required</Label>
                    <select
                      value={formData.required ? "true" : "false"}
                      onChange={(e) => setFormData(prev => ({ ...prev, required: e.target.value === "true" }))}
                      className="w-full px-3 py-2 rounded-md border bg-background"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Module"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Modules
            </CardTitle>
            <BookOpen className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{modules.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Required Modules
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {modules.filter((m: TrainingModule) => m.required).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Completions
            </CardTitle>
            <Users className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCompletions || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Completion Rate
            </CardTitle>
            <BarChart3 className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avgCompletionRate ? `${stats.avgCompletionRate}%` : "N/A"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Training Modules</CardTitle>
          <CardDescription>
            Manage all training content for your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={5} />
          ) : modules.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Completions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((module: TrainingModule) => (
                  <TableRow key={module.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{module.title}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {module.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {module.duration} min
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={module.required ? "default" : "secondary"}>
                        {module.required ? "Required" : "Optional"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {module._count?.completions || 0}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(module.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Dialog
                          open={editingModule?.id === module.id}
                          onOpenChange={(open) => {
                            if (!open) setEditingModule(null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(module)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Training Module</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                              <div className="space-y-2">
                                <Label>Title</Label>
                                <Input
                                  value={formData.title}
                                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                  placeholder="Module title"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                  value={formData.description}
                                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                  placeholder="Module description"
                                  rows={3}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Duration (minutes)</Label>
                                  <Input
                                    type="number"
                                    value={formData.duration}
                                    onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 15 }))}
                                    min={1}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Required</Label>
                                  <select
                                    value={formData.required ? "true" : "false"}
                                    onChange={(e) => setFormData(prev => ({ ...prev, required: e.target.value === "true" }))}
                                    className="w-full px-3 py-2 rounded-md border bg-background"
                                  >
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                  </select>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 pt-4">
                                <Button type="button" variant="outline" onClick={() => setEditingModule(null)}>
                                  Cancel
                                </Button>
                                <Button type="submit" disabled={updateMutation.isPending}>
                                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                                </Button>
                              </div>
                            </form>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this module?")) {
                              deleteMutation.mutate(module.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No training modules yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first module to get started
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Module
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
