"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  Crown,
  Disc3,
  FastForward,
  Heart,
  ListMusic,
  Loader2,
  Play,
  Plus,
  Radio,
  SkipForward,
  Trash2,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import { SetupGuideBanner } from "@/components/SetupGuideBanner";
import { useJukebox } from "@/hooks/useJukebox";
import {
  getOrCreateUserId,
  getStoredNickname,
  saveStoredNickname,
} from "@/lib/user";

const emptySubscribe = () => () => {};

function useClientIdentity() {
  const userId = useSyncExternalStore(
    emptySubscribe,
    () => getOrCreateUserId(),
    () => ""
  );

  const initialNickname = useSyncExternalStore(
    emptySubscribe,
    () => getStoredNickname(),
    () => ""
  );

  return { userId, initialNickname };
}

interface ClientRemoteProps {
  isMaster?: boolean;
}

export function ClientRemote({ isMaster = false }: ClientRemoteProps) {
  const { userId, initialNickname } = useClientIdentity();
  const [nicknameOverride, setNicknameOverride] = useState<string | null>(null);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");

  const [urlInput, setUrlInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [confirmClearQueue, setConfirmClearQueue] = useState(false);

  const nickname = nicknameOverride ?? initialNickname;

  const {
    nowPlaying,
    queue,
    history,
    volume,
    isMuted,
    isLoading,
    error,
    skipThreshold,
    isConfigured,
    addTrack,
    toggleVote,
    advanceToNextTrack,
    playTrackNow,
    reorderQueue,
    clearQueue,
    removeTrack,
    updateVolume,
    toggleMute,
  } = useJukebox(userId);

  const handleSaveNickname = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = nicknameDraft.trim();
    if (!trimmed) return;
    saveStoredNickname(trimmed);
    setNicknameOverride(trimmed);
    setIsEditingNickname(false);
  };

  const handleOpenNicknameEdit = () => {
    setNicknameDraft(nickname);
    setIsEditingNickname(true);
  };

  const handleAddTrack = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!urlInput.trim()) {
      setFormError("유튜브 링크를 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addTrack(urlInput, nickname || "익명");
      setUrlInput("");
      setFormSuccess("대기열에 곡이 추가되었습니다.");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "곡 추가에 실패했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const runMasterAction = async (
    actionKey: string,
    action: () => Promise<void>
  ) => {
    if (pendingActionId) return;
    setPendingActionId(actionKey);
    try {
      await action();
    } finally {
      setPendingActionId(null);
    }
  };

  const handleMoveTrack = (
    index: number,
    direction: "top" | "up" | "down"
  ) => {
    const ids = queue.map((track) => track.id);
    if (index < 0 || index >= ids.length) return;

    let targetIndex = index;
    if (direction === "top") {
      targetIndex = 0;
    } else if (direction === "up") {
      targetIndex = Math.max(0, index - 1);
    } else if (direction === "down") {
      targetIndex = Math.min(ids.length - 1, index + 1);
    }

    if (targetIndex === index) return;

    const [movedId] = ids.splice(index, 1);
    ids.splice(targetIndex, 0, movedId);

    void runMasterAction(`move-${movedId}`, () => reorderQueue(ids));
  };

  const handleClearQueue = () => {
    if (!confirmClearQueue) {
      setConfirmClearQueue(true);
      return;
    }
    setConfirmClearQueue(false);
    void runMasterAction("clear-queue", () => clearQueue());
  };

  const skipProgress = nowPlaying
    ? Math.min(100, Math.round((nowPlaying.skipCount / skipThreshold) * 100))
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${
              isMaster
                ? "bg-amber-500/20 text-amber-300 ring-amber-500/40"
                : "bg-indigo-500/20 text-indigo-400 ring-indigo-500/30"
            }`}
          >
            {isMaster ? (
              <Crown className="h-6 w-6" />
            ) : (
              <Disc3 className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                JukeDesk
              </h1>
              {isMaster && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 ring-1 ring-amber-500/40">
                  Master
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {isMaster
                ? "마스터 리모컨 · 즉시 스킵 및 대기열 순서 제어"
                : "사무실 공용 BGM 주크박스 리모컨"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenNicknameEdit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800"
          >
            <User className="h-3.5 w-3.5 text-indigo-400" />
            {nickname ? nickname : "닉네임 설정"}
          </button>

          <Link
            href="/player"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            <Radio className="h-3.5 w-3.5" />
            호스트 플레이어
          </Link>
        </div>
      </header>

      {/* Nickname Editor */}
      {isEditingNickname && (
        <form
          onSubmit={handleSaveNickname}
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4"
        >
          <input
            type="text"
            value={nicknameDraft}
            onChange={(event) => setNicknameDraft(event.target.value)}
            placeholder="사내에서 사용할 이름 또는 닉네임 (예: 민수)"
            maxLength={20}
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => setIsEditingNickname(false)}
            className="rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            취소
          </button>
        </form>
      )}

      {!isConfigured && <SetupGuideBanner />}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Now Playing */}
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Now Playing
          </span>
          <span className="text-xs text-zinc-500">
            스킵 기준: {skipThreshold}표
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-zinc-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            불러오는 중...
          </div>
        ) : nowPlaying ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl bg-zinc-950 sm:w-48">
                <Image
                  src={nowPlaying.thumbnail_url}
                  alt={nowPlaying.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 192px"
                  className="object-cover"
                />
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <h2 className="line-clamp-2 text-lg font-bold text-white">
                  {nowPlaying.title}
                </h2>
                {nowPlaying.author_name && (
                  <p className="truncate text-sm text-zinc-400">
                    {nowPlaying.author_name}
                  </p>
                )}
                <p className="text-xs text-zinc-500">
                  신청자:{" "}
                  <span className="font-medium text-zinc-300">
                    {nowPlaying.requested_by}
                  </span>
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={!isConfigured}
                    onClick={() => void toggleVote(nowPlaying.id, "like")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                      nowPlaying.likedByMe
                        ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40"
                        : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    }`}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        nowPlaying.likedByMe ? "fill-rose-400 text-rose-400" : ""
                      }`}
                    />
                    좋아요 {nowPlaying.likeCount}
                  </button>

                  <button
                    type="button"
                    disabled={!isConfigured}
                    onClick={() => void toggleVote(nowPlaying.id, "skip")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                      nowPlaying.skippedByMe
                        ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                        : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    }`}
                  >
                    <SkipForward className="h-4 w-4" />
                    스킵 투표 ({nowPlaying.skipCount}/{skipThreshold})
                  </button>

                  {isMaster && (
                    <button
                      type="button"
                      disabled={!isConfigured || pendingActionId !== null}
                      onClick={() =>
                        void runMasterAction("force-skip", () =>
                          advanceToNextTrack(nowPlaying.id, "skipped")
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pendingActionId === "force-skip" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FastForward className="h-4 w-4" />
                      )}
                      {queue.length > 0 ? "다음 곡 바로 재생" : "즉시 스킵"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {nowPlaying.skipCount > 0 && (
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${skipProgress}%` }}
                  />
                </div>
                <p className="text-right text-[11px] text-amber-300/80">
                  {skipThreshold - nowPlaying.skipCount}표 더 모이면 다음 곡으로
                  넘어갑니다
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-zinc-200">
              현재 시즌·시간대 추천 BGM이 재생 중입니다.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              아래에서 유튜브 링크를 신청하면 추천 BGM에서 신청곡으로 바로
              전환됩니다!
            </p>
          </div>
        )}
      </section>

      {/* Remote Volume Control */}
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!isConfigured}
            onClick={() => void toggleMute()}
            aria-label={isMuted ? "음소거 해제" : "음소거"}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
              isMuted || volume === 0
                ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            }`}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300">사무실 볼륨</span>
              <span className="tabular-nums text-zinc-400">
                {isMuted ? "음소거" : `${volume}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={isMuted ? 0 : volume}
              disabled={!isConfigured}
              onChange={(event) =>
                void updateVolume(Number.parseInt(event.target.value, 10))
              }
              aria-label="사무실 스피커 볼륨"
              className="h-1.5 w-full cursor-pointer accent-indigo-500 disabled:opacity-50"
            />
          </div>
        </div>
      </section>

      {/* Add Track Form */}
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5">
        <form onSubmit={handleAddTrack} className="space-y-3">
          <label
            htmlFor="youtube-url-input"
            className="block text-sm font-semibold text-zinc-200"
          >
            노래 신청하기 (YouTube 링크)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="youtube-url-input"
              type="text"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=... 또는 youtu.be/..."
              disabled={!isConfigured || isSubmitting}
              className="min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!isConfigured || isSubmitting}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              신청
            </button>
          </div>

          {formError && <p className="text-xs text-red-400">{formError}</p>}
          {formSuccess && (
            <p className="text-xs text-emerald-400">{formSuccess}</p>
          )}
        </form>
      </section>

      {/* Up Next Queue */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <ListMusic className="h-4 w-4 text-indigo-400" />
            대기열 ({queue.length})
          </h2>

          {isMaster && queue.length > 0 && (
            <div className="flex items-center gap-2">
              {confirmClearQueue && (
                <button
                  type="button"
                  onClick={() => setConfirmClearQueue(false)}
                  className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
                >
                  취소
                </button>
              )}
              <button
                type="button"
                disabled={pendingActionId !== null}
                onClick={handleClearQueue}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                  confirmClearQueue
                    ? "bg-red-500 text-white hover:bg-red-400"
                    : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-red-500/40 hover:text-red-300"
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmClearQueue ? "정말 모두 비우기" : "대기열 비우기"}
              </button>
            </div>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 py-8 text-center text-xs text-zinc-500">
            대기 중인 곡이 없습니다.
          </div>
        ) : (
          <ul className="space-y-2">
            {queue.map((track, index) => {
              const isFirst = index === 0;
              const isLast = index === queue.length - 1;
              const isBusy = pendingActionId !== null;

              return (
                <li
                  key={track.id}
                  className="flex flex-col gap-2.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="w-5 shrink-0 text-center text-xs font-semibold text-zinc-500">
                      {index + 1}
                    </span>

                    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-950">
                      <Image
                        src={track.thumbnail_url}
                        alt={track.title}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">
                        {track.title}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        신청: {track.requested_by}
                        {track.author_name ? ` · ${track.author_name}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1 border-t border-zinc-800/70 pt-2 sm:border-t-0 sm:pt-0">
                    {isMaster && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void runMasterAction(`play-${track.id}`, () =>
                              playTrackNow(track.id)
                            )
                          }
                          title="이 곡 바로 재생"
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2.5 py-1.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {pendingActionId === `play-${track.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Play className="h-3.5 w-3.5 fill-amber-300" />
                          )}
                          바로 재생
                        </button>

                        <button
                          type="button"
                          disabled={isFirst || isBusy}
                          onClick={() => handleMoveTrack(index, "top")}
                          title="맨 위로 올리기"
                          aria-label="맨 위로 올리기"
                          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ArrowUpToLine className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          disabled={isFirst || isBusy}
                          onClick={() => handleMoveTrack(index, "up")}
                          title="위로 이동"
                          aria-label="위로 이동"
                          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          disabled={isLast || isBusy}
                          onClick={() => handleMoveTrack(index, "down")}
                          title="아래로 이동"
                          aria-label="아래로 이동"
                          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => void toggleVote(track.id, "like")}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition ${
                        track.likedByMe
                          ? "bg-rose-500/20 text-rose-300"
                          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      }`}
                    >
                      <Heart
                        className={`h-3.5 w-3.5 ${
                          track.likedByMe ? "fill-rose-400 text-rose-400" : ""
                        }`}
                      />
                      {track.likeCount}
                    </button>

                    <button
                      type="button"
                      onClick={() => void removeTrack(track.id)}
                      title="대기열에서 삭제"
                      aria-label="대기열에서 삭제"
                      className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recently Played */}
      {history.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-sm font-semibold text-zinc-400">
            최근 재생 기록
          </h2>
          <ul className="space-y-1.5">
            {history.map((track) => (
              <li
                key={track.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-zinc-900/30 px-3 py-2 text-xs text-zinc-400"
              >
                <div className="min-w-0 flex-1 truncate">
                  <span className="text-zinc-300">{track.title}</span>
                  <span className="ml-2 text-zinc-500">
                    ({track.requested_by})
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    track.status === "skipped"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {track.status === "skipped" ? "스킵됨" : "재생 완료"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
