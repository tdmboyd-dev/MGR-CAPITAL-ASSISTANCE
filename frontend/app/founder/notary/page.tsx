"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Stamp,
  Upload,
  Save,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  Video,
  BookOpen,
  MapPin,
  Shield,
  Calendar,
  DollarSign,
  Building,
  User,
  Hash,
  Image as ImageIcon,
  PenTool,
  X,
  RefreshCw,
  Search,
  Eye,
} from "lucide-react";

interface NotaryConfig {
  id?: string;
  notaryName: string;
  commissionNumber: string;
  state: string;
  county: string;
  commissionExpirationDate: string;
  bondAmount: number;
  bondNumber: string;
  eoInsuranceProvider: string;
  eoInsurancePolicyNumber: string;
  eoInsuranceCoverage: number;
  eoInsuranceExpirationDate: string;
  digitalSealBase64: string | null;
  digitalSignatureBase64: string | null;
  isConfigured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface RONSession {
  id: string;
  sessionId: string;
  signerName: string;
  documentType: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  recordingUrl?: string;
}

interface JournalEntry {
  id: string;
  entryNumber: number;
  date: string;
  signerName: string;
  signerAddress: string;
  documentType: string;
  documentDescription: string;
  idType: string;
  idNumber: string;
  idExpiration: string;
  notarizationType: string;
  fee: number;
  notes?: string;
}

interface StateRule {
  state: string;
  stateName: string;
  ronAllowed: boolean;
  inPersonAllowed: boolean;
  maxNotaryFee: number;
  journalRequired: boolean;
  sealRequired: boolean;
  signatureRequired: boolean;
  idRequirements: string[];
  additionalNotes: string;
}

const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
];

