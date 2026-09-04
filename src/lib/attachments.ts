import { useEffect, useState } from "react";

export type AttachmentKind = "photo" | "voice";

export interface AttachmentMeta {
  id: string;
  kind: AttachmentKind;
  orderId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  duration?: number;
}

export interface AttachmentExport extends AttachmentMeta {
  dataUrl: string;
}

interface StoredAttachment extends AttachmentMeta {
  blob: Blob;
}

const DB_NAME = "smena-media";
const STORE_NAME = "attachments";
const memoryStore = new Map<string, StoredAttachment>();

let databasePromise: Promise<IDBDatabase | null> | undefined;

function canUseIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openDatabase() {
  if (!canUseIndexedDb()) return Promise.resolve(null);
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return databasePromise;
}

export async function saveAttachment(
  blob: Blob,
  input: Omit<AttachmentMeta, "size"> & { size?: number },
) {
  const record: StoredAttachment = {
    ...input,
    size: input.size ?? blob.size,
    blob,
  };
  const database = await openDatabase();
  if (!database) {
    memoryStore.set(record.id, record);
    return record;
  }

  await requestAsPromise(database, "readwrite", (store) => store.put(record));
  return record;
}

export async function getAttachment(id: string) {
  const database = await openDatabase();
  if (!database) return memoryStore.get(id) ?? null;
  return (
    (await requestAsPromise<StoredAttachment | undefined>(database, "readonly", (store) =>
      store.get(id),
    )) ?? null
  );
}

export async function getAttachments(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids));
  const records = await Promise.all(uniqueIds.map((id) => getAttachment(id)));
  return records.filter((record): record is StoredAttachment => record !== null);
}

export async function deleteAttachment(id: string) {
  memoryStore.delete(id);
  const database = await openDatabase();
  if (!database) return;
  await requestAsPromise(database, "readwrite", (store) => store.delete(id));
}

export async function deleteAttachments(ids: string[]) {
  await Promise.all(ids.map((id) => deleteAttachment(id)));
}

export async function exportAttachments(ids: string[]) {
  const records = await getAttachments(ids);
  return Promise.all(
    records.map(async ({ blob, ...meta }) => ({
      ...meta,
      dataUrl: await blobToDataUrl(blob),
    })),
  );
}

export async function mergeAttachmentExports(exports: AttachmentExport[]) {
  await Promise.all(
    exports.map(async ({ dataUrl, ...meta }) => {
      await saveAttachment(dataUrlToBlob(dataUrl, meta.mimeType), meta);
    }),
  );
}

export async function replaceAttachments(exports: AttachmentExport[]) {
  const database = await openDatabase();
  memoryStore.clear();
  if (database) {
    await requestAsPromise(database, "readwrite", (store) => store.clear());
  }
  await mergeAttachmentExports(exports);
  notifyAttachmentChange();
}

export function useOrderAttachments(ids: string[]) {
  const key = ids.join(",");
  const [attachments, setAttachments] = useState<StoredAttachment[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void getAttachments(key ? key.split(",") : []).then((next) => {
        if (!cancelled) setAttachments(next);
      });
    };
    refresh();
    window.addEventListener("smena:attachments", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("smena:attachments", refresh);
    };
  }, [key]);

  return attachments;
}

export function attachmentIds(photoIds: string[] | undefined, voiceNoteIds: string[] | undefined) {
  return [...(photoIds ?? []), ...(voiceNoteIds ?? [])];
}

function requestAsPromise<T = unknown>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function notifyAttachmentChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("smena:attachments"));
}

function dataUrlToBlob(dataUrl: string, mimeType: string) {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return new Blob([], { type: mimeType });
  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  const isBase64 = header.includes(";base64");
  if (!isBase64) return new Blob([decodeURIComponent(payload)], { type: mimeType });

  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}
