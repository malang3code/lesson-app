import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSessionToken } from '@/lib/session';

export async function POST(req: Request) {
  const { password } = await req.json();

  if (!password) {
    return NextResponse.json({ error: '비밀번호를 입력하세요' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('access_passwords')
    .select('role, password');

  if (error || !data) {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }

  // admin을 먼저 체크 (혹시 두 비번이 같은 값이면 admin 우선)
  const match = data
    .sort((a, b) => (a.role === 'admin' ? -1 : 1))
    .find((row) => row.password === password);

  if (!match) {
    return NextResponse.json({ error: '비밀번호가 틀렸습니다' }, { status: 401 });
  }

  const role = match.role as 'admin' | 'viewer';
  const token = await createSessionToken(role);
  const res = NextResponse.json({ success: true, role });
  res.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}
