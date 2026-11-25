import { timingSafeEqual } from "crypto";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientRemote } from "@/components/ClientRemote";

export const metadata: Metadata = {
  title: "JukeDesk Master Remote",
  robots: {
    index: false,
    follow: false,
  },
};

const DEFAULT_MASTER_KEY = "juke-master-2026";

function isValidMasterKey(candidate: string): boolean {
  const expected = (
    process.env.MASTER_SECRET_KEY ?? DEFAULT_MASTER_KEY
  ).trim();
  if (!expected || !candidate) {
    return false;
  }

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

async function MasterGate({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const decodedKey = decodeURIComponent(key);

  if (!isValidMasterKey(decodedKey)) {
    notFound();
  }

  return <ClientRemote isMaster />;
}

export default function MasterRemotePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
            마스터 리모컨 권한을 확인하는 중...
          </div>
        }
      >
        <MasterGate params={params} />
      </Suspense>
    </main>
  );
}
