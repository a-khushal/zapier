"use client";

import React, { useState, useEffect } from "react";

interface AppItem {
    id: string;
    title: string;
    icon: string;
}

const apps: AppItem[] = [
    { id: "1", title: "Google Calendar", icon: "https://www.google.com/s2/favicons?sz=64&domain=calendar.google.com" },
    { id: "2", title: "Gmail", icon: "https://www.google.com/s2/favicons?sz=64&domain=gmail.com" },
    { id: "3", title: "Slack", icon: "https://www.google.com/s2/favicons?sz=64&domain=slack.com" },
    { id: "4", title: "Notion", icon: "https://www.google.com/s2/favicons?sz=64&domain=notion.so" },
    { id: "5", title: "ChatGPT (OpenAI)", icon: "https://www.google.com/s2/favicons?sz=64&domain=openai.com" },
    { id: "6", title: "Google Sheets", icon: "https://www.google.com/s2/favicons?sz=64&domain=sheets.google.com" },
    { id: "7", title: "HubSpot", icon: "https://www.google.com/s2/favicons?sz=64&domain=hubspot.com" },
    { id: "8", title: "Google Docs", icon: "https://www.google.com/s2/favicons?sz=64&domain=docs.google.com" },
];

export default function AppSelectorModal() {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<AppItem | null>(null);

    const handleSelect = (item: AppItem) => {
        setSelected(item);
        setOpen(false);
        console.log("Selected:", item);
    };

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <button
                onClick={() => setOpen(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
                {selected ? `Selected: ${selected.title}` : "Open App Selector"}
            </button>

            {open && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-5 w-[380px] max-h-[80vh] overflow-y-auto relative">
                        <button
                            onClick={() => setOpen(false)}
                            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center border border-gray-400 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition"
                        >
                            ✕
                        </button>

                        <h2 className="text-base font-semibold mb-4 text-gray-800">
                            Select an App
                        </h2>

                        <div className="flex flex-col gap-1">
                            {apps.map((app) => (
                                <div
                                    key={app.id}
                                    onClick={() => handleSelect(app)}
                                    className="flex items-center gap-3 p-2 rounded-lg border border-transparent hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition"
                                >
                                    <img
                                        src={app.icon}
                                        alt={app.title}
                                        className="w-6 h-6 rounded"
                                    />
                                    <p className="text-sm text-gray-700">{app.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
