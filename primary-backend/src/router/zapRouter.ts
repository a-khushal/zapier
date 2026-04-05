import dotenv from "dotenv"
dotenv.config({ path: "../.env" });

import { Router } from "express";
import crypto from "crypto";
import { authMiddleWare } from "../middleware";
import { ZapCreateSchema } from "../types";
import { db } from "../db";
import { ExtendedRequest } from "./userRouter";

const router = Router()

function getEncryptionKey() {
    const rawKey = process.env.ACTIONS_ENCRYPTION_KEY;
    if (!rawKey) {
        return null;
    }
    return crypto.createHash("sha256").update(rawKey).digest();
}

function encryptSecret(value: string) {
    if (value.startsWith("enc:v1:")) {
        return value;
    }

    const key = getEncryptionKey();
    if (!key) {
        throw new Error("ACTIONS_ENCRYPTION_KEY is required to save auth secrets");
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function encryptActionMetadata(metadata: any) {
    if (!metadata || typeof metadata !== "object") {
        return metadata;
    }

    const nextMetadata = { ...metadata };
    const auth = nextMetadata.auth;
    if (!auth || typeof auth !== "object") {
        return nextMetadata;
    }

    const nextAuth = { ...auth };
    if (
        nextAuth.type === "api_key" &&
        typeof nextAuth.value === "string" &&
        nextAuth.value
    ) {
        nextAuth.value = encryptSecret(nextAuth.value);
    }

    nextMetadata.auth = nextAuth;
    return nextMetadata;
}

router.post("", authMiddleWare, async (req, res) => {
    try {
        const parsedResponse = ZapCreateSchema.safeParse(req.body);
        if (!parsedResponse.success) {
            throw { status: 411, message: "Incorrect inputs" };
        }

        const extendedReq = req as ExtendedRequest;
        const userId = extendedReq.id;

        const zapId = await db.$transaction(async (tx) => {
            const zap = await tx.zap.create({
                data: {
                    userId,
                    triggerId: "",
                    actions: {
                        create: parsedResponse.data.actions.map((x, idx) => ({
                            actionId: x.availableActionId,
                            metadata: encryptActionMetadata(x.actionMetadata || {}),
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
