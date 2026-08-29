'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import ViewerDrawer from '../../../components/ViewerDrawer';

type DayInfo = {
  date: string;
  day: number;
  dow: number;
  isTueThu: boolean;
  isActive: boolean;
};

type MonthData = {
  year: number;
  month: number;
  label: string;
  days: (DayInfo | null)[];
};

function buildMonth(
  year: number,
  month: number,
  activeSet: Set<string>
): MonthData {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();

  const days: (DayInfo | null)[] = [];
  for (let i = 0; i < firstDow; i++) {
    days.push(null);
  }

  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dow = new Date(year, month - 1, d).getDay();
    const isTueThu = dow === 2 || dow === 4;

    days.push({
      date: dateStr,
      day: d,
      dow,
      isTueThu,
      isActive: activeSet.has(dateStr),
    });
  }

  return {
    year,
    month,
    label: `${year}년 ${month}월`,
    days,
  };
}

export default function ViewerCalendarPage() {
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [pastMonthIndex, setPastMonthIndex] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage('');
    }, 1000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentYmStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  // 향후 3개월 목록 생성
  const futureMonthsList = useMemo(() => {
    const list: { year: number; month: number }[] = [];
    for (let i = 0; i < 3; i++) {
      let m = currentMonth + i;
      let y = currentYear;
      if (m > 12) {
        y += Math.floor((m - 1) / 12);
        m = ((m - 1) % 12) + 1;
      }
      list.push({ year: y, month: m });
    }
    return list;
  }, [currentYear, currentMonth]);

  const loadDates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lesson-dates');
      const data = await res.json();
      if (res.ok) {
        setActiveDates(new Set<string>(data.dates ?? []));
      } else {
        showToast('일정 조회 실패');
      }
    } catch {
      showToast('데이터 불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDates();
  }, [loadDates]);

  // 과거 레슨일이 존재하는 월 목록 추출
  const availablePastMonths = useMemo(() => {
    const ymSet = new Set<string>();
    activeDates.forEach((d) => {
      const ym = d.slice(0, 7);
      if (ym < currentYmStr) {
        ymSet.add(ym);
      }
    });

    const sortedYms = Array.from(ymSet).sort().reverse();
    return sortedYms.map((ym) => {
      const [y, m] = ym.split('-').map(Number);
      return { year: y, month: m };
    });
  }, [activeDates, currentYmStr]);

  useEffect(() => {
    setPastMonthIndex(0);
  }, [showPast]);

  const displayedMonths = useMemo(() => {
    if (!showPast) {
      return futureMonthsList.map(({ year, month }) =>
        buildMonth(year, month, activeDates)
      );
    }
    if (availablePastMonths.length === 0) return [];
    const target = availablePastMonths[pastMonthIndex] ?? availablePastMonths[0];
    return [buildMonth(target.year, target.month, activeDates)];
  }, [showPast, futureMonthsList, availablePastMonths, pastMonthIndex, activeDates]);

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-24 text-[#1C2B33]">
      <header className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] px-5 pt-8 pb-6 sm:px-8">
        <div className="flex items-center gap-3">
          <ViewerDrawer />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
              레슨 일정
            </h1>
            <a
              href="/viewer/assign"
              className="mt-1 inline-block text-xs text-[#1C2B33]/50 underline underline-offset-2 hover:text-[#1C2B33]"
            >
              ← 레슨 시간표 보기
            </a>
          </div>
        </div>

        {/* 과거 날짜 토글 및 네비게이션 */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPast((prev) => !prev)}
            className={
              'flex h-8 items-center rounded-full px-3.5 text-xs font-semibold transition-colors ' +
              (showPast
                ? 'bg-[#8F3A24] text-white shadow-xs'
                : 'border border-[#1C2B33]/20 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
            }
          >
            {showPast ? '✓ 과거 달력 보는 중' : '과거 날짜 보기'}
          </button>

          {showPast && availablePastMonths.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setPastMonthIndex((prev) => Math.min(prev + 1, availablePastMonths.length - 1))
                }
                disabled={pastMonthIndex >= availablePastMonths.length - 1}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1C2B33]/15 bg-white text-xs disabled:opacity-30 hover:bg-[#1C2B33]/5 transition-colors"
                title="더 이전 과거 달"
              >
                ◀
              </button>
              <div className="flex h-8 items-center justify-center rounded-full border border-[#1C2B33]/20 bg-white px-3 shadow-xs font-[family-name:var(--font-mono-club)] text-xs text-[#1C2B33]/70 font-semibold">
                {pastMonthIndex + 1} / {availablePastMonths.length}
              </div>
              <button
                type="button"
                onClick={() => setPastMonthIndex((prev) => Math.max(prev - 1, 0))}
                disabled={pastMonthIndex <= 0}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1C2B33]/15 bg-white text-xs disabled:opacity-30 hover:bg-[#1C2B33]/5 transition-colors"
                title="더 최근 과거 달"
              >
                ▶
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 3개월 달력 메인 그리드 (클릭 없는 순수 조회용) */}
      <main className="px-5 py-6 sm:px-8">
        {loading ? (
          <p className="text-sm text-[#1C2B33]/50">불러오는 중...</p>
        ) : showPast && availablePastMonths.length === 0 ? (
          <div className="max-w-md rounded-2xl border border-[#1C2B33]/10 bg-white p-6 text-center text-sm text-[#1C2B33]/50">
            등록된 과거 레슨일 데이터가 없습니다.
          </div>
        ) : (
          <div
            className={
              showPast ? 'max-w-md' : 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'
            }
          >
            {displayedMonths.map((m) => (
              <div
                key={m.label}
                className="rounded-3xl border border-[#1C2B33]/10 bg-white p-5 shadow-[0_4px_20px_rgba(28,43,51,0.04)]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-[#1C2B33]">
                    {m.label}
                  </h2>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center font-[family-name:var(--font-mono-club)] text-xs">
                  {['일', '월', '화', '수', '목', '금', '토'].map((dow, idx) => (
                    <div
                      key={dow}
                      className={
                        'py-1 font-semibold ' +
                        (idx === 2 || idx === 4
                          ? 'text-[#1C2B33]'
                          : idx === 0
                          ? 'text-[#B5482F]/70'
                          : 'text-[#1C2B33]/40')
                      }
                    >
                      {dow}
                    </div>
                  ))}

                  {m.days.map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="h-9" />;
                    }

                    return (
                      <div
                        key={day.date}
                        className={
                          'relative flex h-9 flex-col items-center justify-center rounded-xl text-xs font-medium select-none ' +
                          (day.isActive
                            ? 'bg-[#1C2B33] font-bold text-white shadow-xs'
                            : day.isTueThu
                            ? 'bg-[#1C2B33]/5 text-[#1C2B33]'
                            : 'text-[#1C2B33]/30')
                        }
                      >
                        <span>{day.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-[#1C2B33] px-4 py-3 text-sm font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            className="text-xs text-white/50 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}