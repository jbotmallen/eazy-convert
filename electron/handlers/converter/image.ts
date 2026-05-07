import { IMAGE_EXTS } from "../../utils/constants.js";

/** Returns true if image→image conversion is supported. No extra FFmpeg args needed. */
export function applyImageArgs(inputExt: string, outputExt: string): boolean {
  return IMAGE_EXTS.includes(inputExt) && [".png", ".jpg", ".webp"].includes(outputExt);
}
