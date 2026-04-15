"use client";

import React, { useCallback, useState, useEffect } from "react";
import axios from "axios";
import ReactFlow, {
  Node,
  BackgroundVariant,
  Edge,
  addEdge,
  Background,
  Controls,
  Connection,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import WorkflowNode from "@/components/WorkflowNode";
import Modal, { ModalItem } from "@/components/Modal";
import JsonPayloadModal from "@/components/JsonPayloadModal";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/hooks/useAuth";
import { useTriggerAction, TriggerActionRes as BaseTriggerActionRes } from "@/hooks/useTriggerAction";
import { useCreateZap } from "@/hooks/useCreateZap";
import { BACKEND_URL } from "@/config";

type TriggerActionRes = BaseTriggerActionRes & {
  nodeId?: string;
  actionMetadata?: Record<string, unknown>;
};

type ActionTestResult = {
  isLoading: boolean;
  requestPreview?: any;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
};

type PostWebhookHeader = {
  key: string;
  value: string;
};

type PostWebhookMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type PostWebhookMetadata = {
  url: string;
  method: PostWebhookMethod;
  headers: PostWebhookHeader[];
  bodyTemplate?: string;
};

const NODE_VERTICAL_GAP = 170;

const ALLOWED_METHODS: PostWebhookMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getDefaultPostWebhookMetadata(): PostWebhookMetadata {
  return {
    url: "",
    method: "POST",
    headers: [],
    bodyTemplate: "",
  };
}

function getPostWebhookMetadata(
  actionMetadata: Record<string, unknown> | undefined
): PostWebhookMetadata {
  const base = getDefaultPostWebhookMetadata();
  if (!actionMetadata || typeof actionMetadata !== "object") {
    return base;
  }

  const raw = actionMetadata as any;
  const method = ALLOWED_METHODS.includes(raw.method) ? raw.method : "POST";
  const headers: PostWebhookHeader[] = Array.isArray(raw.headers)
    ? raw.headers.map((header: any) => ({
      key: String(header?.key || ""),
      value: String(header?.value || ""),
    }))
    : [];
  return {
    url: typeof raw.url === "string" ? raw.url : base.url,
    method,
    headers,
    bodyTemplate: typeof raw.bodyTemplate === "string" ? raw.bodyTemplate : base.bodyTemplate,
  };
}

const nodeTypes = { workflowNode: WorkflowNode };

function normalizeActionNodesLayout(nodes: Node[]) {
  if (nodes.length === 0) {
    return nodes;
  }

  const root = nodes[0];
  const baseY = root.position.y;

  return nodes.map((node, index) => {
    if (index === 0) {
      return node;
    }

    const stepNumber = index + 1;
    return {
      ...node,
      position: {
        ...node.position,
        y: baseY + NODE_VERTICAL_GAP * index,
      },
      data: {
        ...node.data,
        subtitle: String(node.data.subtitle || "").replace(/^\d+\./, `${stepNumber}.`),
      },
    };
  });
}

const initialEdges: Edge[] = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    type: "default",
    style: { stroke: "#d1d5db", strokeWidth: 1.2 },
    markerEnd: undefined,
    markerStart: undefined,
  },
];

