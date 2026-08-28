'use client';

import { useState, useEffect, useMemo } from 'react';

type Slot = {
  id: number;
  start_time: string;
  end_time: string;
  names: string[];
};

type Filter = 'all' | 'tue' | 'thu';

function dowOfDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function dowLabel(dateStr: string) {
  return ['일', '월', '화', '수', '목', '금', '토'][dowOfDate(dateStr)];
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export default function SchedulePage() {
  const [rawDates, setRawDates] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 전체 레슨일 목록 최초 1회 로드
  useEffect(() => {
    fetch('/api/lesson-dates')
      .then((res) => res.json())
      .then((data) => setRawDates(data.dates ?? []))
      .catch(() => setError('레슨일 목록을 불러오지 못했습니다'));
  }, []);

  const filteredDates = useMemo(() => {
    if (filter === 'all') return rawDates;
    const target = filter === 'tue' ? 2 : 4;
    return rawDates.filter((d) => dowOfDate(d) === target);
  }, [rawDates, filter]);

  // 필터가 바뀌거나 최초 로드 시, 오늘과 가장 가까운 날짜로 선택
  useEffect(() => {
    if (filteredDates.length === 0) {
      setSelectedDate(null);
      return;
    }
    if (selectedDate && filteredDates.includes(selectedDate)) return;

    const today = todayStr();
    const upcoming = filteredDates.find((d) => d >= today);
    setSelectedDate(upcoming ?? filteredDates[filteredDates.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredDates]);

  // 선택된 날짜의 레슨 데이터 로드
  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);
    setError('');
    fetch(`/api/lessons?date=${selectedDate}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setSlots(data.slots ?? []);
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  const currentIndex = selectedDate ? filteredDates.indexOf(selectedDate) : -1;
  const goPrev = () => {
    if (currentIndex > 0) setSelectedDate(filteredDates[currentIndex - 1]);
  };
  const goNext = () => {
    if (currentIndex >= 0 && currentIndex < filteredDates.length - 1) {
      setSelectedDate(filteredDates[currentIndex + 1]);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1C2B33]">
      <header className="border-b border-[#1C2B33]/10 px-5 pt-8 pb-6 sm:px-8">
        <p className="font-[family-name:var(--font-mono-club)] text-xs tracking-[0.25em] text-[#1C2B33]/50 uppercase">
          Lesson Schedule
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
          레슨 시간표
        </h1>

        {/* 필터 */}
        <div className="mt-4 flex gap-2">
          {(
            [
              ['all', '전체'],
              ['tue', '화요일만'],
              ['thu', '목요일만'],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                filter === key
                  ? 'bg-[#1C2B33] text-white'
                  : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 날짜 네비게이션 */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={goPrev}
            disabled={currentIndex <= 0}
            className="grid h-9 w-9 place-items-center rounded-full border border-[#1C2B33]/15 text-lg leading-none disabled:opacity-30"
            aria-label="이전 레슨일"
          >
            ‹
          </button>

          <div className="rounded-full border border-[#1C2B33]/15 bg-white px-4 py-2 text-center">
            {selectedDate ? (
              <span className="font-[family-name:var(--font-mono-club)] text-sm font-semibold">
                {selectedDate} ({dowLabel(selectedDate)})
              </span>
            ) : (
              <span className="text-sm text-[#1C2B33]/40">등록된 레슨일 없음</span>
            )}
          </div>

          <button
            onClick={goNext}
            disabled={currentIndex < 0 || currentIndex >= filteredDates.length - 1}
            className="grid h-9 w-9 place-items-center rounded-full border border-[#1C2B33]/15 text-lg leading-none disabled:opacity-30"
            aria-label="다음 레슨일"
          >
            ›
          </button>
        </div>
      </header>

      <main className="px-5 py-6 sm:px-8">
        {error && <p className="mb-3 text-sm text-[#B5482F]">{error}</p>}
        {loading && <p className="mb-3 text-sm text-[#1C2B33]/40">불러오는 중...</p>}

        <div className="max-w-2xl space-y-2">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="flex items-center gap-4 rounded-xl border border-[#1C2B33]/10 bg-white p-3"
            >
              <span className="font-[family-name:var(--font-mono-club)] w-16 shrink-0 text-sm font-bold">
                {slot.start_time.slice(0, 5)}
              </span>
              <span className="text-sm text-[#1C2B33]/80">
                {slot.names.length > 0 ? slot.names.join(', ') : (
                  <span className="text-[#1C2B33]/30">배정 없음</span>
                )}
              </span>
            </div>
          ))}

          {!loading && selectedDate && slots.length === 0 && (
            <p className="text-sm text-[#1C2B33]/40">이 날짜엔 시간대가 없습니다.</p>
          )}
        </div>
      </main>
    </div>
  );
}
