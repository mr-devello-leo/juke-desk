"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  SKIP_THRESHOLD,
} from "@/lib/supabase";
import { extractYoutubeVideoId } from "@/lib/youtube";
import type {
  Track,
  TrackWithVotes,
  Vote,
  VoteType,
  YoutubeMetadata,
} from "@/types/jukebox";

interface UseJukeboxResult {
  nowPlaying: TrackWithVotes | null;
  queue: TrackWithVotes[];
  history: TrackWithVotes[];
  isLoading: boolean;
  error: string | null;
  skipThreshold: number;
  isConfigured: boolean;
  addTrack: (url: string, requestedBy: string) => Promise<void>;
  toggleVote: (trackId: string, type: VoteType) => Promise<void>;
  advanceToNextTrack: (
    currentTrackId: string | null,
    finishStatus?: "played" | "skipped"
  ) => Promise<void>;
  removeTrack: (trackId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useJukebox(userId: string): UseJukeboxResult {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const [tracksResult, votesResult] = await Promise.all([
      supabase
        .from("tracks")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100),
      supabase.from("votes").select("*"),
    ]);

    if (tracksResult.error) {
      setError(`곡 목록을 불러오지 못했습니다: ${tracksResult.error.message}`);
      setIsLoading(false);
      return;
    }

    if (votesResult.error) {
      setError(`투표 정보를 불러오지 못했습니다: ${votesResult.error.message}`);
      setIsLoading(false);
      return;
    }

    setTracks((tracksResult.data ?? []) as Track[]);
    setVotes((votesResult.data ?? []) as Vote[]);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const initialTimer = window.setTimeout(() => {
      void fetchAll();
    }, 0);

    const supabase = getSupabaseClient();
    if (!supabase) {
      window.clearTimeout(initialTimer);
      return;
    }

    const channel = supabase
      .channel("jukedesk-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tracks" },
        () => {
          void fetchAll();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        () => {
          void fetchAll();
        }
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialTimer);
      void supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const enrichedTracks = useMemo<TrackWithVotes[]>(() => {
    const votesByTrack = new Map<string, Vote[]>();
    for (const vote of votes) {
      const list = votesByTrack.get(vote.track_id) ?? [];
      list.push(vote);
      votesByTrack.set(vote.track_id, list);
    }

    return tracks.map((track) => {
      const trackVotes = votesByTrack.get(track.id) ?? [];
      let likeCount = 0;
      let skipCount = 0;
      let likedByMe = false;
      let skippedByMe = false;

      for (const vote of trackVotes) {
        if (vote.type === "like") {
          likeCount += 1;
          if (userId && vote.user_id === userId) likedByMe = true;
        } else if (vote.type === "skip") {
          skipCount += 1;
          if (userId && vote.user_id === userId) skippedByMe = true;
        }
      }

      return {
        ...track,
        likeCount,
        skipCount,
        likedByMe,
        skippedByMe,
      };
    });
  }, [tracks, votes, userId]);

  const nowPlaying = useMemo(
    () => enrichedTracks.find((track) => track.status === "playing") ?? null,
    [enrichedTracks]
  );

  const queue = useMemo(
    () => enrichedTracks.filter((track) => track.status === "queued"),
    [enrichedTracks]
  );

  const history = useMemo(
    () =>
      enrichedTracks
        .filter(
          (track) => track.status === "played" || track.status === "skipped"
        )
        .reverse()
        .slice(0, 15),
    [enrichedTracks]
  );

  const advanceToNextTrack = useCallback(
    async (
      currentTrackId: string | null,
      finishStatus: "played" | "skipped" = "played"
    ) => {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      if (currentTrackId) {
        await supabase
          .from("tracks")
          .update({ status: finishStatus })
          .eq("id", currentTrackId)
          .eq("status", "playing");
      }

      const { data: nextCandidates } = await supabase
        .from("tracks")
        .select("id")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(1);

      const nextTrack = nextCandidates?.[0];
      if (nextTrack) {
        await supabase
          .from("tracks")
          .update({
            status: "playing",
            started_at: new Date().toISOString(),
          })
          .eq("id", nextTrack.id)
          .eq("status", "queued");
      }

      await fetchAll();
    },
    [fetchAll]
  );

  const addTrack = useCallback(
    async (url: string, requestedBy: string) => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
      }

      const videoId = extractYoutubeVideoId(url);
      if (!videoId) {
        throw new Error("올바른 유튜브 링크 또는 영상 ID를 입력해 주세요.");
      }

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

      const { data: playingRows } = await supabase
        .from("tracks")
        .select("id")
        .eq("status", "playing")
        .limit(1);

      const hasPlayingTrack = (playingRows?.length ?? 0) > 0;

      const { error: insertError } = await supabase.from("tracks").insert({
        video_id: metadata.videoId,
        title: metadata.title,
        author_name: metadata.authorName,
        thumbnail_url: metadata.thumbnailUrl,
        requested_by: requestedBy.trim() || "익명",
        status: hasPlayingTrack ? "queued" : "playing",
        started_at: hasPlayingTrack ? null : new Date().toISOString(),
      });

      if (insertError) {
        throw new Error(`곡을 추가하지 못했습니다: ${insertError.message}`);
      }

      await fetchAll();
    },
    [fetchAll]
  );

  const toggleVote = useCallback(
    async (trackId: string, type: VoteType) => {
      const supabase = getSupabaseClient();
      if (!supabase || !userId) return;

      const existing = votes.find(
        (vote) =>
          vote.track_id === trackId &&
          vote.user_id === userId &&
          vote.type === type
      );

      if (existing) {
        await supabase.from("votes").delete().eq("id", existing.id);
        await fetchAll();
        return;
      }

      const { error: insertError } = await supabase.from("votes").insert({
        track_id: trackId,
        user_id: userId,
        type,
      });

      if (insertError) {
        console.error("Failed to insert vote:", insertError.message);
        return;
      }

      if (type === "skip") {
        const { count } = await supabase
          .from("votes")
          .select("*", { count: "exact", head: true })
          .eq("track_id", trackId)
          .eq("type", "skip");

        if ((count ?? 0) >= SKIP_THRESHOLD) {
          await advanceToNextTrack(trackId, "skipped");
          return;
        }
      }

      await fetchAll();
    },
    [votes, userId, fetchAll, advanceToNextTrack]
  );

  const removeTrack = useCallback(
    async (trackId: string) => {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      await supabase
        .from("tracks")
        .delete()
        .eq("id", trackId)
        .eq("status", "queued");

      await fetchAll();
    },
    [fetchAll]
  );

  return {
    nowPlaying,
    queue,
    history,
    isLoading,
    error,
    skipThreshold: SKIP_THRESHOLD,
    isConfigured: isSupabaseConfigured,
    addTrack,
    toggleVote,
    advanceToNextTrack,
    removeTrack,
    refresh: fetchAll,
  };
}
