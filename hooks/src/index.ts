import express, { Request, Response } from "express"
import cors from "cors"
import { PrismaClient } from "@prisma/client"

const client = new PrismaClient()

const app = express()
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}))

app.use(express.json())

app.post("/hooks/catch/:userId/:zapId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId
    const zapId = req.params.zapId
    const body = req.body

    const zapRows = await client.$queryRaw<Array<{ id: string; isActive: boolean }>>`
      SELECT "id", "isActive"
      FROM "Zap"
      WHERE "id" = ${zapId} AND "userId" = ${userId}
      LIMIT 1
    `
    const zap = zapRows[0]

    if (!zap) {
      res.status(404).json({
        message: "Zap not found"
      })
      return
    }

    if (!zap.isActive) {
      res.status(200).json({
        message: "zap is paused"
      })
      return
    }

    await client.$transaction(async tx => {
      const zapRun = await tx.zapRun.create({
        data: {
          zapId: zapId,
          metadata: body
        }
      })

      await tx.zapRunOutbox.create({
        data: {
          zapRunId: zapRun.id
        }
      })
    })

    res.json({
      message: 'webhook received'
    })
  } catch (error: any) {
    console.error("hook catch error:", error)
    res.status(500).json({
      message: "Failed to process webhook"
    })
  }
})

app.listen(3001, () => {
  console.log("server running at port 3001")
})
