'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import AdminDrawer from '@/components/AdminDrawer';

type MemberStat = {
  id: number;
  name: string;
  department?: string;
  lessonDay: string; // TUE, THU, BOTH
  targetCount: number;
  assignedCount: number;
  completedCount: number;
  absentCount?: number;
  attendanceRate?: number;
};

type DashboardData = {
  term: string;
  totalDates: number;
  tueCount: number;
  thuCount: number;
  tueAbsentCount: number;
  thuAbsentCount: number;
  dates: string[];
  members: MemberStat[];
};

export default function DashboardPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const termMonthStr = `${year}-${String(month).padStart(2, '0')}`;

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/dashboard?term=${termMonthStr}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [termMonthStr]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // 화요일 / 목요일 그룹 분리
  const tueMembers = useMemo(() => {
    if (!data) return [];
    return data.members.filter((m) => m.lessonDay === 'TUE' || m.lessonDay === 'BOTH');
  }, [data]);

  const thuMembers = useMemo(() => {
    if (!data) return [];
    return data.members.filter((m) => m.lessonDay === 'THU' || m.lessonDay === 'BOTH');
  }, [data]);

  // 총 목표 회수 (인원수 * 4회) & 총 출석 완료 합계 계산
  const totalTargetCount = useMemo(() => {
    return (tueMembers.length + thuMembers.length) * 4;
  }, [tueMembers, thuMembers]);

  const totalCompletedCount = useMemo(() => {
    if (!data) return 0;
    return data.members.reduce((sum, m) => sum + (m.completedCount || 0), 0);
  }, [data]);

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-8 text-[#1C2B33]">
      {/* 헤더 영역 */}
      <header className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] px-5 pt-6 pb-4 sm:px-8">
        <div className="flex items-center gap-3">
          <AdminDrawer />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
              출석 대시보드
            </h1>
            <Link
              href="/admin/assign"
              className="mt-0.5 inline-block text-xs text-[#1C2B33]/50 underline underline-offset-2 hover:text-[#1C2B33]"
            >
              ← 레슨시간표로 돌아가기
            </Link>
          </div>
        </div>

        {/* 상단 월 이동 및 레슨 현황 뱃지 */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* 월 이동기 */}
          <div className="flex h-8 items-center gap-1 rounded-full border border-[#1C2B33]/15 bg-white px-2.5 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-[#1C2B33]/70 hover:bg-[#1C2B33]/5"
            >
              ◀
            </button>
            <span className="font-[family-name:var(--font-display)] text-xs font-bold text-[#1C2B33] px-1">
              {year}년 {month}월
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-[#1C2B33]/70 hover:bg-[#1C2B33]/5"
            >
              ▶
            </button>
          </div>

          {/* 3개 통계 뱃지 */}
          {data && (
            <div className="flex flex-wrap items-center gap-1.5 font-[family-name:var(--font-mono-club)] text-xs">
              <span className="flex h-8 items-center rounded-full border border-[#1C2B33]/15 bg-white px-3 text-[#1C2B33]/80 shadow-2xs">
                <span>총:&nbsp;</span>
                <strong className="text-[#1C2B33]">{totalCompletedCount}</strong>
                <span>&nbsp;/ {totalTargetCount}회</span>
              </span>
              <span className="flex h-8 items-center rounded-full bg-[#1C2B33]/5 px-3 text-[#1C2B33]/80">
                <span>화:&nbsp;</span>
                <span>결석&nbsp;</span>
                <strong className="text-[#1C2B33]">{data.tueAbsentCount ?? 0}회</strong>
              </span>
              <span className="flex h-8 items-center rounded-full bg-[#1C2B33]/5 px-3 text-[#1C2B33]/80">
                <span>목:&nbsp;</span>
                <span>결석&nbsp;</span>
                <strong className="text-[#1C2B33]">{data.thuAbsentCount ?? 0}회</strong>
              </span>
            </div>
          )}
        </div>
      </header>

      {/* 본문 (max-w-lg 규격 일치) */}
      <main className="w-full max-w-lg px-5 py-4 sm:px-8 space-y-4 text-left">
        {loading ? (
          <p className="text-xs text-[#1C2B33]/50">통계 불러오는 중...</p>
        ) : !data ? (
          <p className="text-xs text-[#1C2B33]/50">데이터를 불러오지 못했습니다.</p>
        ) : (
          <>
            {/* 1. 화요일 세션 */}
            <section className="rounded-3xl border border-[#1C2B33]/10 bg-white p-4 shadow-[0_4px_20px_rgba(28,43,51,0.04)]">
              <div className="mb-2 flex items-center justify-between border-b border-[#1C2B33]/10 pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#1C2B33]">
                    화요일 세션
                  </h2>
                  <span className="rounded-full bg-[#1F6F63]/10 px-2 py-0.5 text-[11px] font-bold text-[#1F6F63]">
                    {tueMembers.length}명
                  </span>
                </div>
              </div>

              <div className="divide-y divide-[#1C2B33]/5">
                {tueMembers.map((m) => (
                  <MemberRow key={m.id} member={m} />
                ))}
                {tueMembers.length === 0 && (
                  <p className="py-4 text-center text-xs text-[#1C2B33]/40">수강생이 없습니다.</p>
                )}
              </div>
            </section>

            {/* 2. 목요일 세션 */}
            <section className="rounded-3xl border border-[#1C2B33]/10 bg-white p-4 shadow-[0_4px_20px_rgba(28,43,51,0.04)]">
              <div className="mb-2 flex items-center justify-between border-b border-[#1C2B33]/10 pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#1C2B33]">
                    목요일 세션
                  </h2>
                  <span className="rounded-full bg-[#1F6F63]/10 px-2 py-0.5 text-[11px] font-bold text-[#1F6F63]">
                    {thuMembers.length}명
                  </span>
                </div>
              </div>

              <div className="divide-y divide-[#1C2B33]/5">
                {thuMembers.map((m) => (
                  <MemberRow key={m.id} member={m} />
                ))}
                {thuMembers.length === 0 && (
                  <p className="py-4 text-center text-xs text-[#1C2B33]/40">수강생이 없습니다.</p>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// 수강생 행 컴포넌트
function MemberRow({ member }: { member: MemberStat }) {
  const targetSessionCount = 4;
  const completed = member.completedCount || 0;
  const absent = member.absentCount || 0;

  // 비율 계산: 결석(빨강) 먼저 채우고, 출석(초록)을 채움 (합계 최대 100%)
  const absentWidth = Math.min((absent / targetSessionCount) * 100, 100);
  const completedWidth = Math.min((completed / targetSessionCount) * 100, 100 - absentWidth);

  const getBarColor = (count: number) => {
    if (count >= 4) return 'bg-[#1F6F63]'; // 4회: 시그니처 에메랄드
    if (count === 3) return 'bg-[#1F6F63]/80'; // 3회: 딥 에메랄드
    if (count === 2) return 'bg-[#1F6F63]/55'; // 2회: 미디엄 세이지
    if (count === 1) return 'bg-[#1F6F63]/35'; // 1회: 소프트 세이지
    return 'bg-transparent';
  };

  const barColor = getBarColor(completed);

  return (
    <div className="flex items-center gap-2.5 py-1.5 text-xs">
      {/* 1. 이름 */}
      <div className="w-14 shrink-0 font-medium text-[#1C2B33]">
        <span className="truncate">{member.name}</span>
      </div>

      {/* 2. 가로 프로그레스 바 (결석 왼쪽 정렬 + 결석 영역 내 중앙 텍스트) */}
      <div className="relative flex-1 flex items-center">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-[#1C2B33]/10 flex">
          {/* ① 결석 구간 (왼쪽 우선 배치 & 빨간색 블록 내 정중앙 텍스트) */}
          {absentWidth > 0 && (
            <div
              className="relative h-full bg-rose-500/85 transition-all duration-300 flex items-center justify-center overflow-hidden"
              style={{ width: `${absentWidth}%` }}
            >
              <span className="whitespace-nowrap px-1 text-[9px] font-medium text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
                {absentWidth >= 40 ? `결석 ${absent}회` : `결석 ${absent}회`}
              </span>
            </div>
          )}

          {/* ② 출석 완료 구간 (결석 바로 뒤에 연결) */}
          {completedWidth > 0 && (
            <div
              className={`h-full transition-all duration-300 ${barColor}`}
              style={{ width: `${completedWidth}%` }}
            />
          )}
        </div>
      </div>

      {/* 3. ?/4회 수치 (너비 w-14 고정) */}
      <div className="w-14 shrink-0 text-right font-[family-name:var(--font-mono-club)] text-xs">
        <strong className={completed >= 4 ? 'text-[#1F6F63]' : 'text-[#1C2B33]'}>
          {completed}
        </strong>
        <span className="text-[#1C2B33]/40"> / 4회</span>
      </div>
    </div>
  );
}