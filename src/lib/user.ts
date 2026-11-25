const USER_ID_STORAGE_KEY = "jukedesk_user_id";
const NICKNAME_STORAGE_KEY = "jukedesk_nickname";
const MY_TRACK_IDS_STORAGE_KEY = "jukedesk_my_track_ids";
const MAX_STORED_MY_TRACK_IDS = 100;

export function getOrCreateUserId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  window.localStorage.setItem(USER_ID_STORAGE_KEY, generated);
  return generated;
}

export function getStoredNickname(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "";
}

export function saveStoredNickname(nickname: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(NICKNAME_STORAGE_KEY, nickname.trim());
}

export function getStoredMyTrackIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(MY_TRACK_IDS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function addStoredMyTrackId(trackId: string): string[] {
  if (typeof window === "undefined" || !trackId) {
    return [];
  }

  const next = [
    trackId,
    ...getStoredMyTrackIds().filter((id) => id !== trackId),
  ].slice(0, MAX_STORED_MY_TRACK_IDS);

  window.localStorage.setItem(MY_TRACK_IDS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeStoredMyTrackId(trackId: string): string[] {
  if (typeof window === "undefined" || !trackId) {
    return [];
  }

  const next = getStoredMyTrackIds().filter((id) => id !== trackId);
  window.localStorage.setItem(MY_TRACK_IDS_STORAGE_KEY, JSON.stringify(next));
  return next;
}
