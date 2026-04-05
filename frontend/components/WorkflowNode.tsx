import React, { useState } from "react";
import { Bolt, ChevronDown, Plus, Trash2, Zap } from "lucide-react";
import { Handle, Position } from "reactflow";

interface WorkflowNodeData {
  icon: string;
  title: string;
  subtitle: string;
  badge?: string;
  type: string;
  onAddNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onClick?: (nodeId: string) => void;
  isSelected?: boolean;
}

interface WorkflowNodeProps {
  id: string;
  data: WorkflowNodeData;
}

const WorkflowNode: React.FC<WorkflowNodeProps> = ({ id, data }) => {
  const [showMenu, setShowMenu] = useState(false);
  const isTrigger = data.type === "trigger";
  const isAction = data.type === "action";

  const stepLabel = isTrigger ? "Trigger" : "Action";
  const iconContainerClass = isTrigger
    ? "bg-orange-100 text-orange-600"
    : "bg-blue-100 text-blue-600";

  return (
    <div className="relative flex w-[340px] flex-col items-center">
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 0, height: 0, border: 0, background: "transparent", pointerEvents: "none" }}
      />

      <div
        onClick={(e) => {
          e.stopPropagation();
          data.onClick?.(id);
        }}
        className={`w-full rounded-xl border bg-white p-3 shadow-sm transition-all cursor-pointer ${
          data.isSelected
            ? "border-orange-400 ring-2 ring-orange-100"
            : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            {stepLabel}
          </span>

          {!isTrigger && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu((prev) => !prev);
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Open action menu"
              >
                <ChevronDown className="h-4 w-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-7 z-50 w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onDeleteNode?.(id);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete step
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-md ${iconContainerClass}`}>
            {data.icon.startsWith("http") ? (
              <img src={data.icon} alt={data.title} className="h-5 w-5 rounded object-contain" />
            ) : isTrigger ? (
              <Bolt className="h-4 w-4" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{data.title}</p>
            <p className="truncate text-xs text-gray-500">{data.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="relative h-16 w-full">
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gray-300" />

        <button
          onClick={() => data.onAddNode?.(id)}
          className="absolute left-1/2 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm hover:border-orange-300 hover:text-orange-600"
          aria-label="Add step"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0, border: 0, background: "transparent", pointerEvents: "none" }}
      />
    </div>
  );
};

export default WorkflowNode;
