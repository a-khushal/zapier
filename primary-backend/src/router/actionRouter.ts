import { Router } from "express";
import { db } from "../db";
import { authMiddleWare } from "../middleware";

const router = Router();

router.get("/available", authMiddleWare, async (req, res) => {
    const availableActions = await db.availableAction.findMany({});
    res.json({
        availableActions
    })
});

export const actionRouter = router;