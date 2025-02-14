import express, { Request, Response } from "express"
import { PrismaClient } from "@prisma/client"

const client = new PrismaClient()

const app = express()
app.use(express.json())

app.post("/hooks/catch/:userId/:zapId", async (req: Request, res: Response) => {
  const userId = req.params.userId
  const zapId = req.params.zapId

  const body = req.body

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
})

app.listen(3000, () => {
  console.log("server running at port 3000")
})
