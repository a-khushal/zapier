"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Appbar() {
    const router = useRouter();
    const [isSignedIn, setIsSignedIn] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token && token.startsWith("Bearer ")) {
            setIsSignedIn(true);
        } else {
            setIsSignedIn(false);
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        setIsSignedIn(false);
        router.push("/login");
    };

    return (
        <header className="flex justify-between items-center py-2 px-14 bg-white border-b-2 border-gray-20">
            <h1
                className="font-black text-3xl cursor-default flex"
                onClick={() => router.push("/")}
            >
                <div className="h-1 w-4 bg-orange-500 mt-6 mr-px"></div>
                Synq
            </h1>

            <nav className="flex gap-6 items-center text-gray-800 text-sm">
                {isSignedIn ? (
                    <div
                        className="bg-gray-200 py-2 px-3 rounded-full hover:cursor-pointer font-semibold"
                        onClick={handleLogout}
                    >
                        Log out
                    </div>
                ) : (
                    <>
                        <div
                            className="hover:cursor-pointer"
                            onClick={() => router.push("/login")}
                        >
                            Log in
                        </div>
                        <div
                            className="bg-orange-500 py-2 px-3 rounded-full hover:cursor-pointer text-white font-semibold"
                            onClick={() => router.push("/signup")}
                        >
                            Sign up
                        </div>
                    </>
                )}
            </nav>
        </header>
    );
}
