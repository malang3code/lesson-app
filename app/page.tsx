'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      
      // 권한별 화면으로 즉시 이동
      window.location.href = data.redirectTo || (data.role === 'admin' ? '/admin/assign' : '/viewer/assign');
    } catch {
      setError('네트워크 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF7] px-4 text-[#1C2B33]">
      <div className="w-full max-w-sm rounded-3xl border border-[#C98A2B]/20 bg-white p-8 shadow-[0_12px_40px_rgba(201,138,43,0.08)]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C98A2B]/10 text-[#C98A2B] ring-1 ring-[#C98A2B]/30">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[#1C2B33]">
            레슨 관리 시스템
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
      </div>
    </div>
  );
}