"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Link from "next/link";
import YouTube, {
  type YouTubeEvent,
  type YouTubePlayer,
  type YouTubeProps,
} from "react-youtube";
import {
  ArrowLeft,
  Disc3,
  Loader2,
  Music2,
  Play,
  Settings2,
  SkipForward,
  Smartphone,
  Sparkles,
  Volume2,
} from "lucide-react";
import { SetupGuideBanner } from "@/components/SetupGuideBanner";
import { useJukebox } from "@/hooks/useJukebox";
import {
  getAutoRecommendedPresetId,
  getNextFallbackPresetId,
  getStoredDefaultBgmConfig,
  INITIAL_DEFAULT_BGM_CONFIG,
  PRESET_ORDER,
  RECOMMENDED_PRESETS,
  resolveDefaultTrack,
  saveStoredDefaultBgmConfig,
  type DefaultBgmConfig,
  type DefaultPresetId,
  type DefaultTrack,
} from "@/lib/defaultTrack";
import { extractYoutubeVideoId } from "@/lib/youtube";
import type { YoutubeMetadata } from "@/types/jukebox";

const emptySubscribe = () => () => {};

function useStoredDefaultBgmConfig() {
  const raw = useSyncExternalStore(
    emptySubscribe,
    () => JSON.stringify(getStoredDefaultBgmConfig()),
    () => JSON.stringify(INITIAL_DEFAULT_BGM_CONFIG)
  );
  return JSON.parse(raw) as DefaultBgmConfig;
}

function useAutoRecommendedPresetId(): Exclude<
  DefaultPresetId,
  "auto" | "custom"
> {
  return useSyncExternalStore(
    emptySubscribe,
    () => getAutoRecommendedPresetId(new Date()),
    () => "jazz"
  );
}

