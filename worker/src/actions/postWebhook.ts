import { DEFAULT_REQUEST_TIMEOUT_MS } from "../config";
import { renderBodyTemplate } from "../template/bodyTemplate";
import { ActionExecutionResult, ActionForExecution } from "../types";

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function asMetadataObject(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }
  return metadata as Record<string, unknown>;
}

export async function executePostWebhook(
  action: ActionForExecution,
  payload: unknown
): Promise<ActionExecutionResult> {
  const metadata = asMetadataObject(action.metadata);
  const rawUrl = metadata.url;

  if (!rawUrl || typeof rawUrl !== "string") {
    return {
      success: false,
      shouldRetry: false,
      error: "post_webhook requires metadata.url",
      requestSummary: {},
    };
  }

  const method = String(metadata.method || "POST").toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    return {
      success: false,
      shouldRetry: false,
      error: "post_webhook method must be GET, POST, PUT, PATCH or DELETE",
      requestSummary: {
        url: rawUrl,
        method,
      },
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return {
      success: false,
      shouldRetry: false,
      error: "post_webhook requires a valid URL",
      requestSummary: {},
    };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return {
      success: false,
      shouldRetry: false,
      error: "post_webhook URL must be http or https",
      requestSummary: {
        url: rawUrl,
      },
    };
  }

  const rawBodyTemplate = metadata.bodyTemplate;
  if (method === "GET" && typeof rawBodyTemplate === "string" && rawBodyTemplate.trim()) {
    return {
      success: false,
      shouldRetry: false,
      error: "GET method cannot have a body template",
      requestSummary: {
        url: rawUrl,
        method,
      },
    };
  }

  const headers: Record<string, string> = {};
  const rawHeaders = metadata.headers;
  if (Array.isArray(rawHeaders)) {
    for (const rawHeader of rawHeaders) {
      const header = (rawHeader || {}) as { key?: unknown; value?: unknown };
      const key = String(header.key || "").trim();
      if (!key) {
        return {
          success: false,
          shouldRetry: false,
          error: "post_webhook header keys must be non-empty",
          requestSummary: {
            url: rawUrl,
            method,
          },
        };
      }
      headers[key] = String(header.value || "");
    }
  }

  const timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS;
  let body: string | undefined;

  if (method !== "GET") {
    if (typeof rawBodyTemplate === "string" && rawBodyTemplate.trim()) {
      try {
        const rendered = renderBodyTemplate(rawBodyTemplate, payload);
        body = JSON.stringify(JSON.parse(rendered));
      } catch {
        return {
          success: false,
          shouldRetry: false,
          error: "Body template must be valid JSON after substitution",
          requestSummary: {
            url: rawUrl,
            method,
            timeoutMs,
          },
        };
      }
    } else {
      body = JSON.stringify(payload);
    }
  }

  const requestSummary: Record<string, unknown> = {
    url: rawUrl,
    method,
    headerNames: Object.keys(headers),
    bodyPreview: body ? body.slice(0, 500) : null,
    timeoutMs,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(rawUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body,
      signal: controller.signal,
    });

    const responseBody = await response.text();

    if (response.status >= 500) {
      return {
        success: false,
        shouldRetry: true,
        error: `post_webhook failed with status ${response.status}`,
        requestSummary,
        responseStatus: response.status,
        responseBody,
      };
    }

    if (response.status >= 400) {
      return {
        success: false,
        shouldRetry: false,
        error: `post_webhook failed with status ${response.status}`,
        requestSummary,
        responseStatus: response.status,
        responseBody,
      };
    }

    return {
      success: true,
      shouldRetry: false,
      requestSummary,
      responseStatus: response.status,
      responseBody,
      output: {
        status: response.status,
        response: responseBody,
      },
    };
  } catch (error) {
    return {
      success: false,
      shouldRetry: true,
      error: String(error),
      requestSummary,
    };
  } finally {
    clearTimeout(timeout);
  }
}
