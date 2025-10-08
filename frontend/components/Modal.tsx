"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
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
            className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 transition-colors w-full text-left"
        >
            <img src={icon} alt={title} className="w-8 h-8 rounded-md" />
            <span className="text-gray-900 font-medium">{title}</span>
        </button>
    );
};

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    children,
    title = "Select an App"
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
            <div className="bg-gray-50 rounded-lg shadow-xl w-[500px] max-w-[calc(100%-32px)] max-h-[80vh] overflow-hidden flex flex-col">
                <div className="border-b border-gray-200 p-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1 space-y-2">{children}</div>
            </div>
        </div>
    );
};

export default Modal;
