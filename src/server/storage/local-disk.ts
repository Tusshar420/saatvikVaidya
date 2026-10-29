import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { InvalidFileKeyError, isValidFileKey } from "./files";
import type { Storage } from "./index";

/**
 * Storage in a folder on this machine (STORAGE_DIR). Keys are checked twice:
 * against the key pattern, and that the resolved path stays inside `root`,
 * so a key can never reach another folder. Files are written to a temporary
 * name first and then renamed, so a reader never sees half a file.
 */
export function createLocalDiskStorage(root: string): Storage {
  const base = resolve(root);

  function pathOf(key: string): string {
    if (!isValidFileKey(key)) throw new InvalidFileKeyError(key);
    const path = resolve(base, key);
    const inside = relative(base, path);
    if (!inside || inside.startsWith("..") || inside.includes(`..${sep}`)) {
      throw new InvalidFileKeyError(key);
    }
    return path;
  }

  return {
    async put(key, body) {
      const path = pathOf(key);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const temporary = join(
        dirname(path),
        `.upload-${randomBytes(8).toString("hex")}`,
      );
      try {
        await writeFile(temporary, body, { mode: 0o600 });
        await rename(temporary, path);
      } catch (error) {
        await rm(temporary, { force: true });
        throw error;
      }
    },

    async get(key) {
      const path = pathOf(key);
      const info = await stat(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (!info?.isFile()) return null;
      return {
        size: info.size,
        body: Readable.toWeb(
          createReadStream(path),
        ) as ReadableStream<Uint8Array>,
      };
    },

    async delete(key) {
      await rm(pathOf(key), { force: true });
    },
  };
}
