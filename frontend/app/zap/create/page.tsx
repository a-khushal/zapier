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
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import WorkflowNode from "@/components/WorkflowNode";
import Modal, { ModalItem } from "@/components/Modal";
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

const nodeTypes = { workflowNode: WorkflowNode };

const initialEdges: Edge[] = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    type: "default",
    style: { stroke: "#9ca3af", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#9ca3af" },
  },
];

function App() {
  useAuth();
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

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setModalTitle(nodeId === "1" ? "Select a Trigger" : "Select an Action");
    setIsModalOpen(true);
  };

  const handleSelect = (app: BaseTriggerActionRes) => {
    if (!selectedNodeId) {
      return;
    }

    if (selectedNodeId === '1') {
      setSelectedTrigger(app);
    } else {
      let actionMetadata: Record<string, unknown> | undefined = undefined;

      if (app.id === "post_webhook") {
        const url = window.prompt("Enter destination webhook URL");
        if (!url || !url.trim()) {
          alert("Webhook URL is required for POST webhook action");
          return;
        }

        const methodInput = window.prompt(
          "HTTP method? (GET, POST, PUT, PATCH, DELETE)",
          "POST"
        );
        const method = (methodInput || "POST").toUpperCase();
        const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
        if (!allowedMethods.includes(method)) {
          alert("Invalid method selected");
          return;
        }

        const headersInput = window.prompt(
          "Headers as JSON array (optional), e.g. [{\"key\":\"Authorization\",\"value\":\"Bearer token\"}]",
          "[]"
        );

        let headers: { key: string; value: string }[] = [];
        if (headersInput && headersInput.trim()) {
          try {
            const parsedHeaders = JSON.parse(headersInput);
            if (!Array.isArray(parsedHeaders)) {
              throw new Error("Headers should be an array");
            }
            headers = parsedHeaders;
          } catch {
            alert("Invalid headers JSON");
            return;
          }
        }

        const bodyTemplateInput = window.prompt(
          "Body template JSON (optional). Use placeholders like {{payload.name}}",
          ""
        );

        const timeoutInput = window.prompt(
          "Timeout in ms (optional, 1000-30000). Leave empty for default 10000",
          ""
        );

        let timeoutMs: number | undefined = undefined;
        if (timeoutInput && timeoutInput.trim()) {
          const parsedTimeout = Number(timeoutInput.trim());
          if (!Number.isInteger(parsedTimeout) || parsedTimeout < 1000 || parsedTimeout > 30000) {
            alert("Timeout must be an integer between 1000 and 30000");
            return;
          }
          timeoutMs = parsedTimeout;
        }

        let auth: Record<string, unknown> = { type: "none" };
        const shouldAddApiKey = window.prompt(
          "Add API key auth? (yes/no)",
          "no"
        );
        if ((shouldAddApiKey || "no").toLowerCase() === "yes") {
          const key = window.prompt("API key name");
          const value = window.prompt("API key value");
          const addToInput = window.prompt("Add API key to? (header or query)", "header");
          const addTo = (addToInput || "header").toLowerCase();
          if (!key || !key.trim() || !value || !value.trim()) {
            alert("API key name and value are required");
            return;
          }
          if (addTo !== "header" && addTo !== "query") {
            alert("Add API key to must be header or query");
            return;
          }
          auth = {
            type: "api_key",
            key: key.trim(),
            value: value.trim(),
            addTo,
          };
        }

        actionMetadata = {
          url: url.trim(),
          method,
          headers,
          bodyTemplate: bodyTemplateInput?.trim() || undefined,
          timeoutMs,
          auth,
        };
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
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds: Edge[]) => addEdge(params, eds)),
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

  const addNodeAfter = useCallback(
    (afterNodeId: string) => {
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
          position: { x: afterNode.position.x, y: afterNode.position.y + 170 },
          data: {
            icon: "action",
            title: "Action",
            subtitle: `${afterNodeIndex + 2}. Select the event for your Zap to run`,
            type: "action",
            onAddNode: addNodeAfter,
            onDeleteNode: deleteNode,
          },
        };
        const updatedNodes = [...nds.slice(0, afterNodeIndex + 1), newNode];
        nodesAfter.forEach((node, idx) => {
          const nodeIndex = afterNodeIndex + 2 + idx;
          updatedNodes.push({
            ...node,
            position: { ...node.position, y: node.position.y + 170 },
            data: {
              ...node.data,
              subtitle: node.data.subtitle.replace(/^\d+\./, `${nodeIndex + 1}.`),
            },
          });
        });
        return updatedNodes;
      });

      setEdges((eds: Edge[]) => {
        const edgeToRemove = eds.find((e) => e.source === afterNodeId);
        const newNodeId = `${nodeIdCounter}`;
        if (edgeToRemove) {
          const newEdges = eds.filter((e) => e.source !== afterNodeId);
          newEdges.push(
            {
              id: `e${afterNodeId}-${newNodeId}`,
              source: afterNodeId,
              target: newNodeId,
              type: "default",
              style: { stroke: "#9ca3af", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#9ca3af" },
            },
            {
              id: `e${newNodeId}-${edgeToRemove.target}`,
              source: newNodeId,
              target: edgeToRemove.target,
              type: "default",
              style: { stroke: "#9ca3af", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#9ca3af" },
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
              style: { stroke: "#9ca3af", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#9ca3af" },
            },
          ];
        }
      });
    },
    [nodeIdCounter, setNodes, setEdges]
  );

  const deleteNode = useCallback((nodeId: string) => {
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
            y: shouldMoveUp ? node.position.y - 170 : node.position.y,
          },
        };
      });
      return nodesWithUpdatedPositions.map((node, idx) => {
        if (idx === 0) return node;
        const stepNumber = idx + 1;
        return {
          ...node,
          data: {
            ...node.data,
            subtitle: node.data.subtitle.replace(/^\d+\./, `${stepNumber}.`),
          },
        };
      });
    });

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
          style: { stroke: "#9ca3af", strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#9ca3af" },
        };
        return [...newEdges, connectingEdge];
      }
      return newEdges;
    });
  }, []);

  const nodesWithCallbacks = nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: {
      ...node.data,
      onAddNode: addNodeAfter,
      onDeleteNode: deleteNode,
      onDeleteClick: (nodeId: string) => {
        deleteNode(nodeId);
      },
      onClick: handleNodeClick,
      isSelected: node.id === selectedNodeId,
    },
    selected: node.id === selectedNodeId,
  }));

  const items = selectedNodeId === "1" ? availableTriggers : availableActions;

  const handleTestAction = async (action: TriggerActionRes) => {
    if (action.id !== "post_webhook") {
      alert("Test Action is only available for post_webhook");
      return;
    }

    if (!action.actionMetadata) {
      alert("Configure this action first");
      return;
    }

    const payloadInput = window.prompt(
      "Enter sample payload JSON for test run",
      "{\"name\":\"Alice\",\"event\":\"signup\"}"
    );

    if (!payloadInput || !payloadInput.trim()) {
      alert("Sample payload is required");
      return;
    }

    let samplePayload: any;
    try {
      samplePayload = JSON.parse(payloadInput);
    } catch {
      alert("Invalid sample payload JSON");
      return;
    }

    const testKey = action.nodeId || action.id;
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
          actionMetadata: action.actionMetadata,
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
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Failed to test action";
      setActionTestResults((prev) => ({
        ...prev,
        [testKey]: {
          isLoading: false,
          error: message,
        },
      }));
    }
  };

  const handlePublish = async () => {
    if (!selectedTrigger) {
      alert('Please select a trigger first');
      return;
    }

    if (selectedActions.length === 0) {
      alert('Please add at least one action');
      return;
    }

    if (!confirm('Are you sure you want to publish this Zap?')) {
      return;
    }

    try {
      const orderedActions = [...selectedActions].sort((a, b) => {
        return Number(a.nodeId || "0") - Number(b.nodeId || "0");
      });

      const zapData = {
        availableTriggerId: selectedTrigger.id,
        actions: orderedActions.map(action => ({
          availableActionId: action.id,
          actionMetadata: action.actionMetadata
        }))
      };
      await createZap(zapData);
      alert('Zap created successfully!');
    } catch (error) {
      console.error('Failed to create Zap:', error);
      alert('Failed to create Zap. Please try again.');
    }
  };

  const allNodesHaveApps = nodes.every(node => {
    if (node.id === '1') {
      return !!selectedTrigger;
    }

    return selectedActions.some(action => node.data.appId === action.id);
  });

  const canPublish = selectedTrigger && selectedActions.length > 0 && allNodesHaveApps;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#f0f0f0",
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
        className="bg-white"
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
      >
        <Background variant={BackgroundVariant.Dots} color="#d1d5db" gap={16} size={1} />
        <Controls />
      </ReactFlow>

      <div className="fixed right-10 z-50" style={{ top: 'calc(1rem + 28px + 2px + 2rem)' }}>
        <button
          onClick={handlePublish}
          disabled={!canPublish || isPublishing}
          className={`px-4 py-2 rounded-full font-medium transition-all ${!canPublish || isPublishing
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-[#ff4f00] hover:bg-[#ff4f00]/90 text-white'
            }`}
        >
          {isPublishing ? 'Publishing...' : 'Publish Zap'}
        </button>
      </div>

      <div className="fixed left-8 top-8 z-50 w-[420px] max-h-[85vh] overflow-auto rounded-lg border border-gray-200 bg-white p-4 shadow">
        <h3 className="text-sm font-semibold text-gray-800">Action Tests</h3>
        {selectedActions.length === 0 && (
          <p className="mt-2 text-xs text-gray-500">Add actions to enable pre-publish testing.</p>
        )}

        <div className="mt-3 space-y-3">
          {[...selectedActions]
            .sort((a, b) => Number(a.nodeId || "0") - Number(b.nodeId || "0"))
            .map((action) => {
              const testKey = action.nodeId || action.id;
              const testResult = actionTestResults[testKey];
              const canTest = action.id === "post_webhook" && !!action.actionMetadata;

              return (
                <div key={testKey} className="rounded border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      Step {action.nodeId || "-"}: {action.name}
                    </p>
                    <button
                      onClick={() => handleTestAction(action)}
                      disabled={!canTest || testResult?.isLoading}
                      className={`rounded px-3 py-1 text-xs font-medium ${canTest && !testResult?.isLoading
                        ? "bg-[#ff4f00] text-white hover:bg-[#ff4f00]/90"
                        : "cursor-not-allowed bg-gray-300 text-gray-600"
                        }`}
                    >
                      {testResult?.isLoading ? "Testing..." : "Test Action"}
                    </button>
                  </div>

                  {!canTest && (
                    <p className="mt-2 text-xs text-gray-500">
                      Test is available only for post_webhook with configured metadata.
                    </p>
                  )}

                  {testResult && !testResult.isLoading && (
                    <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700">
                      {testResult.requestPreview && (
                        <p>
                          <span className="font-semibold">Request:</span>{" "}
                          {JSON.stringify(testResult.requestPreview)}
                        </p>
                      )}
                      {typeof testResult.responseStatus === "number" && (
                        <p>
                          <span className="font-semibold">Response Status:</span>{" "}
                          {testResult.responseStatus}
                        </p>
                      )}
                      {typeof testResult.responseBody === "string" && (
                        <p>
                          <span className="font-semibold">Response Body:</span>{" "}
                          {testResult.responseBody.slice(0, 300)}
                        </p>
                      )}
                      {testResult.error && (
                        <p className="text-red-600">
                          <span className="font-semibold">Error:</span> {testResult.error}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

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
    </div>
  );
}

export default App;
