'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AdminDrawer from '@/components/AdminDrawer';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const TABS = [
    { href: '/admin/settings/members', label: '레슨생 관리' },
    { href: '/admin/settings/slots', label: '시간대 슬롯 관리' },
    { href: '/admin/settings/recruitment', label: '레슨 모집' },
    { href: '/admin/settings/applications', label: '레슨 신청 내역' },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1C2B33]">
      <header className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] px-5 pt-8 pb-6 sm:px-8">
        <div className="flex items-center gap-3">
          <AdminDrawer />
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
                정보 관리
              </h1>
            </div>
            <Link
              href="/admin/assign"
              className="mt-1 inline-block text-sm text-[#1C2B33]/50 underline underline-offset-2 hover:text-[#1C2B33]"
            >
              ← 돌아가기
            </Link>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="mt-6 flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={
                  'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ' +
                  (isActive
                    ? 'bg-[#1C2B33] text-white shadow-sm'
                    : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </header>

      <main className="max-w-5xl px-3 py-6 sm:px-8">{children}</main>
    </div>
  );
}