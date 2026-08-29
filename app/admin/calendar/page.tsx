'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import AdminDrawer from '@/components/AdminDrawer';

type DayInfo = {
  date: string;
  day: number;
  dow: number;
  isTueThu: boolean;
  isActive: boolean;
  hasAssignments: boolean;
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
  activeSet: Set<string>,
  assignmentCounts: Record<string, number>
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
      hasAssignments: (assignmentCounts[dateStr] || 0) > 0,
    });
  }

  return {
    year,
    month,
    label: `${year}년 ${month}월`,
    days,
  };
}

export default function CalendarAdminPage() {
  const [originalActiveDates, setOriginalActiveDates] = useState<Set<string>>(new Set());
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    }, 1200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentYmStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

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
        const loadedSet = new Set<string>(data.dates ?? []);
        setOriginalActiveDates(new Set(loadedSet));
        setActiveDates(new Set(loadedSet));
        setAssignmentCounts(data.assignmentCounts ?? {});
      } else {
        showToast('조회 실패: ' + (typeof data.error === 'object' ? JSON.stringify(data.error) : data.error));
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

  const isDirty = useMemo(() => {
    const origArr = Array.from(originalActiveDates).sort().join(',');
    const currArr = Array.from(activeDates).sort().join(',');
    return origArr !== currArr;
  }, [originalActiveDates, activeDates]);

  const [showSaveBar, setShowSaveBar] = useState(false);

  useEffect(() => {
    if (!isDirty) {
      setShowSaveBar(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowSaveBar(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isDirty, activeDates]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

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
        buildMonth(year, month, activeDates, assignmentCounts)
      );
    }
    if (availablePastMonths.length === 0) return [];
    const target = availablePastMonths[pastMonthIndex] ?? availablePastMonths[0];
    return [buildMonth(target.year, target.month, activeDates, assignmentCounts)];
  }, [showPast, futureMonthsList, availablePastMonths, pastMonthIndex, activeDates, assignmentCounts]);

  const toggleDate = (dateStr: string, currentlyActive: boolean) => {
    if (currentlyActive && (assignmentCounts[dateStr] || 0) > 0) {
      const count = assignmentCounts[dateStr];
      const confirmed = window.confirm(
        `⚠️ [주의] ${dateStr}에 ${count}건의 수강생 배정 내역이 있습니다.\n\n` +
        `레슨일을 해제하고 저장하면 해당 배정 데이터가 영구 삭제됩니다.\n계속 진행하시겠습니까?`
      );
      if (!confirmed) return;
    }

    setActiveDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  const autoSelectTueThu = (year: number, month: number) => {
    const lastDate = new Date(year, month, 0).getDate();
    setActiveDates((prev) => {
      const next = new Set(prev);
      for (let d = 1; d <= lastDate; d++) {
        const dow = new Date(year, month - 1, d).getDay();
        if (dow === 2 || dow === 4) {
          next.add(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
      }
      return next;
    });
  };

  const clearMonth = (year: number, month: number) => {
    const lastDate = new Date(year, month, 0).getDate();
    let preservedCount = 0;
    let deletedCount = 0;

    setActiveDates((prev) => {
      const next = new Set(prev);
      for (let d = 1; d <= lastDate; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (next.has(dateStr)) {
          if ((assignmentCounts[dateStr] || 0) > 0) {
            preservedCount++;
          } else {
            next.delete(dateStr);
            deletedCount++;
          }
        }
      }
      return next;
    });

    if (deletedCount === 0 && preservedCount > 0) {
      showToast(`배정 내역이 있는 ${preservedCount}개 일자는 보존되었습니다.`);
    } else if (preservedCount > 0) {
      showToast(`${deletedCount}개 일자가 해제되었습니다. (${preservedCount}개 배정일자 보존)`);
    } else {
      showToast(`${year}년 ${month}월 레슨일이 해제되었습니다.`);
    }
  };

  const handleRevert = () => {
    setActiveDates(new Set(originalActiveDates));
    setShowSaveBar(false);
    showToast('원래대로 되돌렸습니다.');
  };

  const handleSaveChanges = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const datesArray = Array.from(activeDates).sort();
      const res = await fetch('/api/admin/lesson-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: datesArray }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '저장 실패');
        return;
      }

      setOriginalActiveDates(new Set(activeDates));
      setShowSaveBar(false);
      showToast('레슨 일정이 성공적으로 저장되었습니다.');
      loadDates();
    } catch {
      showToast('저장 중 네트워크 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-28 text-[#1C2B33]">
      <header className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] px-5 pt-8 pb-6 sm:px-8">
        <div className="flex items-center gap-3">
          <AdminDrawer />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
              레슨일 관리
            </h1>
            <Link
              href="/admin/assign"
              className="mt-1 inline-block text-xs text-[#1C2B33]/50 underline underline-offset-2 hover:text-[#1C2B33]"
            >
              ← 돌아가기
            </Link>
          </div>
        </div>

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
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => autoSelectTueThu(m.year, m.month)}
                      className="flex h-7 items-center rounded-full border border-[#1C2B33]/15 bg-white px-2.5 text-xs font-medium text-[#1C2B33]/70 hover:bg-[#1C2B33]/5 transition-colors"
                    >
                      전체선택
                    </button>
                    <button
                      type="button"
                      onClick={() => clearMonth(m.year, m.month)}
                      title="배정 데이터가 없는 레슨일만 안전하게 해제합니다"
                      className="flex h-7 items-center rounded-full border border-[#B5482F]/30 bg-white px-2.5 text-xs font-medium text-[#B5482F] hover:bg-[#B5482F]/10 transition-colors"
                    >
                      전체 해제
                    </button>
                  </div>
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
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => toggleDate(day.date, day.isActive)}
                        className={
                          'relative flex h-9 flex-col items-center justify-center rounded-xl text-xs font-medium transition-all ' +
                          (day.isActive
                            ? 'bg-[#1C2B33] font-bold text-white shadow-xs hover:bg-[#253943]'
                            : day.isTueThu
                            ? 'bg-[#1C2B33]/5 text-[#1C2B33] hover:bg-[#1C2B33]/10'
                            : 'text-[#1C2B33]/30 hover:bg-[#1C2B33]/5')
                        }
                      >
                        <span>{day.day}</span>
                        {day.isActive && day.hasAssignments && (
                          <span
                            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#C98A2B]"
                            title="배정 데이터 존재"
                          ></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 🎯 하단 플로팅 저장 바 (화면 비율 가변 너비 + 1줄 정렬 최적화) */}
      {showSaveBar && isDirty && (
        <div className="fixed bottom-6 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center justify-between gap-2.5 rounded-2xl bg-[#1C2B33] px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="truncate text-xs text-white/80 whitespace-nowrap block">
            수정된 일정이 있습니다
          </span>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleRevert}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 active:scale-95 transition-all"
            >
              ↺ 되돌리기
            </button>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={saving}
              className="shrink-0 whitespace-nowrap rounded-full bg-[#1F6F63] px-4 py-1.5 text-xs font-bold text-white shadow transition-all hover:bg-[#1F6F63]/90 active:scale-95 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 🎯 통일된 블랙 테마 토스트 */}
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