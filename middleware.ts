import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 정적 파일, API, 루트 페이지는 그대로 통과
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  const role = req.cookies.get('role')?.value;
  const adminSession = req.cookies.get('admin_session')?.value;

  // 관리자 페이지 접근 시 검사 -> 없으면 루트(/)로 이동
  if (pathname.startsWith('/admin')) {
    if (role !== 'admin' && adminSession !== 'true') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // 뷰어 페이지 접근 시 검사 -> 없으면 루트(/)로 이동
  if (pathname.startsWith('/viewer')) {
    if (!role || (role !== 'viewer' && role !== 'admin')) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};