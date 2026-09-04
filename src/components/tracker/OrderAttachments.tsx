import { useEffect, useState } from "react";
import { Camera, Mic, Paperclip, Square, Trash2 } from "lucide-react";
import { uid } from "@/lib/tracker-storage";
import {
  attachmentIds,
  deleteAttachment,
  saveAttachment,
  useOrderAttachments,
} from "@/lib/attachments";

interface AttachmentProps {
  orderId?: string;
  photoIds?: string[];
  voiceNoteIds?: string[];
  onChange?: (photoIds: string[], voiceNoteIds: string[]) => void;
}

export function OrderAttachmentList({ photoIds, voiceNoteIds, onChange }: AttachmentProps) {
  const ids = attachmentIds(photoIds, voiceNoteIds);
  const attachments = useOrderAttachments(ids);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const attachment of attachments)
      next[attachment.id] = URL.createObjectURL(attachment.blob);
    setUrls(next);
    return () => Object.values(next).forEach((url) => URL.revokeObjectURL(url));
  }, [attachments]);

  if (attachments.length === 0) return null;
  const editable = Boolean(onChange);

  async function remove(id: string) {
    await deleteAttachment(id);
    onChange?.(
      (photoIds ?? []).filter((attachmentId) => attachmentId !== id),
      (voiceNoteIds ?? []).filter((attachmentId) => attachmentId !== id),
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {attachments
          .filter((attachment) => attachment.kind === "photo")
          .map((attachment) => (
            <div key={attachment.id} className="relative">
              {urls[attachment.id] && (
                <a
                  href={urls[attachment.id]}
                  target="_blank"
                  rel="noreferrer"
                  title={attachment.name}
                >
                  <img
                    src={urls[attachment.id]}
                    alt={attachment.name}
                    className="size-20 rounded-xl object-cover border border-border"
                  />
                </a>
              )}
              {editable && (
                <button
                  type="button"
                  onClick={() => void remove(attachment.id)}
                  className="absolute -right-2 -top-2 size-7 rounded-full bg-destructive text-white grid place-items-center"
                  aria-label={`Удалить ${attachment.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
      </div>
      {attachments
        .filter((attachment) => attachment.kind === "voice")
        .map((attachment) => (
          <div key={attachment.id} className="flex items-center gap-2">
            <Mic className="size-4 text-primary shrink-0" />
            {urls[attachment.id] && (
              <audio src={urls[attachment.id]} controls className="h-10 min-w-0 flex-1" />
            )}
            {editable && (
              <button
                type="button"
                onClick={() => void remove(attachment.id)}
                className="min-h-10 min-w-10 rounded-lg text-destructive"
                aria-label={`Удалить ${attachment.name}`}
              >
                <Trash2 className="mx-auto size-4" />
              </button>
            )}
          </div>
        ))}
    </div>
  );
}

export function AttachmentEditor({
  orderId,
  photoIds = [],
  voiceNoteIds = [],
  onChange,
}: AttachmentProps) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);

  async function addPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const added = await Promise.all(
        files.map(async (file) => {
          const blob = await compressPhoto(file);
          return saveAttachment(blob, {
            id: uid(),
            kind: "photo",
            orderId: orderId ?? "",
            name: file.name || "Фото",
            mimeType: blob.type || "image/jpeg",
            createdAt: new Date().toISOString(),
          });
        }),
      );
      onChange?.([...photoIds, ...added.map((attachment) => attachment.id)], voiceNoteIds);
    } catch {
      setError("Не удалось сохранить фото. Попробуйте выбрать файл ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Запись голоса не поддерживается этим браузером.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recordingStarted = Date.now();
      const nextRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      nextRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      nextRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: nextRecorder.mimeType || "audio/webm" });
        void saveVoice(blob, Date.now() - recordingStarted);
      };
      nextRecorder.start();
      setRecorder(nextRecorder);
      setRecording(true);
      setError(null);
    } catch {
      setError("Нет доступа к микрофону. Разрешите его в настройках браузера или телефона.");
    }
  }

  function stopRecording() {
    recorder?.stop();
    setRecorder(null);
    setRecording(false);
  }

  async function saveVoice(blob: Blob, elapsedMs: number) {
    setBusy(true);
    try {
      const saved = await saveAttachment(blob, {
        id: uid(),
        kind: "voice",
        orderId: orderId ?? "",
        name: `Голосовая заметка ${new Date().toLocaleString("ru-RU")}`,
        mimeType: blob.type || "audio/webm",
        duration: Math.max(0, Math.round(elapsedMs / 100) / 10),
        createdAt: new Date().toISOString(),
      });
      onChange?.(photoIds, [...voiceNoteIds, saved.id]);
    } catch {
      setError("Не удалось сохранить голосовую заметку.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        <Paperclip className="size-4" /> Вложения к заказу
      </div>
      <OrderAttachmentList
        orderId={orderId}
        photoIds={photoIds}
        voiceNoteIds={voiceNoteIds}
        onChange={onChange}
      />
      <div className="flex gap-2">
        <label className="flex-1 min-h-11 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer">
          <Camera className="size-4" /> {busy ? "Сохраняю..." : "Добавить фото"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={busy || recording}
            onChange={(event) => void addPhotos(event)}
            className="sr-only"
          />
        </label>
        <button
          type="button"
          onClick={recording ? stopRecording : () => void startRecording()}
          disabled={busy}
          className={`flex-1 min-h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 ${
            recording ? "bg-destructive text-white" : "bg-secondary text-secondary-foreground"
          }`}
        >
          {recording ? (
            <Square className="size-4" fill="currentColor" />
          ) : (
            <Mic className="size-4" />
          )}
          {recording ? "Остановить" : "Голосовая заметка"}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

async function compressPhoto(file: File) {
  if (typeof createImageBitmap === "undefined") return file;
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.78);
  });
}
