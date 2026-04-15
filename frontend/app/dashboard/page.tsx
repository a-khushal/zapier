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
    trigger: Trigger;
    actions: Action[];
    createdAt: Date;
    updatedAt: Date;
}

function useZaps() {
    const [loading, setLoading] = useState(true);
    const [zaps, setZaps] = useState<Zap[]>([]);

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
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchZaps();
    }, []);

    return { loading, zaps, setZaps, fetchZaps };
}

export default function Dashboard() {
    useAuth();
    const { loading, zaps, setZaps } = useZaps();
    const { showToast } = useToast();
    const router = useRouter()
    const [pendingDeleteZapId, setPendingDeleteZapId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteZap = async () => {
        if (!pendingDeleteZapId) {
            return;
        }

        setIsDeleting(true);
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                throw new Error("No authentication token found");
            }

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
                ) : (
                    <ZapsTable zaps={zaps} onDeleteZap={setPendingDeleteZapId} />
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

function ZapsTable({ zaps, onDeleteZap }: { zaps: Zap[]; onDeleteZap: (zapId: string) => void }) {
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
                            <td colSpan={6} className="px-4 py-4 text-center text-gray-500">No zaps found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
