"use client";

import { useState, useCallback } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Save, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

// Custom node types
const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
};

function TriggerNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-green-500 text-white border-2 border-green-600">
      <div className="font-bold text-sm">Trigger</div>
      <div className="text-xs">{data.label}</div>
    </div>
  );
}

function ActionNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-blue-500 text-white border-2 border-blue-600">
      <div className="font-bold text-sm">Action</div>
      <div className="text-xs">{data.label}</div>
    </div>
  );
}

function ConditionNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-4 py-2 shadow-lg rounded-lg bg-yellow-500 text-white border-2 border-yellow-600 rotate-45">
      <div className="-rotate-45">
        <div className="font-bold text-sm">If</div>
        <div className="text-xs">{data.label}</div>
      </div>
    </div>
  );
}

const initialNodes: Node[] = [
  {
    id: "1",
    type: "trigger",
    position: { x: 250, y: 0 },
    data: { label: "Case Created" },
  },
  {
    id: "2",
    type: "action",
    position: { x: 250, y: 100 },
    data: { label: "Send Welcome Email" },
  },
  {
    id: "3",
    type: "condition",
    position: { x: 250, y: 200 },
    data: { label: "Value > $5000" },
  },
  {
    id: "4",
    type: "action",
    position: { x: 100, y: 320 },
    data: { label: "Assign to Senior" },
  },
  {
    id: "5",
    type: "action",
    position: { x: 400, y: 320 },
    data: { label: "Assign to Associate" },
  },
];

const initialEdges: Edge[] = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e2-3",
    source: "2",
    target: "3",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e3-4",
    source: "3",
    target: "4",
    label: "Yes",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: "e3-5",
    source: "3",
    target: "5",
    label: "No",
    markerEnd: { type: MarkerType.ArrowClosed },
  },
];

const triggerOptions = [
  { value: "case_created", label: "Case Created" },
  { value: "status_changed", label: "Status Changed" },
  { value: "document_uploaded", label: "Document Uploaded" },
  { value: "payment_received", label: "Payment Received" },
  { value: "deadline_approaching", label: "Deadline Approaching" },
];

const actionOptions = [
  { value: "send_email", label: "Send Email" },
  { value: "send_sms", label: "Send SMS" },
  { value: "assign_employee", label: "Assign Employee" },
  { value: "update_status", label: "Update Status" },
  { value: "create_task", label: "Create Task" },
  { value: "notify_founder", label: "Notify Founder" },
];

interface WorkflowEditorProps {
  workflowId?: string;
  onSave?: (nodes: Node[], edges: Edge[]) => void;
}

export function WorkflowEditor({ workflowId, onSave }: WorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeType, setSelectedNodeType] = useState<string>("action");

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          { ...params, markerEnd: { type: MarkerType.ArrowClosed } },
          eds
        )
      ),
    [setEdges]
  );

  const addNode = () => {
    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: selectedNodeType,
      position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
      data: {
        label:
          selectedNodeType === "trigger"
            ? "New Trigger"
            : selectedNodeType === "condition"
            ? "New Condition"
            : "New Action",
      },
    };
    setNodes((nds) => [...nds, newNode]);
    toast.success("Node added");
  };

  const handleSave = () => {
    onSave?.(nodes, edges);
    toast.success("Workflow saved");
  };

  const handleRun = () => {
    toast.info("Workflow test started");
    // Simulate running workflow
    setTimeout(() => {
      toast.success("Workflow executed successfully");
    }, 2000);
  };

  const handleClear = () => {
    setNodes([]);
    setEdges([]);
    toast.info("Canvas cleared");
  };

  return (
    <Card className="h-[700px]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Workflow Editor</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedNodeType} onValueChange={setSelectedNodeType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trigger">Trigger</SelectItem>
                <SelectItem value="action">Action</SelectItem>
                <SelectItem value="condition">Condition</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={addNode}>
              <Plus className="h-4 w-4 mr-1" />
              Add Node
            </Button>
            <Button size="sm" variant="outline" onClick={handleClear}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button size="sm" variant="outline" onClick={handleRun}>
              <Play className="h-4 w-4 mr-1" />
              Test
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-80px)] p-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-slate-50 dark:bg-slate-950"
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case "trigger":
                  return "#22c55e";
                case "action":
                  return "#3b82f6";
                case "condition":
                  return "#eab308";
                default:
                  return "#64748b";
              }
            }}
          />
        </ReactFlow>
      </CardContent>
    </Card>
  );
}
