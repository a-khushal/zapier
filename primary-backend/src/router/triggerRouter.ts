import { Router } from "express";
import { db } from "../db";
import { authMiddleWare } from "../middleware";

const router = Router();

router.get("/available", authMiddleWare, async (_req, res) => {
    const availableTriggers = await db.availableTrigger.findMany({});
    res.json({
        availableTriggers
    })
});

export const triggerRouter = router;