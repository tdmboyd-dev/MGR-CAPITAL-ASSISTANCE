"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  Users,
  TrendingUp,
  Calendar,
  Building2,
  UserPlus,
  PhoneCall,
  FileSignature,
  Gavel,
  Trophy,
  Banknote,
} from "lucide-react";

// Pipeline stages
const PIPELINE_STAGES = [
  {
    id: "lead",
    title: "New Leads",
    icon: UserPlus,
    color: "bg-slate-500",
    description: "Uncontacted leads from auction data",
  },
  {
    id: "contacted",
    title: "Contacted",
    icon: PhoneCall,
    color: "bg-blue-500",
    description: "Initial contact made",
  },
  {
    id: "interested",
    title: "Interested",
    icon: TrendingUp,
    color: "bg-cyan-500",
    description: "Client expressed interest",
  },
  {
    id: "signed",
    title: "Signed",
    icon: FileSignature,
    color: "bg-purple-500",
    description: "Agreement signed",
  },
  {
    id: "filed",
    title: "Filed",
    icon: Gavel,
    color: "bg-orange-500",
    description: "Claim filed with court/county",
  },
  {
    id: "won",
    title: "Won",
    icon: Trophy,
    color: "bg-green-500",
    description: "Claim approved",
  },
  {
    id: "paid",
    title: "Paid",
    icon: Banknote,
    color: "bg-emerald-600",
    description: "Fee collected",
  },
];

