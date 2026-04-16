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

type PostWebhookMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type PostWebhookHeader = {
  key: string;
  value: string;
};

type PostWebhookMetadata = {
  url: string;
  method: PostWebhookMethod;
  headers: PostWebhookHeader[];
  bodyTemplate?: string;
};

const ALLOWED_METHODS: PostWebhookMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function getDefaultPostWebhookMetadata(): PostWebhookMetadata {
  return {
    url: "",
    method: "POST",
    headers: [],
    bodyTemplate: "",
  };
}

function getPostWebhookMetadata(actionMetadata: Record<string, unknown> | undefined): PostWebhookMetadata {
  const base = getDefaultPostWebhookMetadata();
  if (!actionMetadata || typeof actionMetadata !== "object") {
    return base;
  }

  const raw = actionMetadata as any;
  const method = ALLOWED_METHODS.includes(raw.method) ? raw.method : "POST";
  const headers: PostWebhookHeader[] = Array.isArray(raw.headers)
    ? raw.headers.map((header: any) => ({
      key: String(header?.key || ""),
      value: String(header?.value || ""),
    }))
    : [];

  return {
    url: typeof raw.url === "string" ? raw.url : base.url,
    method,
    headers,
    bodyTemplate: typeof raw.bodyTemplate === "string" ? raw.bodyTemplate : base.bodyTemplate,
  };
}

