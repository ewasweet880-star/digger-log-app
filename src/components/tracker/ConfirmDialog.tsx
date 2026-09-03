import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { useDialog } from "@/hooks/use-dialog";

interface Props {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Удалить",
  cancelLabel = "Отмена",
  destructive = true,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useDialog(true, onCancel);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-2xl space-y-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <div className="flex gap-3">
          <div className="size-10 rounded-xl bg-destructive/10 text-destructive grid place-items-center shrink-0">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h2 id="confirm-dialog-title" className="font-display text-lg uppercase">
              {title}
            </h2>
            <p id="confirm-dialog-description" className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-11 rounded-xl bg-secondary text-secondary-foreground font-semibold"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`flex-1 min-h-11 rounded-xl font-bold ${
              destructive
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
