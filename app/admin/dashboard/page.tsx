'use client';

import AdminDrawer from '@/components/AdminDrawer';

export default function AdminDashboardPage() {
  return (
    <div className="min-h-dvh bg-[#FAFAF7] pb-20 text-[#1C2B33]">
      {/* 상단 헤더 */}
      <header className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] px-4 pt-5 pb-4 sm:px-6 max-w-lg">
        <div className="flex items-center gap-3">
          <AdminDrawer />
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[#1C2B33] sm:text-2xl">
            대시보드
          </h1>
        </div>
      </header>

      {/* 대시보드 본문 임시 안내 */}
      <main className="px-4 py-6 sm:px-6 max-w-lg">
        <div className="rounded-3xl border border-[#1C2B33]/10 bg-white p-6 shadow-xs text-center space-y-3">
          <div className="text-3xl">📊</div>
          <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-[#1C2B33]">
            레슨 운영 대시보드 준비 중
          </h2>
          <p className="text-xs text-[#1C2B33]/60 leading-relaxed">
            회원 현황, 이번 달 레슨 진행률, 출석률 및 변경 내역 통계를 한눈에 볼 수 있도록 구성될 예정입니다.
          </p>
        </div>
      </main>
    </div>
  );
}