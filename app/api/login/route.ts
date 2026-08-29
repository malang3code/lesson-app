import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSessionToken } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const inputPassword = String(body.password || '').trim();

    if (!inputPassword) {
      return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
    }

    // 1. DB (access_passwords 테이블)에서 비밀번호 조회
    const { data: rows, error: dbErr } = await supabaseAdmin
      .from('access_passwords')
      .select('role, password');

    if (dbErr || !rows || rows.length === 0) {
      return NextResponse.json(
        { error: '비밀번호 정보를 불러올 수 없습니다. DB 설정을 확인해주세요.' },
        { status: 500 }
      );
    }

    let dbAdminPassword = '';
    let dbViewerPassword = '';

    rows.forEach((row: { role: string; password: string | number }) => {
      const r = String(row.role || '').toLowerCase().trim();
      const p = String(row.password || '').trim();
      if (r === 'admin') dbAdminPassword = p;
      if (r === 'viewer') dbViewerPassword = p;
    });

    let role: 'admin' | 'viewer' | null = null;
    let redirectTo = '';

    // 관리자/뷰어 분기
    if (dbAdminPassword && inputPassword === dbAdminPassword) {
      role = 'admin';
      redirectTo = '/admin/assign';
    } else if (dbViewerPassword && inputPassword === dbViewerPassword) {
      role = 'viewer';
      redirectTo = '/viewer/assign';
    }

    if (!role) {
      return NextResponse.json(
        { error: '비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      role,
      redirectTo,
    });

    // 2. 쿠키 발급 (기존 세션 토큰 + 새 권한 쿠키)
    const cookieOptions = {
      path: '/',
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 30, // 30일
      sameSite: 'lax' as const,
    };

    response.cookies.set('role', role, cookieOptions);

    if (role === 'admin') {
      response.cookies.set('admin_session', 'true', cookieOptions);
      response.cookies.set('admin_token', 'true', cookieOptions);
    }

    // 기존 세션 토큰이 필요한 경우 발급
    try {
      if (typeof createSessionToken === 'function') {
        const token = await createSessionToken(role);
        response.cookies.set('session', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
          path: '/',
        });
      }
    } catch {
      // 토큰 생성 함수가 없더라도 계속 진행
    }

    return response;
  } catch {
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}