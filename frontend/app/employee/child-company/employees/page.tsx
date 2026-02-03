"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  ArrowLeft,
  MoreVertical,
  User,
  Trash2,
  Mail,
  Calendar,
  Briefcase,
  DollarSign,
  Activity,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
  Send,
  AlertTriangle,
} from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
  casesAssigned: number;
  commissionEarnedCents: number;
  isActive: boolean;
  lastActiveAt?: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  invitedAt: string;
  expiresAt: string;
}

interface TeamStats {
  totalMembers: number;
  activeThisMonth: number;
  totalCommissionsCents: number;
}

const ROLES = ["MANAGER", "AGENT", "SUPPORT"];

const roleColors: Record<string, string> = {
  MANAGER: "bg-purple-500",
  AGENT: "bg-blue-500",
  SUPPORT: "bg-green-500",
};

export default function ChildCompanyEmployeesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [invitationToCancel, setInvitationToCancel] = useState<PendingInvitation | null>(null);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "AGENT",
    name: "",
  });

  // Fetch team members
  const {
    data: teamData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["child-company-employees"],
    queryFn: async () => {
      const { data } = await api.get("/child-companies/mine/employees");
      return data;
    },
  });

  // Fetch pending invitations
  const { data: invitationsData } = useQuery({
    queryKey: ["child-company-invitations"],
    queryFn: async () => {
      const { data } = await api.get("/child-companies/mine/invitations");
      return data;
    },
  });

  // Invite team member mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: typeof inviteForm) => {
      const response = await api.post("/child-companies/mine/invite", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-company-invitations"] });
      setIsInviteDialogOpen(false);
      setInviteForm({ email: "", role: "AGENT", name: "" });
      toast.success("Invitation sent successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to send invitation");
    },
  });

  // Remove team member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await api.delete(`/child-companies/mine/employees/${memberId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-company-employees"] });
      setMemberToRemove(null);
      toast.success("Team member removed successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to remove team member");
    },
  });

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await api.delete(`/child-companies/mine/invitations/${invitationId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-company-invitations"] });
      setInvitationToCancel(null);
      toast.success("Invitation cancelled");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to cancel invitation");
    },
  });

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await api.post(`/child-companies/mine/invitations/${invitationId}/resend`);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Invitation resent successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to resend invitation");
    },
  });

  const teamMembers: TeamMember[] = teamData?.data || teamData?.employees || [];
  const pendingInvitations: PendingInvitation[] = invitationsData?.data || invitationsData?.invitations || [];
  const stats: TeamStats = teamData?.stats || {
    totalMembers: teamMembers.length,
    activeThisMonth: teamMembers.filter((m) => m.isActive).length,
    totalCommissionsCents: teamMembers.reduce((acc, m) => acc + (m.commissionEarnedCents || 0), 0),
  };

  const filteredMembers = teamMembers.filter((member) => {
    const searchLower = search.toLowerCase();
    return (
      member.name?.toLowerCase().includes(searchLower) ||
      member.email?.toLowerCase().includes(searchLower) ||
      member.role?.toLowerCase().includes(searchLower)
    );
  });

  const handleInviteSubmit = () => {
    if (!inviteForm.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!inviteForm.email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    inviteMutation.mutate(inviteForm);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/employee/child-company">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Team Members</h1>
            <p className="text-muted-foreground">Manage your child company team</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium mb-1">Failed to Load Team</h3>
            <p className="text-sm text-muted-foreground mb-4">
              There was an error loading your team members. Please try again.
            </p>
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/employee/child-company">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Team Members
            </h1>
            <p className="text-muted-foreground">Manage your child company team</p>
          </div>
        </div>
        <Button onClick={() => setIsInviteDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Team Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Team Members
            </CardTitle>
            <Users className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active This Month
            </CardTitle>
            <Activity className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeThisMonth}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Commissions
            </CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalCommissionsCents)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search team members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              Invitations awaiting acceptance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900">
                      <Mail className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <p className="font-medium">{invitation.email}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {invitation.role}
                        </Badge>
                        <span>Sent {formatDate(invitation.invitedAt)}</span>
                        <span>Expires {formatDate(invitation.expiresAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resendInvitationMutation.mutate(invitation.id)}
                      disabled={resendInvitationMutation.isPending}
                    >
                      {resendInvitationMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => setInvitationToCancel(invitation)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      {filteredMembers.length === 0 && teamMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No Team Members Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start by inviting your first team member to join your child company.
            </p>
            <Button onClick={() => setIsInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Team Member
            </Button>
          </CardContent>
        </Card>
      ) : filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No Results Found</h3>
            <p className="text-sm text-muted-foreground">
              No team members match your search criteria.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <Card key={member.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{member.name || "Unnamed"}</CardTitle>
                      <CardDescription className="text-xs">{member.email}</CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/employee/child-company/employees/${member.id}`}>
                          <User className="h-4 w-4 mr-2" />
                          View Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => setMemberToRemove(member)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove from Team
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={roleColors[member.role] || "bg-slate-500"}>
                    {member.role}
                  </Badge>
                  <Badge variant={member.isActive ? "default" : "secondary"}>
                    {member.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Joined</p>
                      <p className="font-medium">{formatDate(member.joinedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Cases</p>
                      <p className="font-medium">{member.casesAssigned}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm text-muted-foreground">Commission Earned</span>
                  </div>
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(member.commissionEarnedCents)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your child company team
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email Address</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="team.member@example.com"
                value={inviteForm.email}
                onChange={(e) =>
                  setInviteForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteName">Name (Optional)</Label>
              <Input
                id="inviteName"
                placeholder="John Doe"
                value={inviteForm.name}
                onChange={(e) =>
                  setInviteForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteRole">Role</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(value) =>
                  setInviteForm((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsInviteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInviteSubmit}
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Remove Team Member
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {memberToRemove?.name || memberToRemove?.email} from your team?
              This action cannot be undone. They will lose access to all child company resources.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => memberToRemove && removeMemberMutation.mutate(memberToRemove.id)}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Remove"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Invitation Confirmation Dialog */}
      <Dialog open={!!invitationToCancel} onOpenChange={() => setInvitationToCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Cancel Invitation
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the invitation to {invitationToCancel?.email}?
              They will no longer be able to use the invitation link to join your team.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvitationToCancel(null)}>
              Keep Invitation
            </Button>
            <Button
              variant="destructive"
              onClick={() => invitationToCancel && cancelInvitationMutation.mutate(invitationToCancel.id)}
              disabled={cancelInvitationMutation.isPending}
            >
              {cancelInvitationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Cancel Invitation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
