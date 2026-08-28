'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function buildMonthList() {
  const now = new Date();
  const list = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    list.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: (d.getMonth() + 1) + '월',
    });
  }
  return list;
}

export default function AdminCalendarPage() {
  const MONTHS = useMemo(() => buildMonthList(), []);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0]);
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        '/api/admin/lesson-dates?year=' + selectedMonth.year + '&month=' + selectedMonth.month
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '조회 실패');
        return;
      }
      setActiveDates(new Set(data.dates));
    } catch (e) {
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadDates();
  }, [loadDates]);

  const toggleDate = async (dateStr: string) => {
    const res = await fetch('/api/admin/lesson-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateStr }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '처리 실패');
      return;
    }
    setActiveDates((prev) => {
      const next = new Set(prev);
      if (data.active) {
        next.add(dateStr);
      } else {
        next.delete(dateStr);
      }
      return next;
    });
  };

  const year = selectedMonth.year;
  const month = selectedMonth.month;
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstDay.getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1C2B33]">
      <header className="border-b border-[#1C2B33]/10 px-5 pt-8 pb-6 sm:px-8">
        <p className="font-[family-name:var(--font-mono-club)] text-xs tracking-[0.25em] text-[#1C2B33]/50 uppercase">
          Admin Schedule
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
          월별 레슨일 정하기
        </h1>
        <a
          href="/admin/assign"
          className="mt-2 inline-block text-sm text-[#1C2B33]/50 underline underline-offset-2"
        >
          배정판으로 돌아가기
        </a>
        <p className="mt-2 text-sm text-[#1C2B33]/50">
          화요일 목요일 중 실제로 레슨하는 날짜만 눌러서 켜주세요.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {MONTHS.map(function (m) {
            const isSelected = selectedMonth.month === m.month && selectedMonth.year === m.year;
            const cls = isSelected
              ? 'rounded-full px-4 py-1.5 text-sm font-medium bg-[#1C2B33] text-white'
              : 'rounded-full px-4 py-1.5 text-sm font-medium border border-[#1C2B33]/15 bg-white text-[#1C2B33]/70';
            return (
              <button
                key={m.year + '-' + m.month}
                onClick={() => setSelectedMonth(m)}
                className={cls}
                type="button"
              >
                {m.year}.{m.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="px-5 py-6 sm:px-8">
        {error ? <p className="mb-3 text-sm text-[#B5482F]">{error}</p> : null}
        {loading ? <p className="mb-3 text-sm text-[#1C2B33]/40">불러오는 중...</p> : null}

        <div className="max-w-md rounded-2xl border border-[#1C2B33]/10 bg-white p-4">
          <div className="mb-2 grid grid-cols-7 text-center text-xs text-[#1C2B33]/40">
            <div>일</div>
            <div>월</div>
            <div>화</div>
            <div>수</div>
            <div>목</div>
            <div>금</div>
            <div>토</div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map(function (day, idx) {
              if (day === null) {
                return <div key={idx}></div>;
              }

              const dow = new Date(year, month - 1, day).getDay();
              const clickable = dow === 2 || dow === 4;
              const dateStr = year + '-' + pad(month) + '-' + pad(day);
              const isActive = activeDates.has(dateStr);

              let btnClass =
                'aspect-square rounded-lg font-[family-name:var(--font-mono-club)] text-sm font-medium transition-colors ';
              if (!clickable) {
                btnClass = btnClass + 'text-[#1C2B33]/15 cursor-not-allowed';
              } else if (isActive) {
                btnClass = btnClass + 'bg-[#1F6F63] text-white cursor-pointer';
              } else {
                btnClass =
                  btnClass + 'bg-[#FAFAF7] text-[#1C2B33]/70 hover:bg-[#C98A2B]/15 cursor-pointer';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!clickable}
                  onClick={() => toggleDate(dateStr)}
                  className={btnClass}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-4 max-w-md text-xs text-[#1C2B33]/40">
          초록색 = 레슨일로 지정됨. 회색 화/목 = 미지정. 흐린 숫자 = 화/목 아님(선택 불가)
        </p>
      </main>
    </div>
  );
}
