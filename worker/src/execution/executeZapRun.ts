import { BACKOFF_MS, MAX_ATTEMPTS } from "../config";
import { db } from "../db";
import { executePostWebhook } from "../actions/postWebhook";
import { ActionExecutionResult, ActionForExecution } from "../types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeAction(action: ActionForExecution, payload: unknown): Promise<ActionExecutionResult> {
  if (action.actionId === "post_webhook") {
    return executePostWebhook(action, payload);
  }

  return {
    success: false,
    shouldRetry: false,
    error: `Unsupported action type: ${action.actionId}`,
    requestSummary: {
      actionId: action.actionId,
    },
  };
}

export async function executeZapRun(zapRunId: string) {
  const zapRun = await db.zapRun.findUnique({
    where: { id: zapRunId },
    include: {
      zap: {
        include: {
          actions: {
            orderBy: { sortingOrder: "asc" },
          },
        },
      },
    },
  });

  if (!zapRun) {
    return;
  }

  const payload = zapRun.metadata;

  for (const action of zapRun.zap.actions) {
    const startedAt = new Date();
    const step = await db.zapRunStep.create({
      data: {
        zapRunId: zapRun.id,
        actionId: action.id,
        status: "FAILED",
        input: payload as any,
        startedAt,
      },
    });

    let finalError = "Action failed";
    let finalOutput: Record<string, unknown> | null = null;
    let attemptCount = 0;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      attemptCount = attempt;
      const attemptStartedAt = new Date();

      const result = await executeAction(
        {
          id: action.id,
          actionId: action.actionId,
          metadata: action.metadata,
        },
        payload
      );

      await db.zapRunStepAttempt.create({
        data: {
          zapRunStepId: step.id,
          attemptNumber: attempt,
          requestSummary: result.requestSummary as any,
          responseStatus: result.responseStatus,
          responseBody: result.responseBody,
          error: result.error,
          startedAt: attemptStartedAt,
          completedAt: new Date(),
        },
      });

      if (result.success) {
        finalOutput = result.output || null;
        break;
      }

      if (result.error) {
        finalError = result.error;
      }

      if (!result.shouldRetry || attempt === MAX_ATTEMPTS) {
        break;
      }

      await sleep(BACKOFF_MS[attempt - 1] || BACKOFF_MS[BACKOFF_MS.length - 1]);
    }

    if (finalOutput) {
      await db.zapRunStep.update({
        where: { id: step.id },
        data: {
          status: "SUCCESS",
          output: finalOutput as any,
          attemptCount,
          completedAt: new Date(),
        },
      });
      continue;
    }

    await db.zapRunStep.update({
      where: { id: step.id },
      data: {
        status: "FAILED",
        error: finalError,
        attemptCount,
        completedAt: new Date(),
      },
    });

    throw new Error(finalError);
  }
}
