const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * 다양한 형태의 유튜브 URL 또는 11자리 영상 ID에서 videoId를 추출합니다.
 * 지원 형식:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://music.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - VIDEO_ID (11자리)
 */
export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (VIDEO_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  try {
    const normalized = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && VIDEO_ID_REGEX.test(id) ? id : null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      const vParam = url.searchParams.get("v");
      if (vParam && VIDEO_ID_REGEX.test(vParam)) {
        return vParam;
      }

      const segments = url.pathname.split("/").filter(Boolean);
      const prefix = segments[0];
      const candidate = segments[1];
      if (
        (prefix === "shorts" || prefix === "embed" || prefix === "live") &&
        candidate &&
        VIDEO_ID_REGEX.test(candidate)
      ) {
        return candidate;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function getYoutubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
