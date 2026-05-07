import { VIDEO_EXTS } from "../../utils/constants.js";

/** Pushes video codec FFmpeg args and returns true if the conversion is supported. */
export function applyVideoArgs(inputExt: string, outputExt: string, args: string[]): boolean {
  if (!VIDEO_EXTS.includes(inputExt)) return false;

  if (outputExt === ".webm") {
    args.push(
      "-c:v", "libvpx-vp9",
      "-crf", "30",
      "-b:v", "0",
      "-cpu-used", "5",
      "-row-mt", "1",
      "-threads", "0",
      "-c:a", "libopus",
    );
    return true;
  }

  if ([".mp4", ".avi", ".mov", ".mkv"].includes(outputExt)) {
    args.push("-c:v", "libx264", "-preset", "medium", "-crf", "23");
    if (outputExt === ".mp4" || outputExt === ".mov") args.push("-pix_fmt", "yuv420p");
    if (outputExt === ".mp4") args.push("-movflags", "+faststart");
    args.push("-c:a", "aac", "-b:a", "128k");
    return true;
  }

  return false;
}
