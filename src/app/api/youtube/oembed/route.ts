import { NextRequest, NextResponse } from "next/server";
import {
  extractYoutubeVideoId,
  getYoutubeThumbnailUrl,
} from "@/lib/youtube";
import type { YoutubeMetadata } from "@/types/jukebox";

interface OEmbedResponse {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

export async function GET(request: NextRequest) {
  const rawVideoId = request.nextUrl.searchParams.get("videoId") ?? "";
  const videoId = extractYoutubeVideoId(rawVideoId);

  if (!videoId) {
    return NextResponse.json(
      { error: "유효하지 않은 유튜브 영상 ID입니다." },
      { status: 400 }
    );
  }

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    watchUrl
  )}&format=json`;

  try {
    const response = await fetch(oembedUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            "영상을 찾을 수 없거나 외부 재생(퍼가기)이 제한된 유튜브 영상입니다.",
        },
        { status: 404 }
      );
    }

    const data = (await response.json()) as OEmbedResponse;
    const metadata: YoutubeMetadata = {
      videoId,
      title: data.title?.trim() || `YouTube (${videoId})`,
      authorName: data.author_name?.trim() || "",
      thumbnailUrl: data.thumbnail_url || getYoutubeThumbnailUrl(videoId),
    };

    return NextResponse.json(metadata);
  } catch {
    return NextResponse.json(
      { error: "유튜브 메타데이터 조회 중 오류가 발생했습니다." },
      { status: 502 }
    );
  }
}
