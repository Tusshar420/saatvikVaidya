import "server-only";
import { resolve } from "node:path";
import { serverEnv } from "@/server/env";
import { createLocalDiskStorage } from "./local-disk";

/**
 * Where uploaded files live. Files are private: nothing in Storage is ever
 * served directly, only through routes that check who is asking (for example
 * /api/documents/[id]). Local disk now; Cloudflare R2 later only needs to
 * implement this interface. Keys look like "documents/<user>/<random>.pdf"
 * (see ./files.ts for the rules).
 */
export interface Storage {
  /** Saves `body` under `key`, replacing any file already there. */
  put(key: string, body: Uint8Array): Promise<void>;
  /** The file, or null if there's none under `key`. */
  get(key: string): Promise<StoredFile | null>;
  /** Removes the file; does nothing if it's already gone. */
  delete(key: string): Promise<void>;
}

export type StoredFile = {
  size: number;
  /** The contents, streamed (ebooks and images can be large). */
  body: ReadableStream<Uint8Array>;
};

let storage: Storage | undefined;

export function getStorage(): Storage {
  storage ??= createLocalDiskStorage(resolve(serverEnv().STORAGE_DIR));
  return storage;
}

/** Deletes files without failing the caller; a leftover file is only logged. */
export async function deleteFilesQuietly(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map((key) =>
      getStorage()
        .delete(key)
        .catch((error: unknown) => {
          console.error(`[storage] couldn't delete ${key}`, error);
        }),
    ),
  );
}

export {
  InvalidFileKeyError,
  isValidFileKey,
  newFileKey,
} from "./files";
