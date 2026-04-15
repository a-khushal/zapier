import React, { useEffect, useRef, useState } from "react";
import { Bolt, ChevronDown, Plus, Trash2, Zap } from "lucide-react";
import { Handle, Position } from "reactflow";
import { createPortal } from "react-dom";

interface WorkflowNodeData {
  icon: string;
  title: string;
  subtitle: string;
  badge?: string;
  type: string;
  onAddNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  onMoveUp?: (nodeId: string) => void;
  onMoveDown?: (nodeId: string) => void;
  onToggleEnabled?: (nodeId: string) => void;
  onClick?: (nodeId: string) => void;
  isSelected?: boolean;
  isDisabled?: boolean;
  isFirstAction?: boolean;
  isLastAction?: boolean;
}

interface WorkflowNodeProps {
  id: string;
  data: WorkflowNodeData;
}

const WorkflowNode: React.FC<WorkflowNodeProps> = ({ id, data }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isTrigger = data.type === "trigger";
  const isAction = data.type === "action";

  const stepLabel = isTrigger ? "Trigger" : "Action";
  const iconContainerClass = isTrigger
    ? "bg-orange-100 text-orange-600"
    : "bg-blue-100 text-blue-600";

  useEffect(() => {
    if (!showMenu) {
      return;
    }

    const updateMenuPosition = () => {
      const rect = triggerButtonRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setMenuPosition({
        top: rect.bottom + 6,
        left: rect.right - 176,
      });
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerButtonRef.current?.contains(target)) {
        return;
      }
      setShowMenu(false);
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const menuElement = showMenu && typeof document !== "undefined"
    ? createPortal(
      <div
        ref={menuRef}
        style={{ top: menuPosition.top, left: menuPosition.left }}
        className="fixed z-[300] w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onDuplicateNode?.(id);
            setShowMenu(false);
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Duplicate step
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onMoveUp?.(id);
            setShowMenu(false);
          }}
          disabled={data.isFirstAction}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronDown className="h-3.5 w-3.5 rotate-180" />
          Move up
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onMoveDown?.(id);
            setShowMenu(false);
          }}
          disabled={data.isLastAction}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Move down
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleEnabled?.(id);
            setShowMenu(false);
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
        >
          <Zap className="h-3.5 w-3.5" />
          {data.isDisabled ? "Enable step" : "Disable step"}
        </button>
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
      </div>,
      document.body
    )
    : null;

  return (
    <div className={`relative flex w-[340px] flex-col items-center ${showMenu ? "z-[120]" : "z-10"}`}>
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
        } ${data.isDisabled ? "opacity-60" : ""}`}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            {stepLabel}
          </span>

          {data.isDisabled && (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              Disabled
            </span>
          )}

          {!isTrigger && (
            <div className="relative">
              <button
                ref={triggerButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu((prev) => !prev);
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Open action menu"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
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
          className="absolute left-1/2 top-1/2 z-0 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm hover:border-orange-300 hover:text-orange-600"
          aria-label="Add step"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {menuElement}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0, border: 0, background: "transparent", pointerEvents: "none" }}
      />
    </div>
  );
};

export default WorkflowNode;
