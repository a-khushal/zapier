import dotenv from "dotenv"
dotenv.config({ path: "./.env" });

import express, { Request, Response } from "express"
import { userRouter } from "./router/userRouter";
import { zapRouter } from "./router/zapRouter";
import cors from "cors"
import { triggerRouter } from "./router/triggerRouter";
import { actionRouter } from "./router/actionRouter";

const app = express()
app.use(express.json())
app.use(cors())

app.use("/api/v1/user", userRouter);
app.use("/api/v1/zap", zapRouter);
app.use("/api/v1/trigger", triggerRouter);
app.use("/api/v1/action", actionRouter);

app.listen(8080, () => {
    console.log("server running at port 8080")
})