export function HostPlayer() {
  const {
    nowPlaying,
    queue,
    skipThreshold,
    isConfigured,
    advanceToNextTrack,
  } = useJukebox("host-player");

  const storedConfig = useStoredDefaultBgmConfig();
  const autoPresetId = useAutoRecommendedPresetId();
  const [configOverride, setConfigOverride] = useState<DefaultBgmConfig | null>(
    null
  );
  const [isDefaultBgmEnabled, setIsDefaultBgmEnabled] = useState(true);
  const [isEditingDefault, setIsEditingDefault] = useState(false);
  const [defaultUrlInput, setDefaultUrlInput] = useState("");
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const [defaultFormError, setDefaultFormError] = useState<string | null>(null);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [playerNotice, setPlayerNotice] = useState<string | null>(null);

  const playerRef = useRef<YouTubePlayer | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const errorSkipTimerRef = useRef<number | null>(null);

  const bgmConfig = configOverride ?? storedConfig;
  const defaultTrack = resolveDefaultTrack(bgmConfig, autoPresetId);
  const isPlayingDefault = !nowPlaying && isDefaultBgmEnabled;

  const updateBgmConfig = (next: DefaultBgmConfig) => {
    saveStoredDefaultBgmConfig(next);
    setConfigOverride(next);
    setPlayerNotice(null);
  };

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    try {
      const sentinel = await navigator.wakeLock.request("screen");
      wakeLockRef.current = sentinel;
      setWakeLockActive(true);
      sentinel.addEventListener("release", () => {
        setWakeLockActive(false);
      });
    } catch {
      setWakeLockActive(false);
    }
  }, []);

  useEffect(() => {
    if (!isUnlocked) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      if (errorSkipTimerRef.current) {
        window.clearTimeout(errorSkipTimerRef.current);
      }
    };
  }, [isUnlocked, requestWakeLock]);

  const handleUnlockAndStart = () => {
    setIsUnlocked(true);
    void requestWakeLock();
  };

  const handlePlayerReady: YouTubeProps["onReady"] = (event: YouTubeEvent) => {
    playerRef.current = event.target;
    if (isUnlocked) {
      event.target.playVideo();
    }
  };

  const handleTrackEnd: YouTubeProps["onEnd"] = (event: YouTubeEvent) => {
    setPlayerNotice(null);

    if (nowPlaying) {
      void advanceToNextTrack(nowPlaying.id, "played");
      return;
    }

    // 추천 BGM이 일반 영상(라이브가 아닌 경우)이라면 끝나면 처음부터 반복 재생
    if (isDefaultBgmEnabled) {
      event.target.seekTo(0, true);
      event.target.playVideo();
    }
  };

  const handlePlayerError: YouTubeProps["onError"] = (
    event: YouTubeEvent<number>
  ) => {
    const code = event.data;

    if (errorSkipTimerRef.current) {
      window.clearTimeout(errorSkipTimerRef.current);
    }

    if (!nowPlaying) {
      const fallbackPresetId = getNextFallbackPresetId(defaultTrack.presetId);
      const fallbackTrack = RECOMMENDED_PRESETS[fallbackPresetId];
      setPlayerNotice(
        `기본 BGM을 재생할 수 없어 (Error ${code}) 2초 뒤 '${fallbackTrack.label}' 테마로 자동 전환합니다.`
      );
      errorSkipTimerRef.current = window.setTimeout(() => {
        updateBgmConfig({
          ...bgmConfig,
          mode: fallbackPresetId,
        });
      }, 2000);
      return;
    }

    setPlayerNotice(
      `재생할 수 없는 영상입니다 (YouTube Error ${code}). 2초 뒤 다음 곡으로 자동 스킵합니다.`
    );

    const failedTrackId = nowPlaying.id;
    errorSkipTimerRef.current = window.setTimeout(() => {
      setPlayerNotice(null);
      void advanceToNextTrack(failedTrackId, "skipped");
    }, 2000);
  };

  const handleSelectMode = (mode: DefaultPresetId) => {
    updateBgmConfig({
      ...bgmConfig,
      mode,
    });
  };

  const handleSaveCustomTrack = async (event: FormEvent) => {
    event.preventDefault();
    setDefaultFormError(null);

    const videoId = extractYoutubeVideoId(defaultUrlInput);
    if (!videoId) {
      setDefaultFormError("올바른 유튜브 링크 또는 영상 ID를 입력해 주세요.");
      return;
    }

    setIsSavingDefault(true);
    try {
      const response = await fetch(
        `/api/youtube/oembed?videoId=${encodeURIComponent(videoId)}`
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? "유튜브 영상 정보를 가져오지 못했습니다."
        );
      }

      const metadata = (await response.json()) as YoutubeMetadata;
      const customTrack: DefaultTrack = {
        presetId: "custom",
        label: "직접 설정",
        videoId: metadata.videoId,
        title: metadata.title,
        authorName: metadata.authorName,
      };

      updateBgmConfig({
        mode: "custom",
        customTrack,
      });
      setDefaultUrlInput("");
      setIsEditingDefault(false);
    } catch (err) {
      setDefaultFormError(
        err instanceof Error ? err.message : "기본 BGM 저장에 실패했습니다."
      );
    } finally {
      setIsSavingDefault(false);
    }
  };

  const youtubeOpts: YouTubeProps["opts"] = {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 1,
      controls: 1,
      rel: 0,
      modestbranding: 1,
    },
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8">
      {/* Top Bar */}
      <header className="flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
              <Volume2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-white sm:text-lg">
                JukeDesk Host Player
              </h1>
              <p className="truncate text-xs text-zinc-400">
                블루투스 스피커 연결 기기 전용 재생 화면
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-zinc-200 transition hover:bg-zinc-800 sm:hidden"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            리모컨
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDefaultBgmEnabled((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${
              isDefaultBgmEnabled
                ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30 hover:bg-indigo-500/25"
                : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-800"
            }`}
          >
            <Music2 className="h-3.5 w-3.5 shrink-0" />
            추천 BGM {isDefaultBgmEnabled ? "ON" : "OFF"}
          </button>

          <span
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              wakeLockActive
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5 shrink-0" />
            {wakeLockActive ? "화면 꺼짐 방지 ON" : "화면 꺼짐 방지 대기"}
          </span>

          <Link
            href="/"
            className="hidden items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-zinc-200 transition hover:bg-zinc-800 sm:inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            리모컨으로
          </Link>
        </div>
      </header>

      {!isConfigured && <SetupGuideBanner />}

      {/* Player Stage */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
        {!isUnlocked ? (
          <div className="flex min-h-[270px] flex-col items-center justify-center gap-4 px-5 py-8 text-center sm:aspect-video sm:min-h-0 sm:p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40 sm:h-16 sm:w-16">
              <Play className="ml-1 h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold break-keep text-white sm:text-xl">
                주크박스 재생을 시작할까요?
              </h2>
              <p className="mx-auto max-w-md text-xs leading-relaxed break-keep text-zinc-400">
                자동재생과 화면 꺼짐 방지를 켜기 위해 처음 한 번만 눌러주세요.
                대기열이 비어 있으면 추천 BGM({defaultTrack.label})이 바로
                재생됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleUnlockAndStart}
              className="mt-1 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-semibold whitespace-nowrap text-white transition hover:bg-indigo-500"
            >
              <Play className="h-4 w-4" />
              주크박스 시작하기
            </button>
          </div>
        ) : nowPlaying ? (
          <div className="aspect-video w-full bg-black">
            <YouTube
              key={nowPlaying.id}
              videoId={nowPlaying.video_id}
              opts={youtubeOpts}
              onReady={handlePlayerReady}
              onEnd={handleTrackEnd}
              onError={handlePlayerError}
              className="h-full w-full"
              iframeClassName="h-full w-full"
            />
          </div>
        ) : isDefaultBgmEnabled ? (
          <div className="aspect-video w-full bg-black">
            <YouTube
              key={`default-${defaultTrack.videoId}`}
              videoId={defaultTrack.videoId}
              opts={youtubeOpts}
              onReady={handlePlayerReady}
              onEnd={handleTrackEnd}
              onError={handlePlayerError}
              className="h-full w-full"
              iframeClassName="h-full w-full"
            />
          </div>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-5 py-8 text-center sm:aspect-video sm:min-h-0 sm:p-6">
            <Disc3 className="h-11 w-11 text-zinc-700 sm:h-12 sm:w-12" />
            <p className="text-sm font-medium break-keep text-zinc-300 sm:text-base">
              대기열이 비어 있습니다 (추천 BGM OFF)
            </p>
            <p className="max-w-xs text-xs leading-relaxed break-keep text-zinc-500">
              직원들이 리모컨에서 유튜브 링크를 신청하면 자동으로 재생이
              시작됩니다.
            </p>
          </div>
        )}
      </section>

      {playerNotice && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed break-keep text-amber-200 sm:text-sm">
          {playerNotice}
        </div>
      )}

      {/* Now Playing Info + Host Controls */}
      <section className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {nowPlaying ? "Now Playing" : "Default BGM"}
              </p>
              {isPlayingDefault && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-indigo-300">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  {bgmConfig.mode === "auto"
                    ? `자동 추천 · ${defaultTrack.label}`
                    : defaultTrack.label}
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-sm font-bold leading-snug text-white sm:truncate sm:text-base">
              {nowPlaying
                ? nowPlaying.title
                : isDefaultBgmEnabled
                  ? defaultTrack.title
                  : "재생 대기 중"}
            </p>
            {nowPlaying ? (
              <p className="text-xs leading-relaxed text-zinc-400">
                신청자: {nowPlaying.requested_by} · 좋아요{" "}
                {nowPlaying.likeCount} · 스킵 {nowPlaying.skipCount}/
                {skipThreshold}
              </p>
            ) : isDefaultBgmEnabled ? (
              <p className="text-xs leading-relaxed break-keep text-zinc-400">
                {defaultTrack.authorName ? `${defaultTrack.authorName} · ` : ""}
                신청곡이 들어오면 즉시 해당 곡으로 전환됩니다
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
            <button
              type="button"
              onClick={() => setIsEditingDefault((prev) => !prev)}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-zinc-200 transition hover:bg-zinc-800 sm:px-3.5"
            >
              <Settings2 className="h-4 w-4 shrink-0" />
              직접 링크 지정
            </button>

            <button
              type="button"
              disabled={!nowPlaying}
              onClick={() =>
                nowPlaying && void advanceToNextTrack(nowPlaying.id, "skipped")
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-zinc-800 px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
            >
              <SkipForward className="h-4 w-4 shrink-0" />
              강제 스킵
            </button>
          </div>
        </div>

        {/* Quick Theme Presets */}
        <div className="space-y-2 border-t border-zinc-800/80 pt-3.5">
          <p className="text-xs font-medium text-zinc-400">추천 테마</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectMode("auto")}
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                bgmConfig.mode === "auto"
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <Sparkles className="h-3 w-3 shrink-0" />
              자동 추천
            </button>

            {PRESET_ORDER.map((presetId) => {
              const preset = RECOMMENDED_PRESETS[presetId];
              const isSelected = bgmConfig.mode === presetId;
              return (
                <button
                  key={presetId}
                  type="button"
                  onClick={() => handleSelectMode(presetId)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}

            {bgmConfig.customTrack && (
              <button
                type="button"
                onClick={() => handleSelectMode("custom")}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                  bgmConfig.mode === "custom"
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                직접 설정
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Custom Default BGM Input */}
      {isEditingDefault && (
        <section className="rounded-3xl border border-indigo-500/30 bg-indigo-500/5 p-4 sm:p-5">
          <div className="mb-3 space-y-1">
            <h2 className="text-sm font-semibold text-white">
              커스텀 기본 BGM 링크 지정
            </h2>
            <p className="text-xs leading-relaxed break-keep text-zinc-400">
              추천 테마 대신 원하는 유튜브 라이브나 플레이리스트를 기본 곡으로
              고정할 수 있습니다.
            </p>
          </div>

          <form
            onSubmit={handleSaveCustomTrack}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="text"
              value={defaultUrlInput}
              onChange={(event) => setDefaultUrlInput(event.target.value)}
              placeholder="대기열이 비었을 때 재생할 유튜브 링크 입력"
              disabled={isSavingDefault}
              className="min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isSavingDefault}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {isSavingDefault && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              저장
            </button>
          </form>

          {defaultFormError && (
            <p className="mt-2 text-xs text-red-400">{defaultFormError}</p>
          )}
        </section>
      )}

      {/* Queue Preview */}
      <section className="space-y-2.5 pb-4">
        <h2 className="text-sm font-semibold text-zinc-300">
          다음 대기 곡 ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-800 px-4 py-6 text-center text-xs leading-relaxed break-keep text-zinc-500">
            예정된 다음 곡이 없습니다. 현재 곡이 끝나면 추천 BGM(
            {defaultTrack.label})이 재생됩니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.slice(0, 5).map((track, index) => (
              <li
                key={track.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 text-xs font-semibold text-zinc-500">
                    {index + 1}
                  </span>
                  <span className="truncate font-medium text-zinc-200">
                    {track.title}
                  </span>
                </div>
                <span className="shrink-0 text-xs whitespace-nowrap text-zinc-500">
                  {track.requested_by}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
