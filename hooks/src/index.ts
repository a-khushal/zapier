import express, { Request, Response } from "express"
import { PrismaClient } from "@prisma/client"

const client = new PrismaClient()

const app = express()
app.use(express.json())

app.post("/hooks/catch/:userId/:zapId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId
    const zapId = req.params.zapId
    const body = req.body

    const zap = await client.zap.findFirst({
      where: {
        id: zapId,
        userId: userId
      },
      select: {
        id: true
      }
    })

    if (!zap) {
      res.status(404).json({
        message: "Zap not found"
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
