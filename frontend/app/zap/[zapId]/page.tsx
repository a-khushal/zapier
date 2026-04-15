"use client";

import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUserId } from "@/hooks/useUserId";
import { BACKEND_URL, WEBHOOK_URL } from "@/config";
import JsonPayloadModal from "@/components/JsonPayloadModal";
import { useToast } from "@/components/ToastProvider";

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

type RunSummary = {
  id: string;
  zapId: string;
  metadata: any;
  status: "SUCCESS" | "FAILED" | "PENDING";
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  stepCount: number;
  successStepCount: number;
  failedStepCount: number;
  totalAttempts: number;
};

type RunAttempt = {
  id: string;
  attemptNumber: number;
  requestSummary: any;
  responseStatus: number | null;
  responseBodyPreview: string | null;
  error: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number | null;
};

type RunStepDetail = {
  id: string;
  actionId: string;
  actionName: string;
  actionImage: string;
  sortingOrder: number;
  status: "SUCCESS" | "FAILED";
  attemptCount: number;
  input: any;
  output: any;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  latestResponseStatus: number | null;
  latestResponsePreview: string | null;
  latestError: string | null;
  attempts: RunAttempt[];
};

type RunDetail = {
  id: string;
  zapId: string;
  metadata: any;
  status: "SUCCESS" | "FAILED" | "PENDING";
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  steps: RunStepDetail[];
};

