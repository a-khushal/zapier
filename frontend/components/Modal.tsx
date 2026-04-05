"use client";

import React, { useEffect } from "react";
import { Loader2, X } from "lucide-react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
    loading: boolean;
}

export interface ModalItemProps {
    title: string;
    icon: string; // URL
    onClick?: () => void;
}

export const ModalItem: React.FC<ModalItemProps> = ({ title, icon, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
            <img src={icon} alt={title} className="h-8 w-8 rounded-md object-cover" />
            <span className="text-sm font-medium text-gray-900">{title}</span>
        </button>
    );
};

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    children,
    title = "Select an App",
    loading
}) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {loading ? (
                <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : (
                <div className="flex max-h-[80vh] w-[520px] max-w-[calc(100%-32px)] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
                    <div className="border-b border-gray-200 p-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                        <button
                            onClick={onClose}
                            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-4">{children}</div>
                </div>
            )}
        </div>
    );
};

export default Modal;
