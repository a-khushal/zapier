require("dotenv").config()

import { Request, Router } from "express";
import { authMiddleWare } from "../middleware";
import { SignInSchema, SignUpSchema } from "../types";
import { db } from "../db";
import jwt from 'jsonwebtoken' 
import bcrypt from "bcrypt" 

const JWT_SECRET = process.env.JWT_SECRET as string || "SUPER_SECRET"

export interface ExtendedRequest extends Request {
    id: string
}

const router = Router()

router.post("/signup", async (req, res) => {
    try {
        const parsedResponse = SignUpSchema.safeParse(req.body)

        if (!parsedResponse.success) {  
            res.status(422).json({
                message: "Incorrect inputs"
            })

            return;
        }

        const existingUser = await db.user.findUnique({
            where: {
                email: parsedResponse.data.email
            }
        })

        if (existingUser) {
            res.status(403).json({
                message: "User already exists"
            })
            return;
        }

        const hashedPassword = await bcrypt.hash(parsedResponse.data.password, 5);

        const user = await db.user.create({
            data: {
                name: parsedResponse.data.userName,
                email: parsedResponse.data.email,
                password: hashedPassword
            }
        })

        // await sentEmail()

        res.json({
            message: "Please verify your account via the email sent to you",
        })
    } catch (error) {
        res.status(400).json({
            message: "Internal Server Error"
        })

        return;
    }
})

router.post("/signin", async (req, res) => {  
    try {
        const parsedResponse = SignInSchema.safeParse(req.body)

        if (!parsedResponse.success) {  
            res.status(422).json({
                message: "Incorrect inputs"
            })

            return;
        }

        const user = await db.user.findUnique({
            where: {
                email: parsedResponse.data.email
            }
        })

        if (!user) {
            res.status(401).json({
                message: "User not found"
            })
            return;
        }

        if (!bcrypt.compare(parsedResponse.data.password, user.password)) { 
            res.status(401).json({
                message: "Incorrect password"
            })
            return;
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET)

        res.json({
            message: "Login Successful",
            token
        })
    } catch (error) {
        res.status(400).json({
            message: "Internal Server Error"
        })
    }
})

router.get("/", authMiddleWare, async (req, res) => {
    try {
        const extendedReq = req as ExtendedRequest
        const id = extendedReq.id;
        const user = await db.user.findUnique({
            where: {
                id
            }, select: {
                name: true,
                email: true
            }
        })

        res.json({
            user
        })

    } catch (error) {
        res.status(400).json({
            message: "Internal Server Error"
        })
    }
})

export const userRouter = router;