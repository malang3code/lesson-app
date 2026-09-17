'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface RecruitmentSetting {
  is_open: boolean;
  current_term: string;
  notice?: string;
}

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 모집 상태 및 초기 전체 로딩 상태
  const [recruitment, setRecruitment] = useState<RecruitmentSetting | null>(null);
  const [isPageReady, setIsPageReady] = useState(false);

  useEffect(() => {
    async function initPage() {
      try {
        const res = await fetch('/api/recruitment');
        if (res.ok) {
          const data = await res.json();
          setRecruitment(data);
        }
      } catch {
        // 에러 시에도 기본 화면 노출
      } finally {
        // 모집 상태 조회까지 완전히 끝난 후 한 번에 화면 표시
        setIsPageReady(true);
      }
    }
    initPage();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '비밀번호가 올바르지 않습니다.');
        setLoading(false);
        return;
      }

      localStorage.setItem('role', data.role);
      window.location.href = data.redirectTo || (data.role === 'admin' ? '/admin/assign' : '/viewer/assign');
    } catch {
      setError('네트워크 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  // 모집 상태 확인이 끝날 때까지 빈 화면이나 스켈레톤 상태를 유지
  if (!isPageReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF7]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C98A2B]/20 border-t-[#C98A2B]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF7] px-4 text-[#1C2B33]">
      <div className="w-full max-w-sm rounded-3xl border border-[#C98A2B]/20 bg-white p-8 shadow-[0_12px_40px_rgba(201,138,43,0.08)] animate-in fade-in duration-200">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C98A2B]/10 text-[#C98A2B] ring-1 ring-[#C98A2B]/30">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[#1C2B33]">
            SBL 콕카인 레슨
          </h1>
          <p className="mt-1 text-xs font-medium text-[#1C2B33]/50">비밀번호를 입력하여 접속하세요</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border-2 border-[#C98A2B]/30 bg-[#FAFAF7]/50 px-4 py-3.5 text-center text-base font-semibold tracking-widest text-[#1C2B33] placeholder:tracking-normal placeholder:text-[#1C2B33]/30 transition-all focus:border-[#C98A2B] focus:bg-white focus:ring-4 focus:ring-[#C98A2B]/15 focus:outline-none"
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-xl bg-[#B5482F]/10 py-2 text-center text-xs font-medium text-[#B5482F] animate-in fade-in duration-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-2xl bg-[#1C2B33] py-3.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(28,43,51,0.2)] transition-all hover:bg-[#253943] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? '확인 중...' : '접속하기'}
          </button>
        </form>

        {/* 🌟 모집 여부까지 확인된 완성형 UI가 처음부터 한 번에 노출 */}
        {recruitment?.is_open && (
          <div className="mt-6 border-t border-[#C98A2B]/15 pt-6 text-center">
            <p className="text-xs text-[#1C2B33]/60 mb-2 font-medium">
              현재 <strong className="text-[#C98A2B] font-semibold">{recruitment.current_term} 기수</strong> 수강생을 모집하고 있습니다.
            </p>
            <Link
              href="/apply"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-[#C98A2B]/40 bg-[#C98A2B]/10 py-3 text-xs font-bold text-[#9C6615] transition-all hover:bg-[#C98A2B] hover:text-white active:scale-[0.98]"
            >
              <span>레슨 신청하러 가기</span>
              <span>→</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}