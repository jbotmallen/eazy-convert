/**
 * Centralised registry for in-flight cancellable operations, keyed by IPC
 * sender id. Replaces the previous pattern where every handler module
 * registered its own `ipcMain.on("cancel-convert", ...)` listener — that
 * worked but accumulated N listeners on the same channel and made the
 * cancellation flow opaque (each handler silently no-ops if it does not own
 * an active op for the sender).
 *
 * Usage:
 *   const dispose = registerCancellable(senderId, () => proc.kill());
 *   try { ... } finally { dispose(); }
 *
 * `cancelForSender(senderId)` runs every registered canceller for that sender
 * and clears them. Safe to call when nothing is registered.
 */

type Canceller = () => void;

const senderToCancellers = new Map<number, Set<Canceller>>();

export function registerCancellable(senderId: number, cancel: Canceller): () => void {
  let set = senderToCancellers.get(senderId);
  if (!set) {
    set = new Set();
    senderToCancellers.set(senderId, set);
  }
  set.add(cancel);
  return () => {
    const current = senderToCancellers.get(senderId);
    if (!current) return;
    current.delete(cancel);
    if (current.size === 0) senderToCancellers.delete(senderId);
  };
}

export function cancelForSender(senderId: number): void {
  const set = senderToCancellers.get(senderId);
  if (!set) return;
  // Snapshot first because each canceller's downstream cleanup may itself
  // call the disposer returned from registerCancellable, mutating the set.
  const snapshot = [...set];
  senderToCancellers.delete(senderId);
  for (const cancel of snapshot) {
    try {
      cancel();
    } catch {
      // Best-effort cancellation; swallow per-canceller failures so one
      // misbehaving handler cannot block the others.
    }
  }
}

export function cancelAll(): void {
  const allSenders = [...senderToCancellers.keys()];
  for (const senderId of allSenders) cancelForSender(senderId);
}
