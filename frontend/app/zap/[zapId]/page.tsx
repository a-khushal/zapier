"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUserId } from "@/hooks/useUserId";
import { BACKEND_URL, WEBHOOK_URL } from "@/config";

type TriggerType = {
  id: string;
  name: string;
  image: string;
};

type ActionType = {
  id: string;
  name: string;
  image: string;
};

type ZapDetail = {
  id: string;
  trigger: {
    id: string;
    type: TriggerType;
  };
  actions: Array<{
    id: string;
    sortingOrder: number;
    type: ActionType;
  }>;
  createdAt: string;
};

export default function ZapDetailPage() {
  useAuth();
  const params = useParams<{ zapId: string }>();
  const router = useRouter();
  const userId = useUserId();
  const zapId = params?.zapId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zap, setZap] = useState<ZapDetail | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const fetchZap = async () => {
      if (!zapId) {
        return;
      }

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("No authentication token found");
          setLoading(false);
          return;
        }

        const response = await axios.get(`${BACKEND_URL}/api/v1/zap/${zapId}`, {
          headers: {
            Authorization: token,
          },
        });

        setZap(response.data.zap);
      } catch (err: any) {
        const message = err.response?.data?.message || err.message || "Failed to load zap";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchZap();
  }, [zapId]);

  const webhookUrl = useMemo(() => {
    if (!userId || !zapId) {
      return "";
    }
    return `${WEBHOOK_URL}/hooks/catch/${userId}/${zapId}`;
  }, [userId, zapId]);

  const handleSendTestEvent = async () => {
    if (!webhookUrl) {
      setTestResult("Webhook URL is not available yet");
      return;
    }

    const payloadInput = window.prompt(
      "Enter test payload JSON",
      "{\"name\":\"Alice\",\"event\":\"signup\"}"
    );

    if (!payloadInput || !payloadInput.trim()) {
      setTestResult("Test cancelled");
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(payloadInput);
    } catch {
      setTestResult("Invalid JSON payload");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await axios.post(webhookUrl, payload, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      setTestResult(
        `Sent successfully (status ${response.status}): ${JSON.stringify(response.data)}`
      );
    } catch (err: any) {
      const status = err.response?.status;
      const message =
        err.response?.data?.message || err.message || "Failed to send test event";
      setTestResult(status ? `Failed (status ${status}): ${message}` : `Failed: ${message}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-600">Loading zap...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  if (!zap) {
    return <div className="p-8 text-gray-600">Zap not found</div>;
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-4xl px-4">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Zap Details</h1>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
        </div>

        <div className="space-y-2 text-sm text-gray-700">
          <p><span className="font-semibold">Zap ID:</span> {zap.id}</p>
          <p><span className="font-semibold">Trigger:</span> {zap.trigger.type.name}</p>
          <p>
            <span className="font-semibold">Actions:</span>{" "}
            {zap.actions
              .sort((a, b) => a.sortingOrder - b.sortingOrder)
              .map((action) => action.type.name)
              .join(" -> ")}
          </p>
          <p>
            <span className="font-semibold">Webhook URL:</span>{" "}
            <span className="break-all">{webhookUrl || "Unavailable"}</span>
          </p>
        </div>

        <div className="mt-6">
          <button
            onClick={handleSendTestEvent}
            disabled={isTesting || !webhookUrl}
            className={`rounded px-4 py-2 text-sm font-medium ${
              isTesting || !webhookUrl
                ? "cursor-not-allowed bg-gray-300 text-gray-600"
                : "bg-[#ff4f00] text-white hover:bg-[#ff4f00]/90"
            }`}
          >
            {isTesting ? "Sending..." : "Send Test Event"}
          </button>
        </div>

        {testResult && (
          <div className="mt-4 rounded bg-gray-50 p-3 text-sm text-gray-800">
            {testResult}
          </div>
        )}
      </div>
    </div>
  );
}