type ZapDetail = {
  id: string;
  isActive: boolean;
  trigger: {
    id: string;
    metadata?: {
      samplePayload?: Record<string, unknown>;
    };
    type: TriggerType;
  };
  actions: Array<{
    id: string;
    actionId: string;
    sortingOrder: number;
    metadata?: Record<string, unknown>;
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

type RunStatusFilter = "ALL" | "SUCCESS" | "FAILED" | "PENDING";

const RUN_STATUS_FILTERS: RunStatusFilter[] = ["ALL", "SUCCESS", "FAILED", "PENDING"];
const RUNS_PAGE_SIZE = 10;

type TestPayloadPreset = {
  id: string;
  label: string;
  payload: Record<string, unknown>;
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
  const [runStatusFilter, setRunStatusFilter] = useState<RunStatusFilter>("ALL");
  const [runsNextOffset, setRunsNextOffset] = useState(0);
  const [runsHasMore, setRunsHasMore] = useState(false);
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [runDetailsLoading, setRunDetailsLoading] = useState(false);
  const [runDetailsError, setRunDetailsError] = useState<string | null>(null);
  const [isTestPayloadModalOpen, setIsTestPayloadModalOpen] = useState(false);
  const [testPayloadInput, setTestPayloadInput] = useState('{"name":"Alice","event":"signup"}');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editableActionMetadata, setEditableActionMetadata] = useState<Record<string, PostWebhookMetadata>>({});

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

  const fetchRuns = async ({
    reset = false,
    status,
  }: {
    reset?: boolean;
    status?: RunStatusFilter;
  } = {}) => {
    if (!zapId) {
      return;
    }

    const activeStatus = status || runStatusFilter;
    const offset = reset ? 0 : runsNextOffset;

    setRunsLoading(true);
    if (reset) {
      setRunsError(null);
    }

    try {
      const response = await axios.get(`${BACKEND_URL}/api/v1/zap/${zapId}/runs`, {
        headers: {
          ...getAuthHeader(),
        },
        params: {
          status: activeStatus,
          limit: RUNS_PAGE_SIZE,
          offset,
        },
      });
      const fetchedRuns: RunSummary[] = response.data.runs || [];
      const pageInfo = response.data.pageInfo || {};

      setRuns((prev) => (reset ? fetchedRuns : [...prev, ...fetchedRuns]));
      setRunsNextOffset(
        typeof pageInfo.nextOffset === "number"
          ? pageInfo.nextOffset
          : offset + fetchedRuns.length
      );
      setRunsHasMore(Boolean(pageInfo.hasMore));
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Failed to load run history";
      setRunsError(message);
    } finally {
      setRunsLoading(false);
    }
  };

  useEffect(() => {
    if (!zapId) {
      return;
    }
    fetchRuns({ reset: true, status: runStatusFilter });
  }, [zapId, runStatusFilter]);

  const retryRun = async (zapRunId: string) => {
    setRetryingRunId(zapRunId);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/v1/zap/run/${zapRunId}/retry`,
        {},
        {
          headers: {
            ...getAuthHeader(),
          },
        }
      );

      showToast({
        type: "success",
        title: "Retry queued",
        description: response.data?.newRunId ? `New run ${response.data.newRunId.slice(0, 8)}...` : undefined,
      });
      await fetchRuns({ reset: true, status: runStatusFilter });
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Failed to retry run";
      showToast({ type: "error", title: "Failed to retry run", description: message });
    } finally {
      setRetryingRunId(null);
    }
  };

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

  const testPayloadPresets = useMemo<TestPayloadPreset[]>(() => {
    const triggerPresetPayload = zap?.trigger?.metadata?.samplePayload;
    const defaults: TestPayloadPreset[] = [
      {
        id: "signup",
        label: "Signup",
        payload: { event: "user.signup", user: { name: "Alice", email: "alice@example.com" } },
      },
      {
        id: "payment",
        label: "Payment",
        payload: { event: "payment.captured", payment: { id: "pay_123", amount: 1499 } },
      },
      {
        id: "order",
        label: "Order",
        payload: { event: "order.created", order: { id: "ord_123", total: 2499 } },
      },
    ];

    if (triggerPresetPayload && typeof triggerPresetPayload === "object") {
      return [
        {
          id: "trigger-template",
          label: "Trigger Template",
          payload: triggerPresetPayload,
        },
        ...defaults,
      ];
    }

    return defaults;
  }, [zap]);

  const applyPayloadPreset = (presetId: string) => {
    const preset = testPayloadPresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    setTestPayloadInput(JSON.stringify(preset.payload, null, 2));
    showToast({ type: "success", title: `Preset applied: ${preset.label}` });
  };

  const copyWebhookUrl = async () => {
    if (!webhookUrl) {
      showToast({ type: "error", title: "Webhook URL unavailable" });
      return;
    }
    try {
      await navigator.clipboard.writeText(webhookUrl);
      showToast({ type: "success", title: "Webhook URL copied" });
    } catch {
      showToast({ type: "error", title: "Failed to copy webhook URL" });
    }
  };

  const handleSendTestEvent = async () => {
    if (!webhookUrl) {
      setTestResult("Webhook URL is not available yet");
      showToast({ type: "error", title: "Webhook URL is not available yet" });
      return;
    }

    const defaultPayload = testPayloadPresets[0]?.payload || { name: "Alice", event: "signup" };
    setTestPayloadInput(JSON.stringify(defaultPayload, null, 2));
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
      fetchRuns({ reset: true, status: runStatusFilter });
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

  const openEditModal = () => {
    if (!zap) {
      return;
    }

    const nextMetadata: Record<string, PostWebhookMetadata> = {};
    for (const action of zap.actions) {
      if (action.actionId !== "post_webhook") {
        continue;
      }
      nextMetadata[action.id] = getPostWebhookMetadata(action.metadata);
    }

    if (Object.keys(nextMetadata).length === 0) {
      showToast({ type: "info", title: "No post_webhook actions found to edit" });
      return;
    }

    setEditableActionMetadata(nextMetadata);
    setIsEditModalOpen(true);
  };

  const updateEditableMetadata = (
    actionId: string,
    updater: (current: PostWebhookMetadata) => PostWebhookMetadata
  ) => {
    setEditableActionMetadata((prev) => {
      const current = prev[actionId] || getDefaultPostWebhookMetadata();
      return {
        ...prev,
        [actionId]: updater(current),
      };
    });
  };

  const saveZapEdits = async () => {
    if (!zapId) {
      return;
    }

    const updates = Object.entries(editableActionMetadata);
    if (updates.length === 0) {
      showToast({ type: "error", title: "No actions to update" });
      return;
    }

    for (const [actionId, metadata] of updates) {
      if (!metadata.url.trim()) {
        showToast({ type: "error", title: `Action ${actionId.slice(0, 6)}: URL is required` });
        return;
      }
    }

    setIsSavingEdit(true);
    try {
      await axios.put(
        `${BACKEND_URL}/api/v1/zap/${zapId}`,
        {
          actions: updates.map(([actionId, metadata]) => ({
            id: actionId,
            actionMetadata: metadata,
          })),
        },
        {
          headers: {
            ...getAuthHeader(),
            "Content-Type": "application/json",
          },
        }
      );

      setZap((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          actions: prev.actions.map((action) =>
            editableActionMetadata[action.id]
              ? { ...action, metadata: editableActionMetadata[action.id] }
              : action
          ),
        };
      });
      setIsEditModalOpen(false);
      showToast({ type: "success", title: "Zap updated successfully" });
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Failed to update zap";
      showToast({ type: "error", title: "Failed to update zap", description: message });
    } finally {
      setIsSavingEdit(false);
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
          <p>
            <span className="font-semibold">Status:</span>{" "}
            <span className={`rounded px-2 py-1 text-xs font-medium ${zap.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>
              {zap.isActive ? "Active" : "Paused"}
            </span>
          </p>
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
            <button
              onClick={copyWebhookUrl}
              className="ml-2 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
              disabled={!webhookUrl}
            >
              Copy
            </button>
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
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
          <button
            onClick={openEditModal}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit Actions
          </button>
        </div>

        <div className="mt-3">
          <p className="text-xs font-medium text-gray-600">Test payload presets</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {testPayloadPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPayloadPreset(preset.id)}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {testResult && (
          <div className="mt-4 rounded bg-gray-50 p-3 text-sm text-gray-800">
            {testResult}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Run History</h2>
          <div className="flex flex-wrap items-center gap-2">
            {RUN_STATUS_FILTERS.map((status) => (
              <button
                key={status}
                onClick={() => setRunStatusFilter(status)}
                className={`rounded border px-2 py-1 text-xs ${runStatusFilter === status
                  ? "border-[#ff4f00] bg-[#fff2ec] text-[#c63d00]"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
              >
                {status === "ALL" ? "All" : status}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchRuns({ reset: true, status: runStatusFilter })}
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
          <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">No runs yet</p>
            <p className="mt-1 text-xs text-gray-600">
              Use a payload preset and click <span className="font-semibold">Send Test Event</span> to create your first run.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="rounded bg-white px-2 py-1">Pick preset</span>
              <span className="rounded bg-white px-2 py-1">Send test event</span>
              <span className="rounded bg-white px-2 py-1">Open run details</span>
            </div>
          </div>
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
                  <th className="px-2 py-2 text-right">Actions</th>
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
                      <div className="flex justify-end gap-1">
                        {run.status === "FAILED" && (
                          <button
                            onClick={() => retryRun(run.id)}
                            disabled={retryingRunId === run.id}
                            className={`rounded border px-2 py-1 text-xs ${retryingRunId === run.id
                              ? "cursor-not-allowed border-gray-300 text-gray-400"
                              : "border-orange-300 text-orange-700 hover:bg-orange-50"
                              }`}
                          >
                            {retryingRunId === run.id ? "Retrying..." : "Retry"}
                          </button>
                        )}
                        <button
                          onClick={() => loadRunDetails(run.id)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {runsHasMore && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => fetchRuns({ reset: false, status: runStatusFilter })}
              disabled={runsLoading}
              className={`rounded border px-3 py-1 text-sm ${runsLoading
                ? "cursor-not-allowed border-gray-300 text-gray-400"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
            >
              {runsLoading ? "Loading..." : "Load More"}
            </button>
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

      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-lg border border-gray-200 bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Edit Post Webhook Actions</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-5">
              {Object.entries(editableActionMetadata).map(([actionId, metadata], index) => (
                <div key={actionId} className="rounded border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-gray-800">Step {index + 1}</p>

                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-600">URL</label>
                    <input
                      type="text"
                      value={metadata.url}
                      onChange={(e) =>
                        updateEditableMetadata(actionId, (current) => ({
                          ...current,
                          url: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                  </div>

                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-600">Method</label>
                    <select
                      value={metadata.method}
                      onChange={(e) =>
                        updateEditableMetadata(actionId, (current) => ({
                          ...current,
                          method: e.target.value as PostWebhookMethod,
                        }))
                      }
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      {ALLOWED_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-600">Body Template (JSON)</label>
                    <textarea
                      rows={3}
                      value={metadata.bodyTemplate || ""}
                      onChange={(e) =>
                        updateEditableMetadata(actionId, (current) => ({
                          ...current,
                          bodyTemplate: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                  </div>

                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-600">Headers</label>
                    <div className="mt-1 space-y-1">
                      {metadata.headers.map((header, headerIndex) => (
                        <div key={headerIndex} className="flex items-center gap-1">
                          <input
                            type="text"
                            value={header.key}
                            onChange={(e) =>
                              updateEditableMetadata(actionId, (current) => {
                                const nextHeaders = [...current.headers];
                                nextHeaders[headerIndex] = {
                                  ...nextHeaders[headerIndex],
                                  key: e.target.value,
                                };
                                return {
                                  ...current,
                                  headers: nextHeaders,
                                };
                              })
                            }
                            placeholder="Key"
                            className="w-[45%] rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                          <input
                            type="text"
                            value={header.value}
                            onChange={(e) =>
                              updateEditableMetadata(actionId, (current) => {
                                const nextHeaders = [...current.headers];
                                nextHeaders[headerIndex] = {
                                  ...nextHeaders[headerIndex],
                                  value: e.target.value,
                                };
                                return {
                                  ...current,
                                  headers: nextHeaders,
                                };
                              })
                            }
                            placeholder="Value"
                            className="w-[45%] rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() =>
                              updateEditableMetadata(actionId, (current) => ({
                                ...current,
                                headers: current.headers.filter((_, indexToKeep) => indexToKeep !== headerIndex),
                              }))
                            }
                            className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-sm leading-none text-gray-500 hover:border-red-300 hover:text-red-500"
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        updateEditableMetadata(actionId, (current) => ({
                          ...current,
                          headers: [...current.headers, { key: "", value: "" }],
                        }))
                      }
                      className="mt-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      + Add Header
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveZapEdits}
                  disabled={isSavingEdit}
                  className={`rounded px-3 py-1.5 text-xs font-medium ${
                    isSavingEdit ? "cursor-not-allowed bg-gray-300 text-gray-600" : "bg-[#ff4f00] text-white hover:bg-[#ff4f00]/90"
                  }`}
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
