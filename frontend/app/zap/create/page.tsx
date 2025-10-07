"use client"

import React, { useCallback, useState } from 'react';
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
import { useAuth } from '@/hooks/useAuth';

const nodeTypes = {
  workflowNode: WorkflowNode,
};

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'workflowNode',
    position: { x: 250, y: 50 },
    draggable: false,
    data: {
      icon: 'trigger',
      title: 'Trigger',
      subtitle: '1. Select the trigger for your Zap to run',
      type: 'trigger',
      onAddNode: null,
      onDeleteNode: null,
      isWorkflowRoot: true
    }
  },
];

const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    type: 'default',
    style: { stroke: '#9ca3af', strokeWidth: 2 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#9ca3af',
    },
  },
];

function App() {
  useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = useState(6);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds: Edge[]) => addEdge(params, eds)),
    [setEdges]
  );

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
        position: {
          x: 250,
          y: afterNode.position.y + 170,
        },
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
      nodesAfter.forEach((node) => {
        updatedNodes.push({
          ...node,
          position: { ...node.position, y: node.position.y + 170 },
        });
      });

      return updatedNodes;
    });

    setEdges((eds: Edge[]) => {
      const edgeToRemove = eds.find((e) => e.source === afterNodeId);
      const newNodeId = `${nodeIdCounter}`;

      if (edgeToRemove) {
        const newEdges = eds.filter((e) => e.source !== afterNodeId);
        newEdges.push({
          id: `e${afterNodeId}-${newNodeId}`,
          source: afterNodeId,
          target: newNodeId,
          type: 'default',
          style: { stroke: '#9ca3af', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#9ca3af',
          },
        });
        newEdges.push({
          id: `e${newNodeId}-${edgeToRemove.target}`,
          source: newNodeId,
          target: edgeToRemove.target,
          type: 'default',
          style: { stroke: '#9ca3af', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#9ca3af',
          },
        });
        return newEdges;
      } else {
        return [...eds, {
          id: `e${afterNodeId}-${newNodeId}`,
          source: afterNodeId,
          target: newNodeId,
          type: 'default',
          style: { stroke: '#9ca3af', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#9ca3af',
          },
        }];
      }
    });
  }, [nodeIdCounter, setNodes, setEdges]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds: Node[]) => {
      const nodeIndex = nds.findIndex((n) => n.id === nodeId);
      if (nodeIndex === -1) return nds;

      const updatedNodes = nds.filter((n) => n.id !== nodeId);

      return updatedNodes.map((node, index) => {
        const subtitleParts = node.data.subtitle?.split('. ') || [];
        const stepNumber = index + 1;

        return {
          ...node,
          data: {
            ...node.data,
            subtitle: `${stepNumber}. ${subtitleParts.slice(1).join('. ')}`
          },
          position: {
            x: 250,
            y: 50 + (index * 170)
          }
        };
      });
    });

    setEdges((eds: Edge[]) => {
      const incomingEdge = eds.find((e) => e.target === nodeId);
      const outgoingEdge = eds.find((e) => e.source === nodeId);

      const newEdges = eds.filter((e) => e.source !== nodeId && e.target !== nodeId);

      if (incomingEdge && outgoingEdge) {
        newEdges.push({
          id: `e${incomingEdge.source}-${outgoingEdge.target}`,
          source: incomingEdge.source,
          target: outgoingEdge.target,
          type: 'default',
          style: { stroke: '#9ca3af', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#9ca3af',
          },
        });
      }

      return newEdges;
    });
  }, []);

  const nodesWithCallbacks = nodes.map((node) => ({
    ...node,
    draggable: false,
    position: {
      ...node.position,
      x: 250,
    },
    data: {
      ...node.data,
      onAddNode: addNodeAfter,
      onDeleteNode: deleteNode,
    },
  }));

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#f0f0f0',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-white"
        nodesDraggable={false}
        panOnDrag={[0, 1, 2]}
        onPaneClick={(e) => {
          e.preventDefault();
        }}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        minZoom={0.5}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} color="#d1d5db" gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default App;
