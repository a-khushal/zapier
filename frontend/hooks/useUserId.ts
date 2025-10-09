"use client";

import jwt, { JwtPayload } from "jsonwebtoken";
import { useRouter } from "next/navigation";

export function useUserId(): string | null {
    const router = useRouter();

    const token = localStorage.getItem("token");
    if (!token) {
        router.push("/login");
        return null;
    }

    const pureToken = token.startsWith("Bearer ") ? token.split(" ")[1] : token;

    const decoded = jwt.decode(pureToken) as JwtPayload | null;

    return decoded?.userId as string | undefined ?? null;
}