interface Lead {
  id: string;
  stage: string;
  // Property info
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  propertyCounty: string;
  // Financial
  surplusAmount: number;
  auctionDate: string;
  salePrice?: number;
  // Owner info
  ownerName: string;
  ownerPhone?: string;
  ownerEmail?: string;
  ownerAddress?: string;
  isDeceased?: boolean;
  // Case info
  assignedTo?: string;
  contingencyPercent: number;
  priority: "low" | "medium" | "high" | "critical";
  // Skip trace
  skipTraceScore?: number;
  // Deadlines
  deadlineDate?: string;
  deadlineDays?: number;
  // Activity
  lastActivity?: string;
  lastActivityDate?: string;
  notes?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

interface LeadCardProps {
  lead: Lead;
  onEdit: (lead: Lead) => void;
  onCall: (lead: Lead) => void;
  onEmail: (lead: Lead) => void;
  onViewDetails: (lead: Lead) => void;
}

// Sortable Lead Card Component
function SortableLeadCard({ lead, onEdit, onCall, onEmail, onViewDetails }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityColors = {
    low: "bg-slate-100 text-slate-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-orange-100 text-orange-700",
    critical: "bg-red-100 text-red-700",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{lead.ownerName}</h4>
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {lead.propertyCity}, {lead.propertyState}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewDetails(lead)}>
              <FileText className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(lead)}>
              Edit Lead
            </DropdownMenuItem>
            {lead.ownerPhone && (
              <DropdownMenuItem onClick={() => onCall(lead)}>
                <Phone className="h-4 w-4 mr-2" />
                Call
              </DropdownMenuItem>
            )}
            {lead.ownerEmail && (
              <DropdownMenuItem onClick={() => onEmail(lead)}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Surplus Amount */}
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="h-4 w-4 text-green-600" />
        <span className="font-bold text-green-600">
          ${lead.surplusAmount.toLocaleString()}
        </span>
        <Badge variant="outline" className={`text-xs ${priorityColors[lead.priority]}`}>
          {lead.priority}
        </Badge>
      </div>

      {/* Skip Trace Score */}
      {lead.skipTraceScore !== undefined && (
        <div className="flex items-center gap-2 mb-2">
          <div className="h-1.5 flex-1 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                lead.skipTraceScore >= 80
                  ? "bg-green-500"
                  : lead.skipTraceScore >= 50
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${lead.skipTraceScore}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{lead.skipTraceScore}%</span>
        </div>
      )}

      {/* Deadline Warning */}
      {lead.deadlineDays !== undefined && lead.deadlineDays <= 30 && (
        <div
          className={`flex items-center gap-1 text-xs mb-2 ${
            lead.deadlineDays <= 7 ? "text-red-600" : "text-orange-600"
          }`}
        >
          <AlertTriangle className="h-3 w-3" />
          {lead.deadlineDays <= 0
            ? "OVERDUE"
            : `${lead.deadlineDays} days left`}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(lead.auctionDate).toLocaleDateString()}
        </span>
        {lead.assignedTo && (
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[10px]">
              {lead.assignedTo
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Deceased Badge */}
      {lead.isDeceased && (
        <Badge variant="secondary" className="text-xs mt-2 w-full justify-center">
          <Users className="h-3 w-3 mr-1" />
          Heir Search Required
        </Badge>
      )}
    </div>
  );
}

// Pipeline Column Component
interface PipelineColumnProps {
  stage: typeof PIPELINE_STAGES[0];
  leads: Lead[];
  onAddLead: () => void;
  onEditLead: (lead: Lead) => void;
  onCallLead: (lead: Lead) => void;
  onEmailLead: (lead: Lead) => void;
  onViewDetails: (lead: Lead) => void;
}

function PipelineColumn({
  stage,
  leads,
  onAddLead,
  onEditLead,
  onCallLead,
  onEmailLead,
  onViewDetails,
}: PipelineColumnProps) {
  const totalValue = leads.reduce((sum, lead) => sum + lead.surplusAmount, 0);
  const Icon = stage.icon;

  return (
    <div className="flex-shrink-0 w-[300px] bg-slate-50 dark:bg-slate-900 rounded-lg">
      {/* Column Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${stage.color}`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <h3 className="font-medium text-sm">{stage.title}</h3>
            <Badge variant="secondary" className="text-xs">
              {leads.length}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddLead}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{stage.description}</p>
        <p className="text-sm font-medium text-green-600 mt-1">
          ${totalValue.toLocaleString()}
        </p>
      </div>

      {/* Cards Container */}
      <div className="p-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <SortableLeadCard
              key={lead.id}
              lead={lead}
              onEdit={onEditLead}
              onCall={onCallLead}
              onEmail={onEmailLead}
              onViewDetails={onViewDetails}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No leads in this stage
          </div>
        )}
      </div>
    </div>
  );
}

// Lead Detail Dialog
interface LeadDetailDialogProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

function LeadDetailDialog({ lead, open, onClose }: LeadDetailDialogProps) {
  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lead Details</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Owner Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Owner Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>{" "}
                {lead.ownerName}
                {lead.isDeceased && (
                  <Badge variant="secondary" className="ml-2">Deceased</Badge>
                )}
              </div>
              {lead.ownerPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {lead.ownerPhone}
                </div>
              )}
              {lead.ownerEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {lead.ownerEmail}
                </div>
              )}
              {lead.ownerAddress && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {lead.ownerAddress}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Property Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Property Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {lead.propertyAddress}
              </div>
              <div>
                {lead.propertyCity}, {lead.propertyState} {lead.propertyZip}
              </div>
              <div>
                <span className="text-muted-foreground">County:</span>{" "}
                {lead.propertyCounty}
              </div>
            </CardContent>
          </Card>

          {/* Financial Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Financial Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="font-bold text-green-600 text-lg">
                  ${lead.surplusAmount.toLocaleString()}
                </span>
              </div>
              {lead.salePrice && (
                <div>
                  <span className="text-muted-foreground">Sale Price:</span>{" "}
                  ${lead.salePrice.toLocaleString()}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Contingency:</span>{" "}
                {lead.contingencyPercent}%
              </div>
              <div>
                <span className="text-muted-foreground">Potential Fee:</span>{" "}
                <span className="font-medium">
                  ${Math.round(lead.surplusAmount * (lead.contingencyPercent / 100)).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="text-muted-foreground">Auction:</span>{" "}
                {new Date(lead.auctionDate).toLocaleDateString()}
              </div>
              {lead.deadlineDate && (
                <div className={`flex items-center gap-2 ${lead.deadlineDays && lead.deadlineDays <= 7 ? "text-red-600" : ""}`}>
                  <Clock className="h-4 w-4" />
                  <span className="text-muted-foreground">Deadline:</span>{" "}
                  {new Date(lead.deadlineDate).toLocaleDateString()}
                  {lead.deadlineDays !== undefined && (
                    <Badge variant={lead.deadlineDays <= 7 ? "destructive" : "secondary"}>
                      {lead.deadlineDays} days
                    </Badge>
                  )}
                </div>
              )}
              {lead.lastActivity && (
                <div>
                  <span className="text-muted-foreground">Last Activity:</span>{" "}
                  {lead.lastActivity}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        {lead.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Main Pipeline Component
export default function LeadPipelineKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterState, setFilterState] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load leads from API with mock fallback
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/leads', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            setLeads(data.data);
            return;
          }
        }
      } catch (error) {
        console.log('API not available, using demo data');
      }

      // Fallback to demo data if API unavailable
      loadDemoData();
    };

    fetchLeads();
  }, []);

  const loadDemoData = () => {
    const mockLeads: Lead[] = [
      {
        id: "lead-1",
        stage: "lead",
        propertyAddress: "123 Palm Beach Blvd",
        propertyCity: "Miami",
        propertyState: "FL",
        propertyZip: "33101",
        propertyCounty: "Miami-Dade",
        surplusAmount: 45000,
        auctionDate: "2025-12-15",
        ownerName: "John Smith",
        ownerPhone: "+1 (305) 555-0123",
        ownerEmail: "john.smith@email.com",
        contingencyPercent: 33,
        priority: "high",
        skipTraceScore: 85,
        deadlineDate: "2026-04-15",
        deadlineDays: 80,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "lead-2",
        stage: "lead",
        propertyAddress: "456 Oak Street",
        propertyCity: "Tampa",
        propertyState: "FL",
        propertyZip: "33602",
        propertyCounty: "Hillsborough",
        surplusAmount: 78000,
        auctionDate: "2025-11-20",
        ownerName: "Mary Johnson",
        ownerPhone: "+1 (813) 555-0456",
        isDeceased: true,
        contingencyPercent: 35,
        priority: "critical",
        skipTraceScore: 72,
        deadlineDate: "2026-03-20",
        deadlineDays: 54,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "lead-3",
        stage: "contacted",
        propertyAddress: "789 Sunset Drive",
        propertyCity: "Orlando",
        propertyState: "FL",
        propertyZip: "32801",
        propertyCounty: "Orange",
        surplusAmount: 32000,
        auctionDate: "2025-10-05",
        ownerName: "Robert Davis",
        ownerPhone: "+1 (407) 555-0789",
        ownerEmail: "rdavis@email.com",
        contingencyPercent: 33,
        priority: "medium",
        skipTraceScore: 92,
        lastActivity: "Called - Left voicemail",
        lastActivityDate: "2026-01-20",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "lead-4",
        stage: "interested",
        propertyAddress: "321 River Road",
        propertyCity: "Jacksonville",
        propertyState: "FL",
        propertyZip: "32202",
        propertyCounty: "Duval",
        surplusAmount: 125000,
        auctionDate: "2025-09-15",
        ownerName: "Sarah Williams",
        ownerPhone: "+1 (904) 555-0321",
        ownerEmail: "sarah.w@email.com",
        contingencyPercent: 30,
        priority: "high",
        skipTraceScore: 95,
        lastActivity: "Scheduled call for Monday",
        assignedTo: "Mike Agent",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "lead-5",
        stage: "signed",
        propertyAddress: "555 Beach Avenue",
        propertyCity: "Fort Lauderdale",
        propertyState: "FL",
        propertyZip: "33301",
        propertyCounty: "Broward",
        surplusAmount: 67000,
        auctionDate: "2025-08-01",
        ownerName: "James Brown",
        ownerPhone: "+1 (954) 555-0555",
        contingencyPercent: 33,
        priority: "high",
        lastActivity: "Agreement signed",
        assignedTo: "Jane Agent",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "lead-6",
        stage: "filed",
        propertyAddress: "888 Marina Way",
        propertyCity: "Sarasota",
        propertyState: "FL",
        propertyZip: "34236",
        propertyCounty: "Sarasota",
        surplusAmount: 92000,
        auctionDate: "2025-07-10",
        ownerName: "Patricia Miller",
        ownerPhone: "+1 (941) 555-0888",
        contingencyPercent: 33,
        priority: "medium",
        lastActivity: "Claim filed with clerk",
        assignedTo: "Mike Agent",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "lead-7",
        stage: "won",
        propertyAddress: "999 Gulf Boulevard",
        propertyCity: "Clearwater",
        propertyState: "FL",
        propertyZip: "33767",
        propertyCounty: "Pinellas",
        surplusAmount: 54000,
        auctionDate: "2025-05-20",
        ownerName: "Thomas Wilson",
        ownerPhone: "+1 (727) 555-0999",
        contingencyPercent: 33,
        priority: "low",
        lastActivity: "Claim approved - awaiting disbursement",
        assignedTo: "Jane Agent",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "lead-8",
        stage: "paid",
        propertyAddress: "111 Island Drive",
        propertyCity: "Key West",
        propertyState: "FL",
        propertyZip: "33040",
        propertyCounty: "Monroe",
        surplusAmount: 83000,
        auctionDate: "2025-03-15",
        ownerName: "Elizabeth Taylor",
        contingencyPercent: 33,
        priority: "low",
        lastActivity: "Fee collected via ACH",
        assignedTo: "Mike Agent",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    setLeads(mockLeads);
  };

  // Update lead stage via API
  const updateLeadStage = async (leadId: string, newStage: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stage: newStage })
      });
    } catch (error) {
      console.log('Stage update API not available');
    }
  };

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        lead.ownerName.toLowerCase().includes(query) ||
        lead.propertyAddress.toLowerCase().includes(query) ||
        lead.propertyCity.toLowerCase().includes(query) ||
        lead.propertyCounty.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    if (filterState && lead.propertyState !== filterState) return false;
    if (filterPriority && lead.priority !== filterPriority) return false;
    return true;
  });

  // Group leads by stage
  const leadsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.id] = filteredLeads.filter((lead) => lead.stage === stage.id);
    return acc;
  }, {} as Record<string, Lead[]>);

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeLead = leads.find((l) => l.id === activeId);
    const overLead = leads.find((l) => l.id === overId);

    if (!activeLead) return;

    // If dragging over a column header (stage)
    const overStage = PIPELINE_STAGES.find((s) => s.id === overId);
    if (overStage) {
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === activeId ? { ...lead, stage: overStage.id } : lead
        )
      );
      return;
    }

    // If dragging over another lead
    if (overLead && activeLead.stage !== overLead.stage) {
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === activeId ? { ...lead, stage: overLead.stage } : lead
        )
      );
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeLead = leads.find((l) => l.id === activeId);
    if (!activeLead) return;

    // Log the stage change and update via API
    const newStage = PIPELINE_STAGES.find(
      (s) => s.id === activeLead.stage
    );
    if (newStage) {
      toast.success(`Moved to ${newStage.title}`);
      // Update via API
      updateLeadStage(activeLead.id, activeLead.stage);
    }
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  // Calculate totals
  const totalPipelineValue = leads.reduce((sum, lead) => sum + lead.surplusAmount, 0);
  const totalPotentialFees = leads.reduce(
    (sum, lead) => sum + lead.surplusAmount * (lead.contingencyPercent / 100),
    0
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold">Lead Pipeline</h2>
          <p className="text-muted-foreground">
            {leads.length} leads • ${totalPipelineValue.toLocaleString()} total value •{" "}
            ${Math.round(totalPotentialFees).toLocaleString()} potential fees
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-[200px]"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <div className="p-2 space-y-2">
                <div>
                  <Label className="text-xs">State</Label>
                  <select
                    className="w-full p-1 text-sm border rounded"
                    value={filterState}
                    onChange={(e) => setFilterState(e.target.value)}
                  >
                    <option value="">All States</option>
                    <option value="FL">Florida</option>
                    <option value="TX">Texas</option>
                    <option value="GA">Georgia</option>
                    <option value="CA">California</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Priority</Label>
                  <select
                    className="w-full p-1 text-sm border rounded"
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Pipeline Board */}
      <div className="flex-1 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full pb-4">
            {PIPELINE_STAGES.map((stage) => (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                leads={leadsByStage[stage.id] || []}
                onAddLead={() => toast.info("Add lead to " + stage.title)}
                onEditLead={(lead) => toast.info("Edit " + lead.ownerName)}
                onCallLead={(lead) => {
                  if (lead.ownerPhone) {
                    window.open(`tel:${lead.ownerPhone}`);
                  }
                }}
                onEmailLead={(lead) => {
                  if (lead.ownerEmail) {
                    window.open(`mailto:${lead.ownerEmail}`);
                  }
                }}
                onViewDetails={(lead) => {
                  setSelectedLead(lead);
                  setDetailsOpen(true);
                }}
              />
            ))}
          </div>

          <DragOverlay>
            {activeLead && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border-2 border-blue-500 p-3 w-[280px] rotate-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="font-bold text-green-600">
                    ${activeLead.surplusAmount.toLocaleString()}
                  </span>
                </div>
                <p className="font-medium text-sm mt-1">{activeLead.ownerName}</p>
                <p className="text-xs text-muted-foreground">
                  {activeLead.propertyCity}, {activeLead.propertyState}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Lead Detail Dialog */}
      <LeadDetailDialog
        lead={selectedLead}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      />
    </div>
  );
}
