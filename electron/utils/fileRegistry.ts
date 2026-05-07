import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type FileRef = {
  id: string;
  name: string;
};

const registeredFiles = new Map<string, string>();

export function registerFilePath(filePath: string): FileRef {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath)) {
    throw new Error("Invalid file path.");
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error("File not found.");
  }

  const id = `file_${randomUUID()}`;
  registeredFiles.set(id, filePath);
  return { id, name: path.basename(filePath) };
}

export function resolveRegisteredFilePath(fileId: string): string {
  if (typeof fileId !== "string") throw new Error("Invalid file token.");
  const filePath = registeredFiles.get(fileId);
  if (!filePath) throw new Error("File token is no longer valid.");
  return filePath;
}
