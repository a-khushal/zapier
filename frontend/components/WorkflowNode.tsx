import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Clock, MoreVertical, AlertCircle, Zap, Trash2 } from 'lucide-react';

interface WorkflowNodeProps {
    id: string;
    data: {
        icon: string;
        title: string;
        subtitle: string;
        badge?: string;
        type: string;
        onAddNode?: (nodeId: string) => void;
        onDeleteNode?: (nodeId: string) => void;
    };
    draggable?: boolean;
}

const WorkflowNode: React.FC<WorkflowNodeProps> = ({ id, data, draggable = false }) => {
    const [showMenu, setShowMenu] = useState(false);
    const isAction = data.type === 'action';
    const isTrigger = data.type === 'trigger';
    
    const handleMouseDown = isTrigger 
        ? (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
          }
        : undefined;

    return (
        <div className="relative">
            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 !bg-gray-400"
            />

            <div
                onMouseDown={handleMouseDown}
                className={`bg-white rounded-lg shadow-md border-2 w-80 transition-all ${
                    isAction ? 'border-dashed border-gray-300' : 'border-gray-200'
                } ${
                    isTrigger ? 'cursor-move hover:shadow-lg' : 'cursor-default'
                }`}
            >
                <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {data.icon === 'gmail' ? (
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-4 h-4 rounded-sm bg-red-500 flex items-center justify-center">
                                            <span className="text-white text-xs font-bold">M</span>
                                        </div>
                                        <span className="font-medium text-gray-900">{data.title}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                                        <Zap className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="font-medium text-gray-900">{data.title}</span>
                                </div>
                            )}
                            {data.badge && (
                                <div className="flex items-center gap-1 ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                    <Clock className="w-3 h-3" />
                                    {data.badge}
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            {!isTrigger && <button
                                className="text-gray-400 hover:text-gray-600"
                                onClick={() => setShowMenu(!showMenu)}
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>}
                            {!isTrigger && showMenu && (
                                <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                    <button
                                        onClick={() => {
                                            data.onDeleteNode?.(id);
                                            setShowMenu(false);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-sm text-gray-600 pl-0">
                        {data.subtitle}
                    </div>
                </div>
            </div>

            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 !bg-gray-400"
            />

            <div className="relative h-8">
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 z-10">
                    <button
                        onClick={() => data.onAddNode?.(id)}
                        className="w-6 h-6 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center text-blue-500 hover:bg-blue-50 shadow-sm transition-colors"
                    >
                        <span className="text-lg font-light leading-none">+</span>
                    </button>
                </div>

                <svg
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                >
                    <line
                        x1="50"
                        y1="0"
                        x2="50"
                        y2="100"
                        stroke="#503ec6"
                        strokeWidth="1"
                        strokeLinecap="round"
                    />
                </svg>
            </div>

        </div>
    );
};

export default WorkflowNode;
