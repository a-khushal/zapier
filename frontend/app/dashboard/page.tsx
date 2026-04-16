"use client"

import axios from "axios";
import { ChevronRight, PlusIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BACKEND_URL, WEBHOOK_URL } from "@/config";
import { useUserId } from "@/hooks/useUserId";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";

type TriggerType = {
    id: string;
    name: string;
    image: string;
}

interface Trigger {
    id: string;
    zapId: string;
    triggerId: string;
    type: TriggerType;
}

type ActionType = {
    id: string;
    name: string;
    image: string;
}

interface Action {
    id: string;
    zapId: string;
    actionId: string;
    sortingOrder: number;
    type: ActionType;
}

interface Zap {
    id: string;
    triggerId: string;
    userId: string;
    isActive: boolean;
    trigger: Trigger;
    actions: Action[];
    createdAt: Date;
    updatedAt: Date;
}

function useZaps() {
    const [loading, setLoading] = useState(true);
    const [zaps, setZaps] = useState<Zap[]>([]);
    const [error, setError] = useState<string | null>(null);

    const fetchZaps = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                console.error("No token found in localStorage");
                return;
            }

            const response = await axios.get(`${BACKEND_URL}/api/v1/zap`, {
                headers: {
                    Authorization: token
                }
            });

            setZaps(response.data.zaps);
            setError(null);
        } catch (error) {
            const err = error as any;
            setError(err.response?.data?.message || err.message || "Failed to load zaps");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchZaps();
    }, []);

    return { loading, error, zaps, setZaps, fetchZaps };
}

