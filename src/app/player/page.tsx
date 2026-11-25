import type { Metadata } from "next";
import { HostPlayer } from "@/components/HostPlayer";

export const metadata: Metadata = {
  title: "Host Player | JukeDesk",
  description: "사무실 공용 스피커 연결 기기 전용 유튜브 BGM 플레이어",
};

export default function PlayerPage() {
  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <HostPlayer />
    </main>
  );
}
