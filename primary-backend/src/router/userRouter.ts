import dotenv from "dotenv"
dotenv.config({ path: "../.env" });

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
        const parsedResponse = SignUpSchema.safeParse(req.body);
        if (!parsedResponse.success) {
            throw { status: 422, message: "Incorrect inputs" };
        }

        const existingUser = await db.user.findUnique({
            where: { email: parsedResponse.data.email },
        });
        if (existingUser) {
            throw { status: 403, message: "User already exists" };
        }

        const hashedPassword = await bcrypt.hash(parsedResponse.data.password, 5);

        await db.user.create({
            data: {
                name: parsedResponse.data.userName,
                email: parsedResponse.data.email,
                password: hashedPassword,
            },
        });

        // await sendEmail()

        res.json({
            message: "Please verify your account via the email sent to you",
        });
    } catch (error: any) {
        console.error("Signup error:", error);
        res.status(error.status || 500).json({
            message: error.message || "Internal Server Error",
        });
    }
});

router.post("/signin", async (req, res) => {
    try {
        const parsedResponse = SignInSchema.safeParse(req.body);
        if (!parsedResponse.success) {
            throw { status: 422, message: "Incorrect inputs" };
        }

        const user = await db.user.findUnique({
            where: { email: parsedResponse.data.email },
        });
        if (!user) {
            throw { status: 401, message: "User not found" };
        }

        const validPassword = await bcrypt.compare(
            parsedResponse.data.password,
            user.password
        );
        if (!validPassword) {
            throw { status: 401, message: "Incorrect password" };
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET);

        res.json({
            message: "Login Successful",
            token,
        });
    } catch (error: any) {
        console.error("Signin error:", error);
        res.status(error.status || 500).json({
            message: error.message || "Internal Server Error",
        });
    }
});

router.get("/", authMiddleWare, async (req, res) => {
    try {
        const extendedReq = req as ExtendedRequest;
        const id = extendedReq.id;

        const user = await db.user.findUnique({
            where: { id },
            select: { name: true, email: true },
        });

        if (!user) {
            throw { status: 404, message: "User not found" };
        }

        res.json({ user });
    } catch (error: any) {
        console.error("User fetch error:", error);
        res.status(error.status || 500).json({
            message: error.message || "Internal Server Error",
        });
    }
});

export const userRouter = router;