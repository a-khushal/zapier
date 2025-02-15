"use client"
import { useRouter } from "next/navigation"

export default function Appbar() {
    const router = useRouter()
    return (
        <header className="flex justify-between items-center py-2 px-14 bg-white border-b-2 border-gray-20">
            <h1 className="font-black text-3xl hover:cursor-pointer flex" onClick={() => router.push("/")}><div className="h-1 w-4 bg-orange-500 mt-6 mr-px"></div>zapier</h1>
            <nav className="flex gap-6 items-center text-gray-800 text-sm">
                <div className="hover:cursor-pointer" onClick={() => router.push("/login")}>Log in</div>
                <div className="bg-orange-500 py-2 px-3 rounded-full hover:cursor-pointer text-white font-semibold" onClick={() => router.push("/signup")}>Sign up</div>
            </nav>
        </header>
    )
}