export default function ZapDetailPage() {
  useAuth();
  const { showToast } = useToast();
  const params = useParams<{ zapId: string }>();
  const router = useRouter();
  const userId = useUserId();
  const zapId = params?.zapId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zap, setZap] = useState<ZapDetail | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [runDetailsLoading, setRunDetailsLoading] = useState(false);
  const [runDetailsError, setRunDetailsError] = useState<string | null>(null);
  const [isTestPayloadModalOpen, setIsTestPayloadModalOpen] = useState(false);
  const [testPayloadInput, setTestPayloadInput] = useState('{"name":"Alice","event":"signup"}');

  const getAuthHeader = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No authentication token found");
    }
    return { Authorization: token };
  };

  useEffect(() => {
    const fetchZap = async () => {
      if (!zapId) {
        return;
      }

      try {
        const response = await axios.get(`${BACKEND_URL}/api/v1/zap/${zapId}`, {
          headers: {
            ...getAuthHeader(),
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

  const fetchRuns = async () => {
    if (!zapId) {
      return;
    }

    setRunsLoading(true);
    setRunsError(null);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/v1/zap/${zapId}/runs`, {
        headers: {
          ...getAuthHeader(),
        },
      });
      setRuns(response.data.runs || []);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Failed to load run history";
      setRunsError(message);
    } finally {
      setRunsLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [zapId]);

  const loadRunDetails = async (zapRunId: string) => {
    setSelectedRunId(zapRunId);
    setRunDetailsLoading(true);
    setRunDetailsError(null);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/v1/zap/run/${zapRunId}`, {
        headers: {
          ...getAuthHeader(),
        },
      });
      setSelectedRun(response.data.run || null);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Failed to load run details";
      setRunDetailsError(message);
      setSelectedRun(null);
    } finally {
      setRunDetailsLoading(false);
    }
  };

  const webhookUrl = useMemo(() => {
    if (!userId || !zapId) {
      return "";
    }
    return `${WEBHOOK_URL}/hooks/catch/${userId}/${zapId}`;
  }, [userId, zapId]);

  const handleSendTestEvent = async () => {
    if (!webhookUrl) {
      setTestResult("Webhook URL is not available yet");
      showToast({ type: "error", title: "Webhook URL is not available yet" });
      return;
    }

    setTestPayloadInput('{"name":"Alice","event":"signup"}');
    setIsTestPayloadModalOpen(true);
  };

  const submitTestEvent = async () => {
    if (!testPayloadInput.trim()) {
      showToast({ type: "error", title: "Test payload JSON is required" });
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(testPayloadInput);
    } catch {
      setTestResult("Invalid JSON payload");
      showToast({ type: "error", title: "Invalid JSON payload" });
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
      showToast({ type: "success", title: "Test event sent", description: `HTTP ${response.status}` });
      setIsTestPayloadModalOpen(false);
      fetchRuns();
    } catch (err: any) {
      const status = err.response?.status;
      const message =
        err.response?.data?.message || err.message || "Failed to send test event";
      setTestResult(status ? `Failed (status ${status}): ${message}` : `Failed: ${message}`);
      showToast({ type: "error", title: "Failed to send test event", description: message });
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

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Run History</h2>
          <button
            onClick={fetchRuns}
            disabled={runsLoading}
            className={`rounded border px-3 py-1 text-sm ${runsLoading
              ? "cursor-not-allowed border-gray-300 text-gray-400"
              : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
          >
            {runsLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {runsError && <p className="text-sm text-red-600">{runsError}</p>}
        {runsLoading && <p className="text-sm text-gray-500">Loading runs...</p>}
        {!runsLoading && runs.length === 0 && (
          <p className="text-sm text-gray-500">No runs yet. Send a test event to create one.</p>
        )}

        {runs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-gray-700">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-2 py-2">Run ID</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Started</th>
                  <th className="px-2 py-2">Duration</th>
                  <th className="px-2 py-2">Steps</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-gray-100">
                    <td className="px-2 py-2 font-mono">{run.id.slice(0, 8)}...</td>
                    <td className="px-2 py-2">
                      <span className={`rounded px-2 py-1 text-xs font-medium ${run.status === "SUCCESS"
                        ? "bg-green-100 text-green-700"
                        : run.status === "FAILED"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                        }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {run.startedAt ? new Date(run.startedAt).toLocaleString() : "-"}
                    </td>
                    <td className="px-2 py-2">
                      {typeof run.durationMs === "number" ? `${run.durationMs} ms` : "-"}
                    </td>
                    <td className="px-2 py-2">
                      {run.successStepCount}/{run.stepCount} success
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => loadRunDetails(run.id)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(selectedRunId || selectedRun) && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Run Details</h2>
          {selectedRunId && (
            <p className="mt-1 text-xs text-gray-500 font-mono">{selectedRunId}</p>
          )}

          {runDetailsLoading && <p className="mt-3 text-sm text-gray-500">Loading run details...</p>}
          {runDetailsError && <p className="mt-3 text-sm text-red-600">{runDetailsError}</p>}

          {selectedRun && !runDetailsLoading && (
            <div className="mt-4 space-y-4">
              <div className="rounded bg-gray-50 p-3 text-sm text-gray-700">
                <p><span className="font-semibold">Run Status:</span> {selectedRun.status}</p>
                <p><span className="font-semibold">Started:</span> {selectedRun.startedAt ? new Date(selectedRun.startedAt).toLocaleString() : "-"}</p>
                <p><span className="font-semibold">Completed:</span> {selectedRun.completedAt ? new Date(selectedRun.completedAt).toLocaleString() : "-"}</p>
                <p><span className="font-semibold">Duration:</span> {typeof selectedRun.durationMs === "number" ? `${selectedRun.durationMs} ms` : "-"}</p>
              </div>

              {selectedRun.steps
                .sort((a, b) => a.sortingOrder - b.sortingOrder)
                .map((step) => (
                  <div key={step.id} className="rounded border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">
                        Step {step.sortingOrder + 1}: {step.actionName}
                      </p>
                      <span className={`rounded px-2 py-1 text-xs font-medium ${step.status === "SUCCESS"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                        }`}>
                        {step.status}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-gray-600">
                      <p>Attempts: {step.attemptCount}</p>
                      <p>Duration: {typeof step.durationMs === "number" ? `${step.durationMs} ms` : "-"}</p>
                      {step.latestResponseStatus !== null && (
                        <p>Latest HTTP Status: {step.latestResponseStatus}</p>
                      )}
                      {step.latestError && (
                        <p className="text-red-600">Latest Error: {step.latestError}</p>
                      )}
                      {step.latestResponsePreview && (
                        <p className="break-words">Latest Response: {step.latestResponsePreview}</p>
                      )}
                    </div>

                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-800">Attempts Timeline</p>
                      <div className="mt-2 space-y-2">
                        {step.attempts.map((attempt) => (
                          <div key={attempt.id} className="rounded bg-gray-50 p-2 text-xs text-gray-700">
                            <p>
                              <span className="font-semibold">Attempt {attempt.attemptNumber}</span>
                              {typeof attempt.durationMs === "number" ? ` - ${attempt.durationMs} ms` : ""}
                            </p>
                            {attempt.responseStatus !== null && <p>Status: {attempt.responseStatus}</p>}
                            {attempt.error && <p className="text-red-600">Error: {attempt.error}</p>}
                            {attempt.responseBodyPreview && (
                              <p className="break-words">Response: {attempt.responseBodyPreview}</p>
                            )}
                          </div>
                        ))}
                        {step.attempts.length === 0 && (
                          <p className="text-xs text-gray-500">No attempts logged.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <JsonPayloadModal
        isOpen={isTestPayloadModalOpen}
        title="Send Test Event"
        description="Enter the trigger payload to send to this zap."
        value={testPayloadInput}
        confirmLabel="Send"
        isSubmitting={isTesting}
        onChange={setTestPayloadInput}
        onClose={() => setIsTestPayloadModalOpen(false)}
        onConfirm={submitTestEvent}
      />
    </div>
  );
}
