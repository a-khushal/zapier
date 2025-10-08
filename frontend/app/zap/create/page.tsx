"use client"

import React, { useCallback, useState, useEffect } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';
import WorkflowNode from '@/components/WorkflowNode';
import Modal, { ModalItem } from '@/components/Modal';
import { useAuth } from '@/hooks/useAuth';

const nodeTypes = { workflowNode: WorkflowNode };

const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    type: 'default',
    style: { stroke: '#9ca3af', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' },
  },
];

function App() {
  useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(6);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('Select an App');

  const apps = [
    { id: '1', title: 'Google Calendar', icon: 'https://www.google.com/s2/favicons?sz=64&domain=calendar.google.com' },
    { id: '2', title: 'Slack', icon: 'https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png' },
    { id: '3', title: 'Notion', icon: 'https://www.notion.so/images/favicon.ico' },
  ];

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setModalTitle(nodeId === '1' ? 'Select a Trigger' : 'Select an Action');
    setIsModalOpen(true);
  };

  const handleSelect = (app: typeof apps[0]) => {
    if (!selectedNodeId) return;

    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNodeId
          ? {
            ...node,
            data: {
              ...node.data,
              icon: app.icon,
              title: app.title,
            },
          }
          : node
      )
    );

    setModalTitle(app.title);
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
      id: '1',
      type: 'workflowNode',
      position: {
        x: window.innerWidth / 2 - nodeWidth / 2,
        y: window.innerHeight / 2 - (nodeHeight / 2) * 8.32,
      },
      data: {
        icon: 'trigger',
        title: 'Trigger',
        subtitle: '1. Select the trigger for your Zap to run',
        type: 'trigger',
        onAddNode: null,
        onDeleteNode: null,
        isWorkflowRoot: true,
      },
    };
    setNodes([centerNode]);
  }, []);

  const addNodeAfter = useCallback((afterNodeId: string) => {
    setNodes((nds: Node[]) => {
      const afterNode = nds.find((n) => n.id === afterNodeId);
      if (!afterNode) return nds;
      const afterNodeIndex = nds.findIndex((n) => n.id === afterNodeId);
      const nodesAfter = nds.slice(afterNodeIndex + 1);
      const newNodeId = `${nodeIdCounter}`;
      setNodeIdCounter((c) => c + 1);
      const newNode: Node = {
        id: newNodeId,
        type: 'workflowNode',
        position: { x: afterNode.position.x, y: afterNode.position.y + 170 },
        data: {
          icon: 'action',
          title: 'Action',
          subtitle: `${afterNodeIndex + 2}. Select the event for your Zap to run`,
          type: 'action',
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
          data: { ...node.data, subtitle: node.data.subtitle.replace(/^\d+\./, `${nodeIndex + 1}.`) },
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
          { id: `e${afterNodeId}-${newNodeId}`, source: afterNodeId, target: newNodeId, type: 'default', style: { stroke: '#9ca3af', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' } },
          { id: `e${newNodeId}-${edgeToRemove.target}`, source: newNodeId, target: edgeToRemove.target, type: 'default', style: { stroke: '#9ca3af', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' } }
        );
        return newEdges;
      } else {
        return [...eds, { id: `e${afterNodeId}-${newNodeId}`, source: afterNodeId, target: newNodeId, type: 'default', style: { stroke: '#9ca3af', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' } }];
      }
    });
  }, [nodeIdCounter, setNodes, setEdges]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds: Node[]) => {
      const nodeIndex = nds.findIndex((n) => n.id === nodeId);
      if (nodeIndex === -1) return nds;
      const updatedNodes = nds.filter((n) => n.id !== nodeId);
      const nodesWithUpdatedPositions = updatedNodes.map((node, idx) => {
        if (idx === 0) return node;
        const shouldMoveUp = idx >= nodeIndex;
        return { ...node, position: { ...node.position, y: shouldMoveUp ? node.position.y - 170 : node.position.y } };
      });
      return nodesWithUpdatedPositions.map((node, idx) => {
        if (idx === 0) return node;
        const stepNumber = idx + 1;
        return { ...node, data: { ...node.data, subtitle: node.data.subtitle.replace(/^\d+\./, `${stepNumber}.`) } };
      });
    });

    setEdges((eds) => {
      const incomingEdge = eds.find((e) => e.target === nodeId);
      const outgoingEdge = eds.find((e) => e.source === nodeId);
      let newEdges = eds.filter((e) => e.source !== nodeId && e.target !== nodeId);
      if (incomingEdge && outgoingEdge) {
        const connectingEdge = { id: `e${incomingEdge.source}-${outgoingEdge.target}`, source: incomingEdge.source, target: outgoingEdge.target, type: 'default', style: { stroke: '#9ca3af', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' } };
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
        setSelectedNodeId(nodeId);
        setModalTitle('Confirm Deletion');
        setIsModalOpen(true);
      },
      onClick: handleNodeClick,
      isSelected: node.id === selectedNodeId
    },
    selected: node.id === selectedNodeId
  }));

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#f0f0f0', position: 'relative', overflow: 'hidden' }}>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {apps.map((app) => (
              <ModalItem key={app.id} title={app.title} icon={app.icon} onClick={() => handleSelect(app)} />
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default App;
