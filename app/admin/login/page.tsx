'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/admin/settings/applications');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || '로그인에 실패했습니다.');
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF7] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#1C2B33]/10 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-center text-lg font-bold text-[#1C2B33]">
          관리자 로그인
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#1C2B33]/70">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="관리자 비밀번호를 입력하세요"
              className="h-10 w-full rounded-xl border border-[#1C2B33]/15 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1F6F63]"
              required
            />
          </div>

          {error && <p className="text-xs text-[#B5482F]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-xl bg-[#1F6F63] text-xs font-bold text-white transition-all hover:bg-[#1F6F63]/90 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}