'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [pastMonthIndex, setPastMonthIndex] = useState(0);

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
    try {
      const res = await fetch('/api/admin/lesson-dates');
      const data = await res.json();
      if (res.ok) {
        setActiveDates(new Set(data.dates ?? []));
        setAssignmentCounts(data.assignmentCounts ?? {});
      } else {
        setMessage('조회 실패: ' + (typeof data.error === 'object' ? JSON.stringify(data.error) : data.error));
      }
    } catch (e: unknown) {
      setMessage('데이터 불러오기 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDates();
  }, [loadDates]);

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

  const toggleDate = async (dateStr: string, currentlyActive: boolean, force = false) => {
    const willActive = !currentlyActive;
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/lesson-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, isActive: willActive, forceDelete: force }),
      });

      const data = await res.json();

      if (res.status === 409 && data.requireConfirm) {
        setSaving(false);
        const confirmed = window.confirm(
          `⚠️ [주의] ${dateStr}에 ${data.assignmentCount}건의 수강생 배정 내역이 있습니다.\n\n` +
          `레슨일을 해제하면 해당 배정 데이터가 영구 삭제됩니다.\n계속 진행하시겠습니까?`
        );

        if (confirmed) {
          toggleDate(dateStr, currentlyActive, true);
        }
        return;
      }

      if (!res.ok) {
        const errText = typeof data.error === 'object' ? JSON.stringify(data.error) : (data.error || '저장 실패');
        setMessage('오류 발생: ' + errText);
        return;
      }

      await loadDates();
    } catch (e: unknown) {
      setMessage('네트워크 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const autoSelectTueThu = async (year: number, month: number) => {
    const lastDate = new Date(year, month, 0).getDate();
    const tueThus: string[] = [];

    for (let d = 1; d <= lastDate; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      if (dow === 2 || dow === 4) {
        tueThus.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/lesson-dates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: tueThus, isActive: true }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadDates();
        setMessage(`${year}년 ${month}월 화/목이 일괄 등록되었습니다.`);
      } else {
        const errText = typeof data.error === 'object' ? JSON.stringify(data.error) : (data.error || '일괄 등록 실패');
        setMessage('오류: ' + errText);
      }
    } catch (e: unknown) {
      setMessage('네트워크 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const clearMonth = async (year: number, month: number) => {
    const lastDate = new Date(year, month, 0).getDate();
    const monthDates: string[] = [];

    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (activeDates.has(dateStr)) {
        monthDates.push(dateStr);
      }
    }

    if (monthDates.length === 0) {
      setMessage('해제할 레슨일이 없습니다.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/lesson-dates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: monthDates, isActive: false }),
      });

      const data = await res.json();

      if (res.ok) {
        await loadDates();

        const deletedCount = (data.deletedDates ?? []).length;
        const preservedCount = data.preservedCount ?? 0;

        if (deletedCount === 0 && preservedCount > 0) {
          setMessage(`배정 데이터가 있는 ${preservedCount}개 레슨일은 보존되었으며, 해제할 빈 날짜가 없습니다.`);
        } else if (preservedCount > 0) {
          setMessage(`배정 데이터가 없는 ${deletedCount}개 레슨일이 해제되었습니다. (${preservedCount}개 일자 보존)`);
        } else {
          setMessage(`${year}년 ${month}월 레슨일이 전체 해제되었습니다.`);
        }
      } else {
        const errText = typeof data.error === 'object' ? JSON.stringify(data.error) : (data.error || '해제 실패');
        setMessage('오류: ' + errText);
      }
    } catch (e: unknown) {
      setMessage('네트워크 오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1C2B33]">
      <header className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] px-5 pt-8 pb-6 sm:px-8">
        {/* 🎯 좌측 햄버거 메뉴 + 타이틀 및 돌아가기 */}
        <div className="flex items-center gap-3">
          <AdminDrawer />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
              레슨일 관리
            </h1>
            <a
              href="/admin/assign"
              className="mt-1 inline-block text-sm text-[#1C2B33]/50 underline underline-offset-2 hover:text-[#1C2B33]"
            >
              ← 돌아가기
            </a>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPast((prev) => !prev)}
            className={
              'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ' +
              (showPast
                ? 'bg-[#8F3A24] text-white shadow-sm'
                : 'border border-[#1C2B33]/20 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
            }
          >
            {showPast ? '✓ 과거 달력 보는 중' : '과거 날짜 보기'}
          </button>

          {showPast && availablePastMonths.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setPastMonthIndex((prev) => Math.min(prev + 1, availablePastMonths.length - 1))
                }
                disabled={pastMonthIndex >= availablePastMonths.length - 1}
                className="grid h-8 w-8 place-items-center rounded-full border border-[#1C2B33]/15 bg-white text-xs disabled:opacity-30 hover:bg-[#1C2B33]/5"
                title="더 이전 과거 달"
              >
                ◀
              </button>
              <span className="font-[family-name:var(--font-mono-club)] text-xs text-[#1C2B33]/60">
                {pastMonthIndex + 1} / {availablePastMonths.length}
              </span>
              <button
                type="button"
                onClick={() => setPastMonthIndex((prev) => Math.max(prev - 1, 0))}
                disabled={pastMonthIndex <= 0}
                className="grid h-8 w-8 place-items-center rounded-full border border-[#1C2B33]/15 bg-white text-xs disabled:opacity-30 hover:bg-[#1C2B33]/5"
                title="더 최근 과거 달"
              >
                ▶
              </button>
            </div>
          )}
        </div>

        {message && (
          <div className="mt-4 rounded-xl border border-[#1C2B33]/15 bg-white px-4 py-2.5 text-sm font-medium text-[#1C2B33] shadow-sm">
            {message}
          </div>
        )}
        {saving && <p className="mt-2 text-xs text-[#1C2B33]/50">저장 중...</p>}
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
              showPast ? 'max-w-md' : 'grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3'
            }
          >
            {displayedMonths.map((m) => (
              <div
                key={m.label}
                className="rounded-2xl border border-[#1C2B33]/10 bg-white p-4 shadow-[0_1px_2px_rgba(28,43,51,0.04)]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                    {m.label}
                  </h2>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => autoSelectTueThu(m.year, m.month)}
                      className="rounded-full border border-[#1C2B33]/15 px-2.5 py-1 text-xs text-[#1C2B33]/70 hover:bg-[#1C2B33]/5"
                    >
                      전체선택
                    </button>
                    <button
                      type="button"
                      onClick={() => clearMonth(m.year, m.month)}
                      title="배정 데이터가 없는 레슨일만 안전하게 해제합니다"
                      className="rounded-full border border-[#B5482F]/30 px-2.5 py-1 text-xs text-[#B5482F] hover:bg-[#B5482F]/10"
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
                          ? 'text-[#B5482F]/60'
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
                          'relative h-9 rounded-lg text-sm font-medium transition-colors ' +
                          (day.isActive
                            ? 'bg-[#1C2B33] font-semibold text-white shadow-sm'
                            : day.isTueThu
                            ? 'bg-[#1C2B33]/5 text-[#1C2B33] hover:bg-[#1C2B33]/10'
                            : 'text-[#1C2B33]/30 hover:bg-[#1C2B33]/5')
                        }
                      >
                        {day.day}
                        {day.isActive && day.hasAssignments && (
                          <span
                            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#C98A2B]"
                            title="배정 데이터 존재"
                          />
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
    </div>
  );
}