export default function FounderNotaryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("config");
  const [selectedStateForRules, setSelectedStateForRules] = useState<string>("");
  const sealInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<NotaryConfig>>({
    notaryName: "",
    commissionNumber: "",
    state: "",
    county: "",
    commissionExpirationDate: "",
    bondAmount: 0,
    bondNumber: "",
    eoInsuranceProvider: "",
    eoInsurancePolicyNumber: "",
    eoInsuranceCoverage: 0,
    eoInsuranceExpirationDate: "",
    digitalSealBase64: null,
    digitalSignatureBase64: null,
  });

  // Fetch notary config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["founder-notary-config"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/founder-notary/config");
        return data.data as NotaryConfig;
      } catch {
        return null;
      }
    },
    staleTime: 30000,
  });

  // Fetch RON sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["founder-notary-sessions"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/founder-notary/sessions");
        return data.data as RONSession[];
      } catch {
        return [];
      }
    },
    staleTime: 30000,
  });

  // Fetch journal entries
  const { data: journal, isLoading: journalLoading } = useQuery({
    queryKey: ["founder-notary-journal"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/founder-notary/journal");
        return data.data as JournalEntry[];
      } catch {
        return [];
      }
    },
    staleTime: 30000,
  });

  // Fetch state rules
  const { data: stateRules, isLoading: stateRulesLoading } = useQuery({
    queryKey: ["founder-notary-states"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/founder-notary/states");
        return data.data as StateRule[];
      } catch {
        return [];
      }
    },
    staleTime: 300000, // Cache for 5 minutes
  });

  // Save config mutation
  const saveMutation = useMutation({
    mutationFn: async (configData: Partial<NotaryConfig>) => {
      const { data } = await api.post("/founder-notary/config", configData);
      return data;
    },
    onSuccess: () => {
      toast.success("Notary configuration saved successfully");
      queryClient.invalidateQueries({ queryKey: ["founder-notary-config"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to save configuration");
    },
  });

  // Initialize form with existing config
  useEffect(() => {
    if (config) {
      setFormData({
        notaryName: config.notaryName || "",
        commissionNumber: config.commissionNumber || "",
        state: config.state || "",
        county: config.county || "",
        commissionExpirationDate: config.commissionExpirationDate?.split("T")[0] || "",
        bondAmount: config.bondAmount || 0,
        bondNumber: config.bondNumber || "",
        eoInsuranceProvider: config.eoInsuranceProvider || "",
        eoInsurancePolicyNumber: config.eoInsurancePolicyNumber || "",
        eoInsuranceCoverage: config.eoInsuranceCoverage || 0,
        eoInsuranceExpirationDate: config.eoInsuranceExpirationDate?.split("T")[0] || "",
        digitalSealBase64: config.digitalSealBase64 || null,
        digitalSignatureBase64: config.digitalSignatureBase64 || null,
      });
    }
  }, [config]);

  // File to base64 converter
  const convertFileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }, []);

  // Handle seal upload
  const handleSealUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    try {
      const base64 = await convertFileToBase64(file);
      setFormData((prev) => ({ ...prev, digitalSealBase64: base64 }));
      toast.success("Seal image uploaded");
    } catch (error) {
      toast.error("Failed to process image");
    }
  };

  // Handle signature upload
  const handleSignatureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    try {
      const base64 = await convertFileToBase64(file);
      setFormData((prev) => ({ ...prev, digitalSignatureBase64: base64 }));
      toast.success("Signature image uploaded");
    } catch (error) {
      toast.error("Failed to process image");
    }
  };

  const handleSave = () => {
    if (!formData.notaryName || !formData.commissionNumber || !formData.state) {
      toast.error("Please fill in all required fields");
      return;
    }
    saveMutation.mutate(formData);
  };

  const getSessionStatusBadge = (status: RONSession["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-blue-500"><Video className="h-3 w-3 mr-1" />In Progress</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isCommissionExpiringSoon = () => {
    if (!config?.commissionExpirationDate) return false;
    const expDate = new Date(config.commissionExpirationDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
  };

  const isCommissionExpired = () => {
    if (!config?.commissionExpirationDate) return false;
    return new Date(config.commissionExpirationDate) < new Date();
  };

  const selectedStateRule = stateRules?.find((r) => r.state === selectedStateForRules);

  if (configLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <Stamp className="h-7 w-7 md:h-8 md:w-8" />
          Notary Credentials
        </h1>
        <p className="text-muted-foreground">
          Manage your notary commission, digital seal, and RON sessions
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {config?.isConfigured ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              <div>
                <p className="text-2xl font-bold">{config?.isConfigured ? "Active" : "Not Set"}</p>
                <p className="text-xs text-muted-foreground">Configuration Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {isCommissionExpired() ? (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              ) : isCommissionExpiringSoon() ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ) : (
                <Calendar className="h-5 w-5 text-blue-500" />
              )}
              <div>
                <p className="text-2xl font-bold">
                  {config?.commissionExpirationDate
                    ? new Date(config.commissionExpirationDate).toLocaleDateString()
                    : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Commission Expires
                  {isCommissionExpired() && " (Expired!)"}
                  {isCommissionExpiringSoon() && " (Soon)"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {sessions?.filter((s) => s.status === "in_progress").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Active RON Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-500" />
              <div>
                <p className="text-2xl font-bold">{journal?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Journal Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Stamp className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            RON Sessions
          </TabsTrigger>
          <TabsTrigger value="journal" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Journal
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            State Rules
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Commission Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Commission Details
                </CardTitle>
                <CardDescription>
                  Your notary commission information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notaryName">Notary Name *</Label>
                  <Input
                    id="notaryName"
                    placeholder="Full legal name as on commission"
                    value={formData.notaryName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, notaryName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commissionNumber">Commission Number *</Label>
                  <Input
                    id="commissionNumber"
                    placeholder="e.g., GG123456"
                    value={formData.commissionNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, commissionNumber: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, state: value }))
                      }
                    >
                      <SelectTrigger id="state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.code} value={state.code}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="county">County</Label>
                    <Input
                      id="county"
                      placeholder="e.g., Miami-Dade"
                      value={formData.county}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, county: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commissionExpiration">Commission Expiration Date *</Label>
                  <Input
                    id="commissionExpiration"
                    type="date"
                    value={formData.commissionExpirationDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        commissionExpirationDate: e.target.value,
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Bond & Insurance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Bond & E&O Insurance
                </CardTitle>
                <CardDescription>
                  Your surety bond and errors & omissions insurance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bondAmount">Bond Amount ($)</Label>
                    <Input
                      id="bondAmount"
                      type="number"
                      min="0"
                      placeholder="e.g., 25000"
                      value={formData.bondAmount || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          bondAmount: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bondNumber">Bond Number</Label>
                    <Input
                      id="bondNumber"
                      placeholder="e.g., SB-12345678"
                      value={formData.bondNumber}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, bondNumber: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eoProvider">E&O Insurance Provider</Label>
                  <Input
                    id="eoProvider"
                    placeholder="e.g., Notary Insurance Agency"
                    value={formData.eoInsuranceProvider}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        eoInsuranceProvider: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eoPolicyNumber">Policy Number</Label>
                    <Input
                      id="eoPolicyNumber"
                      placeholder="e.g., EO-987654"
                      value={formData.eoInsurancePolicyNumber}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          eoInsurancePolicyNumber: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eoCoverage">Coverage Amount ($)</Label>
                    <Input
                      id="eoCoverage"
                      type="number"
                      min="0"
                      placeholder="e.g., 100000"
                      value={formData.eoInsuranceCoverage || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          eoInsuranceCoverage: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eoExpiration">E&O Expiration Date</Label>
                  <Input
                    id="eoExpiration"
                    type="date"
                    value={formData.eoInsuranceExpirationDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        eoInsuranceExpirationDate: e.target.value,
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Digital Seal */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Digital Seal
                </CardTitle>
                <CardDescription>
                  Upload your official notary seal image (PNG, JPG, max 5MB)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={sealInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSealUpload}
                  className="hidden"
                />
                {formData.digitalSealBase64 ? (
                  <div className="space-y-4">
                    <div className="relative border rounded-lg p-4 bg-muted/50 flex items-center justify-center">
                      <img
                        src={formData.digitalSealBase64}
                        alt="Digital Seal"
                        className="max-h-40 object-contain"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sealInputRef.current?.click()}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Replace
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, digitalSealBase64: null }))
                        }
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => sealInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Click to upload your digital seal
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Digital Signature */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenTool className="h-5 w-5" />
                  Digital Signature
                </CardTitle>
                <CardDescription>
                  Upload your signature image (PNG, JPG, max 5MB)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  className="hidden"
                />
                {formData.digitalSignatureBase64 ? (
                  <div className="space-y-4">
                    <div className="relative border rounded-lg p-4 bg-muted/50 flex items-center justify-center">
                      <img
                        src={formData.digitalSignatureBase64}
                        alt="Digital Signature"
                        className="max-h-40 object-contain"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => signatureInputRef.current?.click()}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Replace
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, digitalSignatureBase64: null }))
                        }
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => signatureInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Click to upload your signature
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saveMutation.isPending} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </TabsContent>

        {/* RON Sessions Tab */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Remote Online Notarization Sessions
              </CardTitle>
              <CardDescription>
                View and manage your active and past RON sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : sessions && sessions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session ID</TableHead>
                        <TableHead>Signer</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((session) => (
                        <TableRow key={session.id}>
                          <TableCell className="font-mono text-sm">
                            {session.sessionId}
                          </TableCell>
                          <TableCell>{session.signerName}</TableCell>
                          <TableCell>{session.documentType}</TableCell>
                          <TableCell>{getSessionStatusBadge(session.status)}</TableCell>
                          <TableCell>
                            {new Date(session.scheduledAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {session.status === "in_progress" && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => {
                                    // Open RON session in new window
                                    window.open(`/ron-session/${session.sessionId}`, "_blank");
                                  }}
                                >
                                  <Video className="h-3 w-3 mr-1" />
                                  Join
                                </Button>
                              )}
                              {session.recordingUrl && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    // Open recording URL
                                    window.open(session.recordingUrl, "_blank");
                                  }}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Recording
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No RON sessions found</p>
                  <p className="text-sm mt-1">Sessions will appear here when scheduled</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Journal Tab */}
        <TabsContent value="journal">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Notary Journal
              </CardTitle>
              <CardDescription>
                Your notarial act records as required by state law
              </CardDescription>
            </CardHeader>
            <CardContent>
              {journalLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : journal && journal.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entry #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Signer</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Notarization Type</TableHead>
                        <TableHead>ID Type</TableHead>
                        <TableHead>Fee</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {journal.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-mono">{entry.entryNumber}</TableCell>
                          <TableCell>
                            {new Date(entry.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{entry.signerName}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {entry.signerAddress}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{entry.documentType}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {entry.documentDescription}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{entry.notarizationType}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">{entry.idType}</p>
                              <p className="text-xs text-muted-foreground">
                                Exp: {new Date(entry.idExpiration).toLocaleDateString()}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            ${entry.fee.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No journal entries yet</p>
                  <p className="text-sm mt-1">Entries will be recorded after notarizations</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* State Rules Tab */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                State Notary Rules Lookup
              </CardTitle>
              <CardDescription>
                Check notarization requirements by state
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex gap-4 items-end">
                  <div className="flex-1 max-w-sm">
                    <Label htmlFor="stateRulesSelect">Select State</Label>
                    <Select
                      value={selectedStateForRules}
                      onValueChange={setSelectedStateForRules}
                    >
                      <SelectTrigger id="stateRulesSelect">
                        <SelectValue placeholder="Choose a state to view rules" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.code} value={state.code}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {stateRulesLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : selectedStateRule ? (
                  <div className="border rounded-lg p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold">{selectedStateRule.stateName}</h3>
                      <div className="flex gap-2">
                        {selectedStateRule.ronAllowed ? (
                          <Badge className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            RON Allowed
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <X className="h-3 w-3 mr-1" />
                            No RON
                          </Badge>
                        )}
                        {selectedStateRule.inPersonAllowed && (
                          <Badge variant="outline">
                            <User className="h-3 w-3 mr-1" />
                            In-Person
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <p className="font-medium">Max Notary Fee</p>
                        </div>
                        <p className="text-2xl font-bold">
                          ${selectedStateRule.maxNotaryFee.toFixed(2)}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="h-4 w-4 text-blue-600" />
                          <p className="font-medium">Journal Required</p>
                        </div>
                        <p className="text-2xl font-bold">
                          {selectedStateRule.journalRequired ? "Yes" : "No"}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Stamp className="h-4 w-4 text-purple-600" />
                          <p className="font-medium">Seal Required</p>
                        </div>
                        <p className="text-2xl font-bold">
                          {selectedStateRule.sealRequired ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Accepted ID Types
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedStateRule.idRequirements.map((id, idx) => (
                          <Badge key={idx} variant="secondary">
                            {id}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {selectedStateRule.additionalNotes && (
                      <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 rounded-r-lg">
                        <p className="font-medium mb-1">Additional Notes</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedStateRule.additionalNotes}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a state to view notarization rules</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
