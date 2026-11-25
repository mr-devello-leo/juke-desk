"use client";

import { AlertTriangle, Database } from "lucide-react";

export function SetupGuideBanner() {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-amber-200">
            Supabase 연결 설정이 필요합니다
          </p>
          <p className="text-amber-100/80">
            실시간 대기열과 투표 기능을 사용하려면 아래 2단계를 완료한 뒤 개발
            서버를 재시작해 주세요.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-amber-100/90">
            <li>
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">
                .env.local.example
              </code>
              을 복사해{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">
                .env.local
              </code>
              을 만들고 Supabase URL과 Anon Key를 입력합니다.
            </li>
            <li className="flex items-center gap-1.5">
              <Database className="inline h-3.5 w-3.5 text-amber-300" />
              Supabase SQL Editor에서{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">
                supabase/schema.sql
              </code>{" "}
              파일을 실행합니다.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
