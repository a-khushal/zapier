"use client"

import { ArrowRightIcon } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"

export default function Hero() {
    return (
        <div className="grid grid-cols-2 xl:px-72">
            <div className="px-6 mt-40">
                <LeftSection/>
            </div>
            <div className="px-6 mt-20">
                <RightSection/>
            </div>
        </div>
    )
}

function LeftSection() {
    const router = useRouter()
    return (
        <div>
            <span className="inline-block hover:cursor-pointer">
                <span className="flex justify-start items-center rounded-full bg-slate-100 py-1 px-3 gap-2 text-sm">
                    <span className="flex justify-center items-center border-black border py-1 px-2 rounded-full">New</span>
                    <span className="flex justify-center items-center">Zapier Enterprise is here <ArrowRightIcon className="w-5 m-1"/></span>
                </span>
            </span>
            <div className="mt-6 tracking-tighter text-[85px] leading-[80px] font-black">
                <div>Automate</div>
                <div>without limits</div>
            </div>
            <div className="mt-4 text-2xl text-justify">
                Turn chaos into smooth operations by automating workflows yourself—no developers, no IT tickets, no delays. The only limit is your imagination.
            </div>
            <div className="flex justify-start mt-12 items-center gap-4">
                <div className="bg-orange-500 text-lg font-medium text-white py-2 px-10 rounded-full hover:cursor-pointer hover:bg-amber-700" onClick={() => router.push("/signup")}>Start free with email</div>
                <div className="flex justify-center items-center border-black border py-2 px-6 rounded-full hover:cursor-pointer hover:border-2">
                    <GOogleSVG />
                    <span className="ml-2 text-lg font-medium">Start free with Google</span>
                </div>  
            </div>
        </div>
    )
}


export const GOogleSVG = () => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="25" height="25" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
        </svg>
    )
}

function RightSection() {
    return (
        <Image
            src="/hero.png"
            width={550}
            height={0}
            alt="hero"
        />
    )
}