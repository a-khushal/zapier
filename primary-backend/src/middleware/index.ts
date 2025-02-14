import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken"
const JWT_SECRET = process.env.JWT_SECRET || "SUPER_SECRET"

export function authMiddleWare(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        res.status(401).json({
            message: "You are not logged in"
        })
        return;
    }

    const token = authHeader.split(" ")[1];
    
    try {
        const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
        // @ts-ignore
        req.id = payload.userId
        next()
    } catch (error) {
        console.log(error);
        res.status(400).json({
            message: "You are not logged in"
        })
    }
}