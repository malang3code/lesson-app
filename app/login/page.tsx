'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        setError('서버 응답 오류가 발생했습니다.');
        setLoading(false);
        return;
      }

      if (res.ok) {
        if (data.role === 'admin') {
          router.push('/admin/assign');
        } else {
          router.push('/schedule');
        }
        router.refresh();
      } else {
        setError(data.error || `로그인 실패 (status: ${res.status})`);
      }
    } catch (err) {
      console.error('로그인 요청 실패:', err);
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow"
      >
        <h1 className="mb-4 text-lg font-semibold">레슨 시간표</h1>
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-lg bg-black py-2 text-white disabled:opacity-50"
        >
          {loading ? '확인 중...' : '입장'}
        </button>
      </form>
    </div>
  );
}
