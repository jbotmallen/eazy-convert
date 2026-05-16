import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type FileRef = {
  id: string;
  name: string;
};

type RegisteredFile = {
  senderId: number;
  filePath: string;
  expiresAt: number;
};

const FILE_TOKEN_TTL_MS = 60 * 60 * 1000;
const registeredFiles = new Map<string, RegisteredFile>();

function purgeExpiredRegisteredFiles(now = Date.now()): void {
  for (const [id, entry] of registeredFiles) {
    if (entry.expiresAt <= now) registeredFiles.delete(id);
  }
}

export function registerFilePath(senderId: number, filePath: string): FileRef {
  purgeExpiredRegisteredFiles();
  if (!Number.isInteger(senderId)) throw new Error("Invalid file token owner.");
  if (typeof filePath !== "string" || !path.isAbsolute(filePath)) {
    throw new Error("Invalid file path.");
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error("File not found.");
  }

  const id = `file_${randomUUID()}`;
  registeredFiles.set(id, {
    senderId,
    filePath,
    expiresAt: Date.now() + FILE_TOKEN_TTL_MS,
  });
  return { id, name: path.basename(filePath) };
}

export function resolveRegisteredFilePath(senderId: number, fileId: string): string {
  purgeExpiredRegisteredFiles();
  if (!Number.isInteger(senderId)) throw new Error("Invalid file token owner.");
  if (typeof fileId !== "string") throw new Error("Invalid file token.");
  const entry = registeredFiles.get(fileId);
  if (!entry || entry.senderId !== senderId) throw new Error("File token is no longer valid.");
  entry.expiresAt = Date.now() + FILE_TOKEN_TTL_MS;
  return entry.filePath;
}