export default function Dashboard() {
    useAuth();
    const { loading, error: zapsError, zaps, setZaps, fetchZaps } = useZaps();
    const { showToast } = useToast();
    const router = useRouter()
    const [pendingDeleteZapId, setPendingDeleteZapId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [busyStatusZapId, setBusyStatusZapId] = useState<string | null>(null);
    const [busyDuplicateZapId, setBusyDuplicateZapId] = useState<string | null>(null);

    const getAuthToken = () => {
        const token = localStorage.getItem("token");
        if (!token) {
            throw new Error("No authentication token found");
        }
        return token;
    };

    const handleDeleteZap = async () => {
        if (!pendingDeleteZapId) {
            return;
        }

        setIsDeleting(true);
        try {
            const token = getAuthToken();

            await axios.delete(`${BACKEND_URL}/api/v1/zap/${pendingDeleteZapId}`, {
                headers: {
                    Authorization: token,
                },
            });

            setZaps((prev) => prev.filter((zap) => zap.id !== pendingDeleteZapId));
            showToast({ type: "success", title: "Zap deleted" });
            setPendingDeleteZapId(null);
        } catch (err: any) {
            const message = err.response?.data?.message || err.message || "Failed to delete zap";
            showToast({ type: "error", title: "Failed to delete zap", description: message });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleToggleZapStatus = async (zapId: string, isActive: boolean) => {
        setBusyStatusZapId(zapId);
        try {
            const token = getAuthToken();
            const response = await axios.patch(
                `${BACKEND_URL}/api/v1/zap/${zapId}/status`,
                { isActive: !isActive },
                {
                    headers: {
                        Authorization: token,
                    },
                }
            );

            const nextIsActive = Boolean(response.data?.zap?.isActive);
            setZaps((prev) => prev.map((zap) => zap.id === zapId ? { ...zap, isActive: nextIsActive } : zap));
            showToast({ type: "success", title: nextIsActive ? "Zap resumed" : "Zap paused" });
        } catch (err: any) {
            const message = err.response?.data?.message || err.message || "Failed to update zap status";
            showToast({ type: "error", title: "Failed to update zap", description: message });
        } finally {
            setBusyStatusZapId(null);
        }
    };

    const handleDuplicateZap = async (zapId: string) => {
        setBusyDuplicateZapId(zapId);
        try {
            const token = getAuthToken();
            const response = await axios.post(
                `${BACKEND_URL}/api/v1/zap/${zapId}/duplicate`,
                {},
                {
                    headers: {
                        Authorization: token,
                    },
                }
            );

            const duplicatedZapId = response.data?.zapId;
            showToast({
                type: "success",
                title: "Zap duplicated",
                description: "New copy is created in paused state",
            });

            if (duplicatedZapId) {
                router.push(`/zap/${duplicatedZapId}`);
                return;
            }

            await fetchZaps();
        } catch (err: any) {
            const message = err.response?.data?.message || err.message || "Failed to duplicate zap";
            showToast({ type: "error", title: "Failed to duplicate zap", description: message });
        } finally {
            setBusyDuplicateZapId(null);
        }
    };

    return (
        <div className="mt-10 lg:mt-14 flex justify-center">
            <div className="w-full max-w-7xl bg-white shadow-lg rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-semibold text-2xl text-gray-800">My Zaps</h2>
                    <button className="flex items-center text-white bg-blue-600 px-4 py-2 rounded-md hover:bg-blue-700" onClick={() => {
                        router.push("/zap/create")
                    }}>
                        <PlusIcon className="w-5 h-5" />
                        <span className="ml-2">Create</span>
                    </button>
                </div>
                {loading ? (
                    <div className="text-center text-gray-500">Loading...</div>
                ) : zapsError ? (
                    <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        <p>{zapsError}</p>
                        <button
                            onClick={fetchZaps}
                            className="mt-2 rounded border border-red-300 bg-white px-3 py-1 text-xs text-red-700 hover:bg-red-100"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <ZapsTable
                        zaps={zaps}
                        onDeleteZap={setPendingDeleteZapId}
                        onToggleStatus={handleToggleZapStatus}
                        onDuplicateZap={handleDuplicateZap}
                        busyStatusZapId={busyStatusZapId}
                        busyDuplicateZapId={busyDuplicateZapId}
                    />
                )}
            </div>

            <ConfirmModal
                isOpen={!!pendingDeleteZapId}
                title="Delete this Zap?"
                description="This removes the zap and its runs permanently."
                confirmLabel="Delete"
                isSubmitting={isDeleting}
                onCancel={() => setPendingDeleteZapId(null)}
                onConfirm={handleDeleteZap}
            />
        </div>
    );
}

function ZapsTable({
    zaps,
    onDeleteZap,
    onToggleStatus,
    onDuplicateZap,
    busyStatusZapId,
    busyDuplicateZapId,
}: {
    zaps: Zap[];
    onDeleteZap: (zapId: string) => void;
    onToggleStatus: (zapId: string, isActive: boolean) => void;
    onDuplicateZap: (zapId: string) => void;
    busyStatusZapId: string | null;
    busyDuplicateZapId: string | null;
}) {
    const router = useRouter();
    const userId = useUserId();

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white text-left text-sm text-gray-600">
                <thead className="bg-gray-100 border-b">
                    <tr>
                        <th className="px-4 py-3">Trigger</th>
                        <th className="px-4 py-3">Actions</th>
                        <th className="px-4 py-3">ZapId</th>
                        <th className="px-4 py-3">Webhook URL</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Created at</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {zaps.length > 0 ? (
                        zaps.map((zap) => (
                            <tr key={zap.id} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-2">
                                    <div className="flex justify-start">
                                        <img
                                            src={zap.trigger.type.image}
                                            alt={zap.trigger.type.name}
                                            className="w-6 h-6 rounded-full object-cover"
                                            title={zap.trigger.type.name}
                                        />
                                    </div>
                                </td>
                                <td className="px-4 py-2">
                                    <div className="flex gap-3 justify-start">
                                        {zap.actions.map((action, idx) => (
                                            <img
                                                key={idx}
                                                src={action.type.image}
                                                alt={action.type.name}
                                                className="w-6 h-6 rounded-full object-cover"
                                                title={action.type.name}
                                            />
                                        ))}
                                    </div>
                                </td>
                                <td className="px-4 py-2">{zap.id}</td>
                                <td className="px-4 py-2 max-w-xs break-all">
                                    {`${WEBHOOK_URL}/hooks/catch/${userId}/${zap.id}`}
                                </td>
                                <td className="px-4 py-2">
                                    <span className={`rounded px-2 py-1 text-xs font-medium ${zap.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>
                                        {zap.isActive ? "Active" : "Paused"}
                                    </span>
                                </td>
                                <td className="px-4 py-2">
                                    {new Date(zap.createdAt).toLocaleString("en-GB", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                    })}
                                </td>
                                <td className="px-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            onClick={() => onToggleStatus(zap.id, zap.isActive)}
                                            disabled={busyStatusZapId === zap.id}
                                            title={zap.isActive ? "Pause zap" : "Resume zap"}
                                        >
                                            {busyStatusZapId === zap.id ? "..." : zap.isActive ? "Pause" : "Resume"}
                                        </button>
                                        <button
                                            className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            onClick={() => onDuplicateZap(zap.id)}
                                            disabled={busyDuplicateZapId === zap.id}
                                            title="Duplicate zap"
                                        >
                                            {busyDuplicateZapId === zap.id ? "..." : "Duplicate"}
                                        </button>
                                        <button
                                            className="hover:text-blue-600 hover:cursor-pointer border border-gray-400 rounded-xl flex justify-center items-center p-1"
                                            onClick={() => {
                                                router.push(`/zap/${zap.id}`)
                                            }}
                                            title="View zap details"
                                        >
                                            <ChevronRight className="w-6 h-6" />
                                        </button>
                                        <button
                                            className="border border-red-200 text-red-600 rounded-xl flex justify-center items-center p-1 hover:bg-red-50"
                                            onClick={() => onDeleteZap(zap.id)}
                                            title="Delete zap"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={7} className="px-4 py-8 text-center">
                                <div className="mx-auto max-w-xl rounded border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
                                    <p className="font-semibold text-gray-900">No zaps yet</p>
                                    <p className="mt-1 text-xs text-gray-600">
                                        Start with a template on the create page, publish your zap, then send a test event.
                                    </p>
                                    <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-gray-600">
                                        <span className="rounded bg-white px-2 py-1">1. Create from template</span>
                                        <span className="rounded bg-white px-2 py-1">2. Configure action URL</span>
                                        <span className="rounded bg-white px-2 py-1">3. Publish and test</span>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
