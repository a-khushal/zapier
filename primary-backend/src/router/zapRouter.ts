import { Router } from "express";
import { authMiddleWare } from "../middleware";
import { ZapCreateSchema } from "../types";
import { db } from "../db";
import { ExtendedRequest } from "./userRouter";

const router = Router()

router.post("/", authMiddleWare, async (req, res) => {  
    try {
        const parsedResponse = ZapCreateSchema.safeParse(req.body);

        if (!parsedResponse.success) {
            res.status(411).json({
                message: "Incorrect inputs"
            })

            return;
        }

        const extendedReq = req as ExtendedRequest
        const userId = extendedReq.id;

        const zapId = await db.$transaction(async (tx) => {
            const zap = await tx.zap.create({
                data: {
                    userId,
                    triggerId: "", 
                    actions: {
                        create: parsedResponse.data.actions.map((x, idx) => ({
                            actionId: x.availableActionId,
                            sortingOrder: idx
                        }))
                    }
                }
            });
        
            const trigger = await tx.trigger.create({
                data: {
                    triggerId: parsedResponse.data.availableTriggerId,
                    zapId: zap.id
                }
            });
        
            await tx.zap.update({
                where: { id: zap.id },
                data: { triggerId: trigger.id }
            });

            return zap.id;
        });        
        
        res.json({
            message: "Successfully created zap",
            zapId
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({
            message: "Internal server error"
        })

        return;
    }
})

router.get("/", authMiddleWare, async (req, res) => {
    try {
        const extendedReq = req as ExtendedRequest
        const userId = extendedReq.id;

        const zaps = await db.zap.findMany({
            where: {
                userId
            }, include: {
                trigger: {
                    include: {
                        type: true
                    }
                },
                actions: {
                    include: {
                        type: true,
                    }
                }
            }
        })

        res.status(200).json({
            zaps
        });
    } catch (error) {
        res.status(500).json({
            message: "Internal server error"
        })

        return;
    }
})

router.get("/:zapId", authMiddleWare, async (req, res) => {
    try {
        const extendedReq = req as ExtendedRequest
        const userId = extendedReq.id;

        const zap = await db.zap.findFirst({
            where: {
                id: req.params.zapId,
                userId
            }, include: {
                trigger: {
                    include: {
                        type: true
                    }
                },
                actions: {
                    include: {
                        type: true,
                    }
                }
            }
        })

        res.status(200).json({
            zap
        });
    } catch (error) {
        res.status(500).json({
            message: "Internal server error"
        })

        return;
    }
})

export const zapRouter = router;