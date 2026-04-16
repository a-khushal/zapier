import { DEFAULT_REQUEST_TIMEOUT_MS } from "../config";
import { renderBodyTemplate } from "../template/bodyTemplate";
import { ActionExecutionResult, ActionForExecution } from "../types";

function asMetadataObject(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }
  return metadata as Record<string, unknown>;
}

export async function executeSendSlack(
  action: ActionForExecution,
  payload: unknown
): Promise<ActionExecutionResult> {
  const metadata = asMetadataObject(action.metadata);
  const webhookUrl = metadata.webhookUrl;
  const messageTemplate = metadata.messageTemplate;

  if (!webhookUrl || typeof webhookUrl !== "string") {
    return {
      success: false,
      shouldRetry: false,
      error: "send_slack requires metadata.webhookUrl",
      requestSummary: {},
    };
  }

  if (!messageTemplate || typeof messageTemplate !== "string" || !messageTemplate.trim()) {
    return {
      success: false,
      shouldRetry: false,
      error: "send_slack requires metadata.messageTemplate",
      requestSummary: {
        webhookUrl,
      },
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    return {
      success: false,
      shouldRetry: false,
      error: "send_slack requires a valid webhookUrl",
      requestSummary: {},
    };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return {
      success: false,
      shouldRetry: false,
      error: "send_slack webhookUrl must be http or https",
      requestSummary: {
        webhookUrl,
      },
    };
  }

  const text = renderBodyTemplate(messageTemplate, payload);
  const requestBody: Record<string, string> = {
    text,
  };

  if (typeof metadata.username === "string" && metadata.username.trim()) {
    requestBody.username = metadata.username;
  }

  if (typeof metadata.iconEmoji === "string" && metadata.iconEmoji.trim()) {
    requestBody.icon_emoji = metadata.iconEmoji;
  }

  if (typeof metadata.channel === "string" && metadata.channel.trim()) {
    requestBody.channel = metadata.channel;
  }

  const requestSummary: Record<string, unknown> = {
    webhookUrl,
    bodyPreview: JSON.stringify(requestBody).slice(0, 500),
    timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const responseBody = await response.text();

    if (response.status >= 500) {
      return {
        success: false,
        shouldRetry: true,
        error: `send_slack failed with status ${response.status}`,
        requestSummary,
        responseStatus: response.status,
        responseBody,
      };
    }

    if (response.status >= 400) {
      return {
        success: false,
        shouldRetry: false,
        error: `send_slack failed with status ${response.status}`,
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
