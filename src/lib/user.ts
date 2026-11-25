const USER_ID_STORAGE_KEY = "jukedesk_user_id";
const NICKNAME_STORAGE_KEY = "jukedesk_nickname";

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
