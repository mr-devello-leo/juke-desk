export type DefaultPresetId =
  | "auto"
  | "christmas"
  | "jazz"
  | "piano"
  | "synthwave"
  | "custom";

export interface DefaultTrack {
  videoId: string;
  title: string;
  authorName: string;
  presetId: Exclude<DefaultPresetId, "auto">;
  label: string;
}

export interface DefaultBgmConfig {
  mode: DefaultPresetId;
  customTrack: DefaultTrack | null;
}

const DEFAULT_CONFIG_STORAGE_KEY = "jukedesk_default_bgm_config";

export const RECOMMENDED_PRESETS: Record<
  Exclude<DefaultPresetId, "auto" | "custom">,
  DefaultTrack
> = {
  christmas: {
    presetId: "christmas",
    label: "크리스마스 재즈",
    videoId: "qB1pSpYzV-s",
    title: "Christmas Jazz Coffee Shop 24/7 - Cozy Christmas Ambience",
    authorName: "Little Red Coffee Shop",
  },
  jazz: {
    presetId: "jazz",
    label: "카페 재즈",
    videoId: "xlXkYlbD9D4",
    title: "Chill Jazz Piano Ballads - Cozy Winter Cafe Ambience",
    authorName: "Cafe Music BGM channel",
  },
  piano: {
    presetId: "piano",
    label: "집중 피아노",
    videoId: "3G3vzexbf64",
    title: "peaceful piano - 3 hours of relaxing music to read to",
    authorName: "Lofi Girl",
  },
  synthwave: {
    presetId: "synthwave",
    label: "신스웨이브",
    videoId: "4xDzrJKXOOY",
    title: "synthwave radio - beats to chill/game to",
    authorName: "Lofi Girl",
  },
};

export const PRESET_ORDER: Array<Exclude<DefaultPresetId, "auto" | "custom">> = [
  "christmas",
  "jazz",
  "piano",
  "synthwave",
];

export const INITIAL_DEFAULT_BGM_CONFIG: DefaultBgmConfig = {
  mode: "auto",
  customTrack: null,
};

/**
 * 현재 날짜(시즌)와 시간대에 맞춰 가장 어울리는 추천 테마를 고릅니다.
 * - 11월 15일 ~ 12월 26일: 크리스마스 재즈
 * - 오전 (06~12시): 카페 재즈
 * - 오후 (12~18시): 집중 피아노
 * - 저녁/야근 (18~06시): 신스웨이브
 */
export function getAutoRecommendedPresetId(
  now: Date = new Date()
): Exclude<DefaultPresetId, "auto" | "custom"> {
  const month = now.getMonth() + 1;
  const day = now.getDate();

  if ((month === 11 && day >= 15) || (month === 12 && day <= 26)) {
    return "christmas";
  }

  const hour = now.getHours();
  if (hour >= 6 && hour < 12) {
    return "jazz";
  }
  if (hour >= 12 && hour < 18) {
    return "piano";
  }
  return "synthwave";
}

export function resolveDefaultTrack(
  config: DefaultBgmConfig,
  autoPresetId: Exclude<DefaultPresetId, "auto" | "custom">
): DefaultTrack {
  if (config.mode === "custom" && config.customTrack) {
    return config.customTrack;
  }

  if (config.mode === "auto") {
    return RECOMMENDED_PRESETS[autoPresetId];
  }

  if (config.mode !== "custom") {
    return RECOMMENDED_PRESETS[config.mode];
  }

  return RECOMMENDED_PRESETS.jazz;
}

export function getNextFallbackPresetId(
  current: Exclude<DefaultPresetId, "auto">
): Exclude<DefaultPresetId, "auto" | "custom"> {
  if (current === "custom") {
    return "jazz";
  }
  const index = PRESET_ORDER.indexOf(current);
  const nextIndex = (index + 1) % PRESET_ORDER.length;
  return PRESET_ORDER[nextIndex];
}

export function getStoredDefaultBgmConfig(): DefaultBgmConfig {
  if (typeof window === "undefined") {
    return INITIAL_DEFAULT_BGM_CONFIG;
  }

  try {
    const raw = window.localStorage.getItem(DEFAULT_CONFIG_STORAGE_KEY);
    if (!raw) return INITIAL_DEFAULT_BGM_CONFIG;

    const parsed = JSON.parse(raw) as Partial<DefaultBgmConfig>;
    if (
      parsed.mode === "auto" ||
      parsed.mode === "christmas" ||
      parsed.mode === "jazz" ||
      parsed.mode === "piano" ||
      parsed.mode === "synthwave" ||
      parsed.mode === "custom"
    ) {
      return {
        mode: parsed.mode,
        customTrack: parsed.customTrack ?? null,
      };
    }
  } catch {
    return INITIAL_DEFAULT_BGM_CONFIG;
  }

  return INITIAL_DEFAULT_BGM_CONFIG;
}

export function saveStoredDefaultBgmConfig(config: DefaultBgmConfig): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    DEFAULT_CONFIG_STORAGE_KEY,
    JSON.stringify(config)
  );
}
