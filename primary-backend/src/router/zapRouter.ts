import dotenv from "dotenv"
dotenv.config({ path: "../.env" });

import { Router } from "express";
import { authMiddleWare } from "../middleware";
import { ZapCreateSchema } from "../types";
import { db } from "../db";
import { ExtendedRequest } from "./userRouter";

const router = Router()

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