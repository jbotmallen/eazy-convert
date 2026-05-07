import { AUDIO_EXTS } from "../../utils/constants.js";

/** Pushes audio codec FFmpeg args and returns true if the conversion is supported. */
export function applyAudioArgs(inputExt: string, outputExt: string, args: string[]): boolean {
  if (!AUDIO_EXTS.includes(inputExt)) return false;

  switch (outputExt) {
    case ".ogg":  args.push("-c:a", "libvorbis", "-q:a", "4"); return true;
    case ".mp3":  args.push("-c:a", "libmp3lame", "-q:a", "2"); return true;
    case ".wav":  args.push("-c:a", "pcm_s16le"); return true;
    case ".aac":  args.push("-c:a", "aac", "-b:a", "192k"); return true;
    case ".flac": args.push("-c:a", "flac"); return true;
    default:      return false;
  }
}
