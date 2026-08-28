import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 로그인 페이지, 로그인 API는 항상 통과
  if (pathname.startsWith('/login') || pathname.startsWith('/api/login')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('session')?.value;
  const session = token ? await verifySessionToken(token) : null;

  // 관리자 전용 경로 — role이 admin이 아니면 통합 로그인 화면으로
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!session || session.role !== 'admin') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return NextResponse.next();
  }

  // 일반 열람 경로 — 세션(viewer 또는 admin)만 있으면 통과
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};