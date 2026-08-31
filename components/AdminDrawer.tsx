'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MENU_ITEMS = [
  { href: '/admin/dashboard', label: '대시보드' },
  { href: '/admin/assign', label: '레슨 시간표' },
  { href: '/admin/calendar', label: '레슨일 관리' },
  { href: '/admin/settings', label: '정보 관리' },
];

export default function AdminDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleLogout = () => {
    localStorage.removeItem('role');
    document.cookie = 'role=; path=/; max-age=0;';
    document.cookie = 'admin_session=; path=/; max-age=0;';
    document.cookie = 'admin_token=; path=/; max-age=0;';
    document.cookie = 'session=; path=/; max-age=0;';
    window.location.href = '/';
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#1C2B33]/15 bg-white shadow-sm transition-colors hover:bg-[#1C2B33]/5 active:scale-95"
        aria-label="메뉴 열기"
        title="메뉴"
      >
        <span className="h-0.5 w-4 rounded-full bg-[#1C2B33]" />
        <span className="h-0.5 w-4 rounded-full bg-[#1C2B33]" />
        <span className="h-0.5 w-4 rounded-full bg-[#1C2B33]" />
      </button>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
        />
      )}

      <aside
        className={
          'fixed top-0 left-0 bottom-0 z-50 flex w-72 flex-col justify-between bg-[#FAFAF7] p-6 shadow-2xl transition-transform duration-300 ease-in-out ' +
          (isOpen ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <div>
          <div className="flex items-center justify-between border-b border-[#1C2B33]/10 pb-4">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[#1C2B33]">
              관리자 메뉴
            </h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-full text-base text-[#1C2B33]/60 hover:bg-[#1C2B33]/10 hover:text-[#1C2B33]"
              aria-label="메뉴 닫기"
            >
              ✕
            </button>
          </div>

          <nav className="mt-6 space-y-1.5">
            {MENU_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={
                    'flex items-center rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ' +
                    (isActive
                      ? 'bg-[#1C2B33] text-white shadow-sm font-semibold'
                      : 'text-[#1C2B33]/70 hover:bg-[#1C2B33]/5 hover:text-[#1C2B33]')
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#1C2B33]/10 pt-4 space-y-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full cursor-pointer items-center justify-center rounded-xl border border-[#1C2B33]/15 bg-white py-2 text-xs font-medium text-[#1C2B33]/70 hover:bg-[#1C2B33]/5 hover:text-[#1C2B33] transition-colors"
          >
            로그아웃
          </button>
          <div className="text-center font-[family-name:var(--font-mono-club)] text-[11px] text-[#1C2B33]/40">
            Admin Mode
          </div>
        </div>
      </aside>
    </>
  );
}