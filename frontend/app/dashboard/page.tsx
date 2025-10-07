"use client"

import axios from "axios";
import { ChevronRight, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TriggerType = {
    id: string;
    name: string;
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
}

function useZaps() {
    const [loading, setLoading] = useState(true);
    const [zaps, setZaps] = useState<Zap[]>([]);
    const router = useRouter();

    useEffect(() => {
        const fetchZaps = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) {
                    console.error("No token found in localStorage");
                    router.push("/login");
                    return;
                }

                const response = await axios.get("http://localhost:8080/api/v1/zap", {
                    headers: {
                        Authorization: localStorage.getItem("token") as string
                    }
                });

                setZaps(response.data.zaps);
                setLoading(false);
            } catch (error) {
                console.error(error);
            }
        };

        fetchZaps();
    }, []);

    return { loading, zaps };
}

export default function Dashboard() {
    const { loading, zaps } = useZaps();
    const router = useRouter()

    return (
        <div className="mt-10 lg:mt-14 flex justify-center">
            <div className="w-full max-w-5xl bg-white shadow-lg rounded-lg p-6">
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
                    <ZapsTable zaps={zaps} />
                )}
            </div>
        </div>
    );
}

function ZapsTable({ zaps }: { zaps: Zap[] }) {
    const router = useRouter();
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white text-left text-sm text-gray-600">
                <thead className="bg-gray-100 border-b">
                    <tr>
                        <th className="px-4 py-3">Trigger</th>
                        <th className="px-4 py-3">Actions</th>
                        <th className="px-4 py-3">ZapId</th>
                        <th className="px-4 py-3 text-right"></th>
                    </tr>
                </thead>
                <tbody>
                    {zaps.length > 0 ? (
                        zaps.map((zap, index) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-2">{zap.trigger.type.name}</td>
                                <td className="px-4 py-2">
                                    {zap.actions.map(x => x.type.name).join(", ")}
                                </td>
                                <td className="px-4 py-2">{zap.id}</td>
                                <td className="px-4 text-right">
                                    <div
                                        className="hover:text-blue-600 hover:cursor-pointer border border-gray-400 rounded-xl flex justify-center items-center"
                                        onClick={() => {
                                            router.push(`/zap/${zap.id}`)
                                        }}
                                    >
                                        <ChevronRight className="w-6 h-6"/>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={4} className="px-4 py-4 text-center text-gray-500">No zaps found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}