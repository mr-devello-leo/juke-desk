export type TrackStatus = "queued" | "playing" | "played" | "skipped";

export type VoteType = "like" | "skip";

export interface Track {
  id: string;
  video_id: string;
  title: string;
  author_name: string;
  thumbnail_url: string;
  requested_by: string;
  status: TrackStatus;
  created_at: string;
  started_at: string | null;
}

export interface Vote {
  id: string;
  track_id: string;
  user_id: string;
  type: VoteType;
  created_at: string;
}

export interface TrackWithVotes extends Track {
  likeCount: number;
  skipCount: number;
  likedByMe: boolean;
  skippedByMe: boolean;
}

export interface YoutubeMetadata {
  videoId: string;
  title: string;
  authorName: string;
  thumbnailUrl: string;
}
