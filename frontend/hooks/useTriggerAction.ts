"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "./useAuth";

export interface TriggerActionRes {
    id: string;
    name: string;
    image: string;
}

export function useTriggerAction() {
    useAuth();
    const [availableTriggers, setAvailableTriggers] = useState<TriggerActionRes[]>([]);
    const [availableActions, setAvailableActions] = useState<TriggerActionRes[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem("token");
            if (!token) return;

            try {
                const [triggerRes, actionRes] = await Promise.all([
                    axios.get("http://localhost:8080/api/v1/trigger/available", {
                        headers: { Authorization: token },
                    }),
                    axios.get("http://localhost:8080/api/v1/action/available", {
                        headers: { Authorization: token },
                    }),
                ]);

                if (!triggerRes.data?.availableTriggers) {
                    throw new Error("No triggers found in response");
                }
                if (!actionRes.data?.availableActions) {
                    throw new Error("No actions found in response");
                }

                setAvailableTriggers(triggerRes.data.availableTriggers);
                setAvailableActions(actionRes.data.availableActions);
            } catch (err: any) {
                throw new Error(`Failed to fetch triggers or actions: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    console.log(availableActions, availableTriggers)
    return { availableTriggers, availableActions, loading };
}
