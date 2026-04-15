import dotenv from "dotenv"
dotenv.config({ path: "../.env" });

import { Router } from "express";
import { authMiddleWare } from "../middleware";
import { TestPostWebhookSchema, ValidatePostWebhookMetadataSchema, ZapCreateSchema } from "../types";
import { db } from "../db";
import { ExtendedRequest } from "./userRouter";

const router = Router()
const REQUEST_TIMEOUT_MS = 10000;

function resolvePayloadPath(payload: any, path: string) {
    const keys = path.split(".");
    let value = payload;

    for (const key of keys) {
        if (value === null || value === undefined) {
            return "";
        }
        value = value[key];
    }

    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "object") {
        return JSON.stringify(value);
    }

    return String(value);
}

function renderBodyTemplate(template: string, payload: any) {
    return template.replace(/\{\{\s*payload\.([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, path) => {
        return resolvePayloadPath(payload, path);
    });
}

function getDurationMs(startedAt?: Date | null, completedAt?: Date | null) {
    if (!startedAt || !completedAt) {
        return null;
    }
    return completedAt.getTime() - startedAt.getTime();
}

function getRunStatusFromSteps(steps: Array<{ status: string }>) {
    if (steps.length === 0) {
        return "PENDING";
    }
    if (steps.some((step) => step.status === "FAILED")) {
        return "FAILED";
    }
    if (steps.every((step) => step.status === "SUCCESS")) {
        return "SUCCESS";
    }
    return "PENDING";
}

router.post("", authMiddleWare, async (req, res) => {
    try {
        const parsedResponse = ZapCreateSchema.safeParse(req.body);
        if (!parsedResponse.success) {
            throw { status: 411, message: "Incorrect inputs" };
        }

        const extendedReq = req as ExtendedRequest;
        const userId = extendedReq.id;

        const parsedActions = parsedResponse.data.actions.map((action) => {
            if (action.availableActionId !== "post_webhook") {
                return {
                    ...action,
                    actionMetadata: action.actionMetadata || {},
                };
            }

            const metadataParsed = ValidatePostWebhookMetadataSchema.safeParse(action.actionMetadata || {});
            if (!metadataParsed.success) {
                throw { status: 422, message: "Invalid post_webhook action metadata" };
            }

            return {
                ...action,
                actionMetadata: metadataParsed.data,
            };
        });

        const zapId = await db.$transaction(async (tx) => {
            const zap = await tx.zap.create({
                data: {
                    userId,
                    triggerId: "",
                    actions: {
                        create: parsedActions.map((x, idx) => ({
                            actionId: x.availableActionId,
                            metadata: x.actionMetadata || {},
                            sortingOrder: idx,
                        })),
                    },
                },
            });

            const trigger = await tx.trigger.create({
                data: {
                    triggerId: parsedResponse.data.availableTriggerId,
                    zapId: zap.id,
                },
            });

            await tx.zap.update({
                where: { id: zap.id },
                data: { triggerId: trigger.id },
            });

            return zap.id;
        });

        res.json({
            message: "Successfully created zap",
            zapId,
        });
    } catch (error: any) {
        console.error("Zap creation error:", error);
        res.status(error.status || 500).json({
            message: error.message || "Internal server error",
        });
    }
});

router.post("/test-post-webhook", authMiddleWare, async (req, res) => {
    try {
        const parsedResponse = TestPostWebhookSchema.safeParse(req.body);
        if (!parsedResponse.success) {
            throw { status: 422, message: "Incorrect inputs" };
        }

        const metadata = parsedResponse.data.actionMetadata;
        const samplePayload = parsedResponse.data.samplePayload;

        const method = (metadata.method || "POST").toUpperCase();
        const headers: Record<string, string> = {};

        for (const header of metadata.headers || []) {
            if (header.key) {
                headers[header.key.trim()] = String(header.value || "");
            }
        }

        const requestUrl = metadata.url;

        let body: string | undefined = undefined;
        if (method !== "GET") {
            if (metadata.bodyTemplate) {
                try {
                    const rendered = renderBodyTemplate(metadata.bodyTemplate, samplePayload);
                    body = JSON.stringify(JSON.parse(rendered));
                } catch {
                    throw { status: 422, message: "Invalid body template JSON after rendering" };
                }
            } else {
                body = JSON.stringify(samplePayload);
            }
        }

        const requestPreview = {
            url: requestUrl,
            method,
            headerNames: Object.keys(headers),
            bodyPreview: body ? body.slice(0, 500) : null,
            timeoutMs: REQUEST_TIMEOUT_MS,
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(requestUrl, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    ...headers,
                },
                body,
                signal: controller.signal,
            });

            const responseBody = await response.text();

            res.json({
                ok: response.status < 400,
                requestPreview,
                responseStatus: response.status,
                responseBody,
            });
        } catch (error) {
            res.json({
                ok: false,
                requestPreview,
                error: String(error),
            });
        } finally {
            clearTimeout(timeout);
        }
    } catch (error: any) {
        console.error("Test post webhook error:", error);
        res.status(error.status || 500).json({
            message: error.message || "Internal server error",
        });
    }
});

router.get("", authMiddleWare, async (req, res) => {
    try {
        const extendedReq = req as ExtendedRequest;
        const userId = extendedReq.id;

        const zaps = await db.zap.findMany({
            where: {
                userId, // fixed: was `id: userId`, now correct
            },
            include: {
                trigger: {
                    include: { type: true },
                },
                actions: {
                    include: { type: true },
                },
            },
        });

        res.status(200).json({ zaps });
    } catch (error: any) {
        console.error("Fetching zaps error:", error);
        res.status(error.status || 500).json({
            message: error.message || "Internal server error",
        });
    }
});

router.get("/:zapId/runs", authMiddleWare, async (req, res) => {
    try {
        const extendedReq = req as ExtendedRequest;
        const userId = extendedReq.id;
        const { zapId } = req.params;

        const zap = await db.zap.findFirst({
            where: { id: zapId, userId },
            select: { id: true },
        });

        if (!zap) {
            throw { status: 404, message: "Zap not found" };
        }

        const runs = await db.zapRun.findMany({
            where: { zapId },
            include: {
                zapRunSteps: {
                    select: {
                        id: true,
                        status: true,
                        startedAt: true,
                        completedAt: true,
                        attemptCount: true,
                    },
                },
            },
        });

        const formattedRuns = runs
            .map((run) => {
                const stepStarts = run.zapRunSteps
                    .map((step) => step.startedAt)
                    .filter(Boolean)
                    .sort((a, b) => a.getTime() - b.getTime());
                const stepCompletions = run.zapRunSteps
                    .map((step) => step.completedAt)
                    .filter((value): value is Date => Boolean(value))
                    .sort((a, b) => a.getTime() - b.getTime());

                const startedAt = stepStarts.length > 0 ? stepStarts[0] : null;
                const completedAt = stepCompletions.length > 0 ? stepCompletions[stepCompletions.length - 1] : null;

                return {
                    id: run.id,
                    zapId: run.zapId,
                    metadata: run.metadata,
                    status: getRunStatusFromSteps(run.zapRunSteps),
                    startedAt,
                    completedAt,
                    durationMs: getDurationMs(startedAt, completedAt),
                    stepCount: run.zapRunSteps.length,
                    successStepCount: run.zapRunSteps.filter((step) => step.status === "SUCCESS").length,
                    failedStepCount: run.zapRunSteps.filter((step) => step.status === "FAILED").length,
                    totalAttempts: run.zapRunSteps.reduce((acc, step) => acc + (step.attemptCount || 0), 0),
                };
            })
            .sort((a, b) => {
                const aTime = a.startedAt ? a.startedAt.getTime() : 0;
                const bTime = b.startedAt ? b.startedAt.getTime() : 0;
                return bTime - aTime;
            });

        res.status(200).json({ runs: formattedRuns });
    } catch (error: any) {
        console.error("Fetching zap runs error:", error);
        res.status(error.status || 500).json({
            message: error.message || "Internal server error",
        });
    }
});

router.get("/run/:zapRunId", authMiddleWare, async (req, res) => {
    try {
        const extendedReq = req as ExtendedRequest;
        const userId = extendedReq.id;
        const { zapRunId } = req.params;

        const run = await db.zapRun.findFirst({
            where: {
                id: zapRunId,
                zap: {
                    userId,
                },
            },
            include: {
                zap: {
                    select: {
                        id: true,
                        userId: true,
                    },
                },
                zapRunSteps: {
                    orderBy: {
                        startedAt: "asc",
                    },
                    include: {
                        action: {
                            include: {
                                type: true,
                            },
                        },
                        attempts: {
                            orderBy: {
                                attemptNumber: "asc",
                            },
                        },
                    },
                },
            },
        });

        if (!run) {
            throw { status: 404, message: "Zap run not found" };
        }

        const stepStarts = run.zapRunSteps
            .map((step) => step.startedAt)
            .filter(Boolean)
            .sort((a, b) => a.getTime() - b.getTime());
        const stepCompletions = run.zapRunSteps
            .map((step) => step.completedAt)
            .filter((value): value is Date => Boolean(value))
            .sort((a, b) => a.getTime() - b.getTime());

        const startedAt = stepStarts.length > 0 ? stepStarts[0] : null;
        const completedAt = stepCompletions.length > 0 ? stepCompletions[stepCompletions.length - 1] : null;

        const formattedRun = {
            id: run.id,
            zapId: run.zapId,
            metadata: run.metadata,
            status: getRunStatusFromSteps(run.zapRunSteps),
            startedAt,
            completedAt,
            durationMs: getDurationMs(startedAt, completedAt),
            steps: run.zapRunSteps.map((step) => {
                const latestAttempt = step.attempts.length > 0 ? step.attempts[step.attempts.length - 1] : null;
                return {
                    id: step.id,
                    actionId: step.actionId,
                    actionName: step.action.type.name,
                    actionImage: step.action.type.image,
                    sortingOrder: step.action.sortingOrder,
                    status: step.status,
                    attemptCount: step.attemptCount,
                    input: step.input,
                    output: step.output,
                    error: step.error,
                    startedAt: step.startedAt,
                    completedAt: step.completedAt,
                    durationMs: getDurationMs(step.startedAt, step.completedAt),
                    latestResponseStatus: latestAttempt?.responseStatus || null,
                    latestResponsePreview: latestAttempt?.responseBody
                        ? latestAttempt.responseBody.slice(0, 500)
                        : null,
                    latestError: latestAttempt?.error || null,
                    attempts: step.attempts.map((attempt) => ({
                        id: attempt.id,
                        attemptNumber: attempt.attemptNumber,
                        requestSummary: attempt.requestSummary,
                        responseStatus: attempt.responseStatus,
                        responseBodyPreview: attempt.responseBody ? attempt.responseBody.slice(0, 500) : null,
                        error: attempt.error,
                        startedAt: attempt.startedAt,
                        completedAt: attempt.completedAt,
                        durationMs: getDurationMs(attempt.startedAt, attempt.completedAt),
                    })),
                };
            }),
        };

        res.status(200).json({ run: formattedRun });
    } catch (error: any) {
        console.error("Fetching zap run details error:", error);
        res.status(error.status || 500).json({
            message: error.message || "Internal server error",
        });
    }
});

router.delete("/:zapId", authMiddleWare, async (req, res) => {
    try {
        const extendedReq = req as ExtendedRequest;
        const userId = extendedReq.id;
        const { zapId } = req.params;

        const zap = await db.zap.findFirst({
            where: { id: zapId, userId },
            select: { id: true },
        });

        if (!zap) {
            throw { status: 404, message: "Zap not found" };
        }

        await db.$transaction(async (tx) => {
            const runs = await tx.zapRun.findMany({
                where: { zapId },
                select: { id: true },
            });

            const runIds = runs.map((run) => run.id);

            if (runIds.length > 0) {
                await tx.zapRunOutbox.deleteMany({
                    where: { zapRunId: { in: runIds } },
                });

                await tx.zapRun.deleteMany({
                    where: { id: { in: runIds } },
                });
            }

            await tx.action.deleteMany({ where: { zapId } });
            await tx.trigger.deleteMany({ where: { zapId } });
            await tx.zap.delete({ where: { id: zapId } });
        });

        res.status(200).json({ message: "Zap deleted successfully" });
    } catch (error: any) {
        console.error("Deleting zap error:", error);
        res.status(error.status || 500).json({
            message: error.message || "Internal server error",
        });
    }
});

router.get("/:zapId", authMiddleWare, async (req, res) => {
    try {
        const extendedReq = req as ExtendedRequest;
        const userId = extendedReq.id;
        const { zapId } = req.params;

        const zap = await db.zap.findFirst({
            where: { id: zapId, userId },
            include: {
                trigger: { include: { type: true } },
                actions: { include: { type: true } },
            },
        });

        if (!zap) {
            throw { status: 404, message: "Zap not found" };
        }

        res.status(200).json({ zap });
    } catch (error: any) {
        console.error("Fetching single zap error:", error);
        res.status(error.status || 500).json({
            message: error.message || "Internal server error",
        });
    }
});

export const zapRouter = router;
