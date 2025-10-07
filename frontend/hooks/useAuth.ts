"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useAuth(redirectPath: string = "/login") {
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push(redirectPath);
        }
    }, [router, redirectPath]);

    return null;
}