function App() {
  useAuth();
  const { showToast } = useToast();
  const { loading, availableTriggers, availableActions } = useTriggerAction();
  const { createZap, isLoading: isPublishing } = useCreateZap();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(6);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState("Select an App");
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerActionRes | null>(null);
  const [selectedActions, setSelectedActions] = useState<TriggerActionRes[]>([]);
  const [actionTestResults, setActionTestResults] = useState<Record<string, ActionTestResult>>({});
  const [isActionConfigOpen, setIsActionConfigOpen] = useState(false);
  const [isTestPayloadModalOpen, setIsTestPayloadModalOpen] = useState(false);
  const [testPayloadInput, setTestPayloadInput] = useState('{"name":"Alice","event":"signup"}');
  const [pendingTestAction, setPendingTestAction] = useState<TriggerActionRes | null>(null);
  const [isTestingAction, setIsTestingAction] = useState(false);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
  const [disabledActionNodeIds, setDisabledActionNodeIds] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const markDirty = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  const isNodeDisabled = useCallback(
    (nodeId: string | null | undefined) => {
      if (!nodeId) {
        return false;
      }
      return disabledActionNodeIds.includes(String(nodeId));
    },
    [disabledActionNodeIds]
  );

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);

    if (nodeId === "1") {
      setModalTitle("Select a Trigger");
      setIsActionConfigOpen(false);
      setIsModalOpen(true);
      return;
    }

    const existingAction = selectedActions.find((action) => action.nodeId === nodeId);
    if (existingAction?.id === "post_webhook") {
      setIsModalOpen(false);
      setIsActionConfigOpen(true);
      return;
    }

    setModalTitle("Select an Action");
    setIsActionConfigOpen(false);
    setIsModalOpen(true);
  };

  const handleSelect = (app: BaseTriggerActionRes) => {
    if (!selectedNodeId) {
      return;
    }

    markDirty();

    if (selectedNodeId === '1') {
      setSelectedTrigger(app);
    } else {
      let actionMetadata: Record<string, unknown> | undefined = undefined;

      if (app.id === "post_webhook") {
        const existing = selectedActions.find(
          (action) => action.nodeId === selectedNodeId && action.id === "post_webhook"
        );
        actionMetadata = existing?.actionMetadata || getDefaultPostWebhookMetadata();
      }

      setSelectedActions(prev => {
        const nextAction = { ...app, nodeId: selectedNodeId, actionMetadata };
        const existingIndex = prev.findIndex(a => a.nodeId === selectedNodeId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = nextAction;
          return updated;
        }
        return [...prev, nextAction];
      });
    }

    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNodeId
          ? {
            ...node,
            data: {
              ...node.data,
              icon: app.image,
              title: app.name,
              appId: app.id,
            },
          }
          : node
      )
    );

    setModalTitle(app.name);
    setIsModalOpen(false);
    setIsActionConfigOpen(app.id === "post_webhook");
  };

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds: Edge[]) =>
        addEdge(
          {
            ...params,
            markerEnd: undefined,
            markerStart: undefined,
            style: { stroke: "#d1d5db", strokeWidth: 1.2 },
          },
          eds
        )
      ),
    [setEdges]
  );

  useEffect(() => {
    const nodeWidth = 250;
    const nodeHeight = 100;
    const centerNode: Node = {
      id: "1",
      type: "workflowNode",
      position: {
        x: window.innerWidth / 2 - nodeWidth / 2,
        y: window.innerHeight / 2 - (nodeHeight / 2) * 8.32,
      },
      data: {
        icon: "trigger",
        title: "Trigger",
        subtitle: "1. Select the trigger for your Zap to run",
        type: "trigger",
        onAddNode: null,
        onDeleteNode: null,
        isWorkflowRoot: true,
      },
    };
    setNodes([centerNode]);
  }, []);

  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        markerEnd: undefined,
        markerStart: undefined,
      }))
    );
  }, [setEdges]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const addNodeAfter = useCallback(
    (afterNodeId: string, sourceAction?: TriggerActionRes | null) => {
      markDirty();
      setNodes((nds: Node[]) => {
        const afterNode = nds.find((n) => n.id === afterNodeId);
        if (!afterNode) {
          return nds;
        }

        const afterNodeIndex = nds.findIndex((n) => n.id === afterNodeId);
        const nodesAfter = nds.slice(afterNodeIndex + 1);
        const newNodeId = `${nodeIdCounter}`;
        setNodeIdCounter((c) => c + 1);
        const newNode: Node = {
          id: newNodeId,
          type: "workflowNode",
          position: { x: afterNode.position.x, y: afterNode.position.y + NODE_VERTICAL_GAP },
          data: {
            icon: sourceAction?.image || "action",
            title: sourceAction?.name || "Action",
            subtitle: `${afterNodeIndex + 2}. Select the event for your Zap to run`,
            type: "action",
            appId: sourceAction?.id,
          },
        };
        const updatedNodes = [...nds.slice(0, afterNodeIndex + 1), newNode];
        nodesAfter.forEach((node, idx) => {
          const nodeIndex = afterNodeIndex + 2 + idx;
          updatedNodes.push({
            ...node,
            position: { ...node.position, y: node.position.y + NODE_VERTICAL_GAP },
            data: {
              ...node.data,
              subtitle: node.data.subtitle.replace(/^\d+\./, `${nodeIndex + 1}.`),
            },
          });
        });
        return normalizeActionNodesLayout(updatedNodes);
      });

      const newNodeId = `${nodeIdCounter}`;
      setEdges((eds: Edge[]) => {
        const edgeToRemove = eds.find((e) => e.source === afterNodeId);
        if (edgeToRemove) {
          const newEdges = eds.filter((e) => e.source !== afterNodeId);
          newEdges.push(
            {
              id: `e${afterNodeId}-${newNodeId}`,
              source: afterNodeId,
              target: newNodeId,
              type: "default",
              style: { stroke: "#d1d5db", strokeWidth: 1.2 },
            },
            {
              id: `e${newNodeId}-${edgeToRemove.target}`,
              source: newNodeId,
              target: edgeToRemove.target,
              type: "default",
              style: { stroke: "#d1d5db", strokeWidth: 1.2 },
            }
          );
          return newEdges;
        } else {
          return [
            ...eds,
            {
              id: `e${afterNodeId}-${newNodeId}`,
              source: afterNodeId,
              target: newNodeId,
              type: "default",
              style: { stroke: "#d1d5db", strokeWidth: 1.2 },
            },
          ];
        }
      });

      if (sourceAction && sourceAction.id) {
        setSelectedActions((prev) => {
          const sourceIndex = prev.findIndex((action) => action.nodeId === afterNodeId);
          const duplicatedAction: TriggerActionRes = {
            ...sourceAction,
            nodeId: newNodeId,
            actionMetadata: sourceAction.actionMetadata
              ? JSON.parse(JSON.stringify(sourceAction.actionMetadata))
              : sourceAction.actionMetadata,
          };

          if (sourceIndex === -1) {
            return [...prev, duplicatedAction];
          }

          const next = [...prev];
          next.splice(sourceIndex + 1, 0, duplicatedAction);
          return next;
        });
      }
    },
    [markDirty, nodeIdCounter, setEdges, setNodes]
  );

  const deleteNode = useCallback((nodeId: string) => {
    markDirty();
    setNodes((nds: Node[]) => {
      const nodeIndex = nds.findIndex((n) => n.id === nodeId);
      if (nodeIndex === -1) return nds;
      const updatedNodes = nds.filter((n) => n.id !== nodeId);
      const nodesWithUpdatedPositions = updatedNodes.map((node, idx) => {
        if (idx === 0) return node;
        const shouldMoveUp = idx >= nodeIndex;
        return {
          ...node,
          position: {
            ...node.position,
            y: shouldMoveUp ? node.position.y - NODE_VERTICAL_GAP : node.position.y,
          },
        };
      });
      return normalizeActionNodesLayout(nodesWithUpdatedPositions.map((node, idx) => {
        if (idx === 0) return node;
        const stepNumber = idx + 1;
        return {
          ...node,
          data: {
            ...node.data,
            subtitle: node.data.subtitle.replace(/^\d+\./, `${stepNumber}.`),
          },
        };
      }));
    });

    const normalizedNodeId = String(nodeId);
    setDisabledActionNodeIds((prev) => prev.filter((id) => id !== normalizedNodeId));
    setSelectedActions((prev) => prev.filter((action) => action.nodeId !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
      setIsActionConfigOpen(false);
    }

    setEdges((eds) => {
      const incomingEdge = eds.find((e) => e.target === nodeId);
      const outgoingEdge = eds.find((e) => e.source === nodeId);
      let newEdges = eds.filter((e) => e.source !== nodeId && e.target !== nodeId);
      if (incomingEdge && outgoingEdge) {
        const connectingEdge = {
          id: `e${incomingEdge.source}-${outgoingEdge.target}`,
          source: incomingEdge.source,
          target: outgoingEdge.target,
          type: "default",
          style: { stroke: "#d1d5db", strokeWidth: 1.2 },
        };
        return [...newEdges, connectingEdge];
      }
      return newEdges;
    });
  }, [markDirty, selectedNodeId]);

  const moveActionNode = useCallback((nodeId: string, direction: "up" | "down") => {
    markDirty();

    setNodes((nds) => {
      const index = nds.findIndex((node) => node.id === nodeId);
      if (index <= 0) {
        return nds;
      }

      const swapWith = direction === "up" ? index - 1 : index + 1;
      if (swapWith <= 0 || swapWith >= nds.length) {
        return nds;
      }

      const next = [...nds];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      const nextChain = next.map((node) => node.id);
      setEdges(
        nextChain.slice(0, -1).map((sourceId, idx) => ({
          id: `e${sourceId}-${nextChain[idx + 1]}`,
          source: sourceId,
          target: nextChain[idx + 1],
          type: "default",
          style: { stroke: "#d1d5db", strokeWidth: 1.2 },
        }))
      );

      return normalizeActionNodesLayout(next);
    });
  }, [markDirty, setEdges]);

  const duplicateActionNode = useCallback((nodeId: string) => {
    const actionToDuplicate = selectedActions.find((action) => action.nodeId === nodeId) || null;
    addNodeAfter(nodeId, actionToDuplicate);
  }, [addNodeAfter, selectedActions]);

  const toggleActionNodeEnabled = useCallback((nodeId: string) => {
    markDirty();
    const normalizedNodeId = String(nodeId);
    setDisabledActionNodeIds((prev) => (
      prev.includes(normalizedNodeId)
        ? prev.filter((id) => id !== normalizedNodeId)
        : [...prev, normalizedNodeId]
    ));
  }, [markDirty]);

  const actionNodeIds = nodes.filter((node) => node.id !== "1").map((node) => node.id);

  const nodesWithCallbacks = nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: {
      ...node.data,
      onAddNode: addNodeAfter,
      onDeleteNode: deleteNode,
      onDuplicateNode: duplicateActionNode,
      onMoveUp: (nodeId: string) => moveActionNode(nodeId, "up"),
      onMoveDown: (nodeId: string) => moveActionNode(nodeId, "down"),
      onToggleEnabled: toggleActionNodeEnabled,
      onDeleteClick: (nodeId: string) => {
        deleteNode(nodeId);
      },
      onClick: handleNodeClick,
      isSelected: node.id === selectedNodeId,
      isDisabled: isNodeDisabled(node.id),
      isFirstAction: node.id !== "1" && actionNodeIds[0] === node.id,
      isLastAction: node.id !== "1" && actionNodeIds[actionNodeIds.length - 1] === node.id,
    },
    selected: node.id === selectedNodeId,
  }));

  const items = selectedNodeId === "1" ? availableTriggers : availableActions;

  const updatePostWebhookMetadata = (
    nodeId: string,
    updater: (current: PostWebhookMetadata) => PostWebhookMetadata
  ) => {
    markDirty();
    setSelectedActions((prev) =>
      prev.map((action) => {
        if (action.nodeId !== nodeId || action.id !== "post_webhook") {
          return action;
        }

        const nextMetadata = updater(getPostWebhookMetadata(action.actionMetadata));
        return {
          ...action,
          actionMetadata: nextMetadata,
        };
      })
    );
  };

  const handleTestAction = (action: TriggerActionRes) => {
    if (action.id !== "post_webhook") {
      showToast({ type: "info", title: "Test Action is only available for post_webhook" });
      return;
    }

    if (!action.actionMetadata) {
      showToast({ type: "error", title: "Configure this action first" });
      return;
    }

    const normalizedMetadata = getPostWebhookMetadata(action.actionMetadata);
    if (!normalizedMetadata.url.trim()) {
      showToast({ type: "error", title: "Webhook URL is required" });
      return;
    }

    if (!isValidHttpUrl(normalizedMetadata.url.trim())) {
      showToast({ type: "error", title: "Webhook URL must be a valid http/https URL" });
      return;
    }

    setPendingTestAction(action);
    setTestPayloadInput('{"name":"Alice","event":"signup"}');
    setIsTestPayloadModalOpen(true);
  };

  const runPendingTestAction = async () => {
    if (!pendingTestAction) {
      return;
    }

    if (!testPayloadInput.trim()) {
      showToast({ type: "error", title: "Sample payload is required" });
      return;
    }

    let samplePayload: any;
    try {
      samplePayload = JSON.parse(testPayloadInput);
    } catch {
      showToast({ type: "error", title: "Invalid sample payload JSON" });
      return;
    }

    const normalizedMetadata = getPostWebhookMetadata(pendingTestAction.actionMetadata);
    const testKey = pendingTestAction.nodeId || pendingTestAction.id;
    setIsTestingAction(true);
    setActionTestResults((prev) => ({
      ...prev,
      [testKey]: { isLoading: true },
    }));

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await axios.post(
        `${BACKEND_URL}/api/v1/zap/test-post-webhook`,
        {
          actionMetadata: normalizedMetadata,
          samplePayload,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
          },
        }
      );

      setActionTestResults((prev) => ({
        ...prev,
        [testKey]: {
          isLoading: false,
          requestPreview: response.data.requestPreview,
          responseStatus: response.data.responseStatus,
          responseBody: response.data.responseBody,
          error: response.data.error,
        },
      }));
      setIsTestPayloadModalOpen(false);
      showToast({
        type: response.data.ok ? "success" : "error",
        title: response.data.ok ? "Action test completed" : "Action test failed",
        description: typeof response.data.responseStatus === "number" ? `HTTP ${response.data.responseStatus}` : undefined,
      });
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Failed to test action";
      setActionTestResults((prev) => ({
        ...prev,
        [testKey]: {
          isLoading: false,
          error: message,
        },
      }));
      showToast({ type: "error", title: "Failed to test action", description: message });
    } finally {
      setIsTestingAction(false);
    }
  };

  const handlePublish = () => {
    if (!selectedTrigger) {
      showToast({ type: "error", title: "Please select a trigger first" });
      return;
    }

      const enabledActionsCount = selectedActions.filter((action) => {
        const nodeId = action.nodeId || "";
        return nodeId && !isNodeDisabled(nodeId);
      }).length;

    if (enabledActionsCount === 0) {
      showToast({ type: "error", title: "Please add at least one enabled action" });
      return;
    }

    setIsPublishConfirmOpen(true);
  };

  const confirmPublish = async () => {
    setIsPublishConfirmOpen(false);

    if (!selectedTrigger) {
      showToast({ type: "error", title: "Please select a trigger first" });
      return;
    }

    try {
      const orderedActions = nodes
        .filter((node) => node.id !== "1")
        .map((node) => selectedActions.find((action) => action.nodeId === node.id))
        .filter((action): action is TriggerActionRes => Boolean(action));

      const enabledActions = orderedActions.filter((action) => {
        const nodeId = action.nodeId || "";
        return nodeId && !isNodeDisabled(nodeId);
      });

      if (enabledActions.length === 0) {
        showToast({ type: "error", title: "Please add at least one enabled action" });
        return;
      }

      for (const action of enabledActions) {
        if (action.id !== "post_webhook") {
          continue;
        }

        const metadata = getPostWebhookMetadata(action.actionMetadata);
        if (!metadata.url.trim()) {
          showToast({ type: "error", title: `Step ${action.nodeId || "-"}: URL is required` });
          return;
        }

        if (!isValidHttpUrl(metadata.url.trim())) {
          showToast({ type: "error", title: `Step ${action.nodeId || "-"}: URL must be a valid http/https URL` });
          return;
        }
      }

      const zapData = {
        availableTriggerId: selectedTrigger.id,
        actions: enabledActions.map(action => ({
          availableActionId: action.id,
          actionMetadata:
            action.id === "post_webhook"
              ? getPostWebhookMetadata(action.actionMetadata)
              : action.actionMetadata
        }))
      };
      await createZap(zapData);
      setHasUnsavedChanges(false);
      showToast({ type: "success", title: "Zap created successfully" });
    } catch (error) {
      console.error('Failed to create Zap:', error);
      showToast({ type: "error", title: "Failed to create Zap", description: "Please try again." });
    }
  };

  const allNodesHaveApps = nodes.every(node => {
    if (node.id === '1') {
      return !!selectedTrigger;
    }

    return selectedActions.some(action => node.data.appId === action.id);
  });

  const enabledActionsCount = selectedActions.filter((action) => {
    const nodeId = action.nodeId || "";
    return nodeId && !isNodeDisabled(nodeId);
  }).length;

  const canPublish = selectedTrigger && enabledActionsCount > 0 && allNodesHaveApps;
  const activeConfigAction =
    selectedNodeId
      ? selectedActions.find(
        (action) => action.nodeId === selectedNodeId && action.id === "post_webhook"
      ) || null
      : null;
  const activeConfigMetadata = activeConfigAction
    ? getPostWebhookMetadata(activeConfigAction.actionMetadata)
    : null;
  const activeTestKey = activeConfigAction
    ? activeConfigAction.nodeId || activeConfigAction.id
    : null;
  const activeTestResult = activeTestKey ? actionTestResults[activeTestKey] : undefined;
  const isActiveConfigDisabled = !!activeConfigAction?.nodeId && isNodeDisabled(String(activeConfigAction.nodeId));
  const canTestActiveConfig =
    !!activeConfigMetadata &&
    activeConfigMetadata.url.trim().length > 0 &&
    isValidHttpUrl(activeConfigMetadata.url.trim()) &&
    !isActiveConfigDisabled;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#f6f7fb",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        className="bg-transparent"
        nodesDraggable={false}
        panOnDrag={[0, 1, 2]}
        onPaneClick={(e) => e.preventDefault()}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        panOnScroll={false}
        minZoom={0.5}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        defaultEdgeOptions={{
          markerEnd: undefined,
          markerStart: undefined,
          style: { stroke: "#d1d5db", strokeWidth: 1.2 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} color="#d8dde6" gap={18} size={1} />
        <Controls />
      </ReactFlow>

      <div className="fixed right-10 z-50" style={{ top: 'calc(1rem + 28px + 2px + 2rem)' }}>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
              Unsaved changes
            </span>
          )}
          <button
            onClick={handlePublish}
            disabled={!canPublish || isPublishing}
            className={`px-4 py-2 rounded-full font-medium shadow-sm transition-all ${!canPublish || isPublishing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-[#ff5a1f] hover:bg-[#ef4e14] text-white'
              }`}
          >
            {isPublishing ? 'Publishing...' : 'Publish Zap'}
          </button>
        </div>
      </div>

      {isActionConfigOpen && activeConfigAction && activeConfigMetadata && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setIsActionConfigOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-lg border border-gray-200 bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Configure Step {activeConfigAction.nodeId || "-"}: {activeConfigAction.name}
              </h3>
              <button
                onClick={() => setIsActionConfigOpen(false)}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              {isActiveConfigDisabled && (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  This step is disabled and will not run on publish.
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600">URL</label>
                <input
                  type="text"
                  value={activeConfigMetadata.url}
                  onChange={(e) =>
                    updatePostWebhookMetadata(String(activeConfigAction.nodeId), (current) => ({
                      ...current,
                      url: e.target.value,
                    }))
                  }
                  placeholder="https://example.com/webhook"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
              </div>

              <div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">Method</label>
                  <select
                    value={activeConfigMetadata.method}
                    onChange={(e) =>
                      updatePostWebhookMetadata(String(activeConfigAction.nodeId), (current) => ({
                        ...current,
                        method: e.target.value as PostWebhookMethod,
                      }))
                    }
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    {ALLOWED_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">Headers</label>
                <div className="mt-1 space-y-1">
                  {activeConfigMetadata.headers.map((header, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={header.key}
                        onChange={(e) =>
                          updatePostWebhookMetadata(String(activeConfigAction.nodeId), (current) => {
                            const nextHeaders = [...current.headers];
                            nextHeaders[index] = {
                              ...nextHeaders[index],
                              key: e.target.value,
                            };
                            return {
                              ...current,
                              headers: nextHeaders,
                            };
                          })
                        }
                        placeholder="Key"
                        className="w-[45%] rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                      <input
                        type="text"
                        value={header.value}
                        onChange={(e) =>
                          updatePostWebhookMetadata(String(activeConfigAction.nodeId), (current) => {
                            const nextHeaders = [...current.headers];
                            nextHeaders[index] = {
                              ...nextHeaders[index],
                              value: e.target.value,
                            };
                            return {
                              ...current,
                              headers: nextHeaders,
                            };
                          })
                        }
                        placeholder="Value"
                        className="w-[45%] rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() =>
                          updatePostWebhookMetadata(String(activeConfigAction.nodeId), (current) => ({
                            ...current,
                            headers: current.headers.filter((_, headerIndex) => headerIndex !== index),
                          }))
                        }
                        className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-sm leading-none text-gray-500 hover:border-red-300 hover:text-red-500"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    updatePostWebhookMetadata(String(activeConfigAction.nodeId), (current) => ({
                      ...current,
                      headers: [...current.headers, { key: "", value: "" }],
                    }))
                  }
                  className="mt-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  + Add Header
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">Body Template (JSON)</label>
                <textarea
                  rows={4}
                  value={activeConfigMetadata.bodyTemplate || ""}
                  onChange={(e) =>
                    updatePostWebhookMetadata(String(activeConfigAction.nodeId), (current) => ({
                      ...current,
                      bodyTemplate: e.target.value,
                    }))
                  }
                  placeholder='{"name":"{{payload.name}}","event":"{{payload.event}}"}'
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleTestAction(activeConfigAction)}
                  disabled={!canTestActiveConfig || activeTestResult?.isLoading}
                  className={`rounded px-3 py-1 text-xs font-medium ${canTestActiveConfig && !activeTestResult?.isLoading
                    ? "bg-[#ff4f00] text-white hover:bg-[#ff4f00]/90"
                    : "cursor-not-allowed bg-gray-300 text-gray-600"
                    }`}
                >
                  {activeTestResult?.isLoading ? "Testing..." : "Test Action"}
                </button>
              </div>
            </div>

            {activeTestResult && !activeTestResult.isLoading && (
              <div className="mt-3 rounded bg-gray-50 p-2 text-xs text-gray-700">
                {activeTestResult.requestPreview && (
                  <p>
                    <span className="font-semibold">Request:</span>{" "}
                    {JSON.stringify(activeTestResult.requestPreview)}
                  </p>
                )}
                {typeof activeTestResult.responseStatus === "number" && (
                  <p>
                    <span className="font-semibold">Response Status:</span>{" "}
                    {activeTestResult.responseStatus}
                  </p>
                )}
                {typeof activeTestResult.responseBody === "string" && (
                  <p>
                    <span className="font-semibold">Response Body:</span>{" "}
                    {activeTestResult.responseBody.slice(0, 300)}
                  </p>
                )}
                {activeTestResult.error && (
                  <p className="text-red-600">
                    <span className="font-semibold">Error:</span> {activeTestResult.error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle} loading={loading}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items?.map((app) => (
              <ModalItem
                key={app.id}
                title={app.name}
                icon={app.image}
                onClick={() => handleSelect(app)}
              />
            ))}
          </div>
        </div>
      </Modal>

      <JsonPayloadModal
        isOpen={isTestPayloadModalOpen}
        title="Test Action Payload"
        description="Enter sample JSON payload to test this action."
        value={testPayloadInput}
        confirmLabel="Run Test"
        isSubmitting={isTestingAction}
        onChange={setTestPayloadInput}
        onClose={() => setIsTestPayloadModalOpen(false)}
        onConfirm={runPendingTestAction}
      />

      <ConfirmModal
        isOpen={isPublishConfirmOpen}
        title="Publish this Zap?"
        description="This will make your Zap active and ready to receive trigger events."
        confirmLabel="Publish"
        isSubmitting={isPublishing}
        onCancel={() => setIsPublishConfirmOpen(false)}
        onConfirm={confirmPublish}
      />
    </div>
  );
}

export default App;
