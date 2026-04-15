"use client";

type JsonPayloadModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  value: string;
  confirmLabel?: string;
  isSubmitting?: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function JsonPayloadModal({
  isOpen,
  title,
  description,
  value,
  confirmLabel = "Submit",
  isSubmitting = false,
  onChange,
  onClose,
  onConfirm,
}: JsonPayloadModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description && <p className="mt-1 text-xs text-gray-600">{description}</p>}

        <textarea
          rows={10}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-3 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
          placeholder='{"name":"Alice","event":"signup"}'
        />

        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              isSubmitting
                ? "cursor-not-allowed bg-gray-300 text-gray-600"
                : "bg-[#ff4f00] text-white hover:bg-[#ff4f00]/90"
            }`}
          >
            {isSubmitting ? "Sending..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
