import { z } from "zod";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "bmp", "tiff"];
const VIDEO_EXTS = ["mp4", "webm", "avi", "mov", "mkv"];
const AUDIO_EXTS = ["mp3", "wav", "ogg", "aac", "flac", "m4a"];

const ALL_ALLOWED_INPUTS = [...IMAGE_EXTS, ...VIDEO_EXTS, ...AUDIO_EXTS];

export const fileSchema = z
  .object({
    file: z
      .custom<File>((val) => val instanceof File, "File is required")
      .refine(
        (file) => file.size <= MAX_FILE_SIZE,
        "File size must be less than 2GB",
      )
      .refine((file) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        return ALL_ALLOWED_INPUTS.includes(ext || "");
      }, `Invalid file type.`),
    format: z.string().min(1, "Please select an output format"),
  })
  .refine(
    (data) => {
      const inputExt = data.file.name.split(".").pop()?.toLowerCase() || "";
      const outputExt = data.format.toLowerCase();

      // 1. Prevent same-format conversion
      if (inputExt === outputExt) return false;
      if (inputExt === "jpeg" && outputExt === "jpg") return false;
      if (inputExt === "jpg" && outputExt === "jpeg") return false;

      // 2. Validate categories
      if (IMAGE_EXTS.includes(inputExt)) {
        return ["png", "jpg", "webp"].includes(outputExt);
      }
      if (VIDEO_EXTS.includes(inputExt)) {
        return ["mp4", "webm", "avi", "mov", "mkv"].includes(outputExt);
      }
      if (AUDIO_EXTS.includes(inputExt)) {
        return ["mp3", "ogg", "wav", "aac", "flac"].includes(outputExt);
      }
      
      return false;
    },
    {
      message: "Invalid conversion: Cannot convert to the same format or incompatible type.",
      path: ["format"],
    },
  );

export type FileValues = z.infer<typeof fileSchema>;
