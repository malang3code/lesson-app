'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

type Member = {
  id: number;
  name: string;
  department: string | null;
  phone: string | null;
  alreadyAssignedToday?: boolean;
};

type Slot = {
  id: number;
  start_time: string;
  end_time: string;
  capacity: number;
  assigned: {
    lessonId: number;
    memberId: number;
    name: string;
    department: string | null;
    phone: string | null;
  }[];
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
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function AdminAssignPage() {
  const [rawDates, setRawDates] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [showPast, setShowPast] = useState(false); // 과거 날짜 보기 토글 상태
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [eligibleMembers, setEligibleMembers] = useState<Member[]>([]);
  const [showAllOverride, setShowAllOverride] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [copyPanelOpen, setCopyPanelOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());
  const [copyResult, setCopyResult] = useState('');
  const [copying, setCopying] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetch('/api/lesson-dates')
      .then((res) => res.json())
      .then((data) => setRawDates(data.dates ?? []))
      .catch(() => setError('레슨일 목록을 불러오지 못했습니다'));
  }, []);

  const filteredDates = useMemo(() => {
    const today = todayStr();
    let dates = rawDates;

    // 과거 날짜 보기가 비활성화 상태면 오늘 이후 날짜만 노출
    if (!showPast) {
      dates = dates.filter((d) => d >= today);
    }

    if (filter === 'all') return dates;
    const target = filter === 'tue' ? 2 : 4;
    return dates.filter((d) => dowOfDate(d) === target);
  }, [rawDates, filter, showPast]);

  useEffect(() => {
    if (filteredDates.length === 0) {
      setSelectedDate(null);
      return;
    }
    if (selectedDate && filteredDates.includes(selectedDate)) return;
    const today = todayStr();
    const upcoming = filteredDates.find((d) => d >= today);
    setSelectedDate(upcoming ?? filteredDates[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredDates]);

  const loadData = useCallback(async () => {
    if (!selectedDate) {
      setSlots([]);
      setEligibleMembers([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/day-data?date=' + selectedDate);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '조회 실패');
        setSlots([]);
        setEligibleMembers([]);
        return;
      }
      setSlots(data.slots);
      setEligibleMembers(data.eligibleMembers);
    } catch {
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssign = async (slotId: number, memberId: string, override: boolean) => {
    if (!memberId || !selectedDate) return;

    const res = await fetch('/api/admin/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonDate: selectedDate,
        timeSlotId: slotId,
        memberId: Number(memberId),
        override,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '배정 실패');
      return;
    }
    loadData();
  };

  const handleRemove = async (lessonId: number) => {
    if (!confirm('이 배정을 삭제할까요?')) return;
    const res = await fetch('/api/admin/lessons?id=' + lessonId, { method: 'DELETE' });
    if (!res.ok) {
      alert('삭제 실패');
      return;
    }
    loadData();
  };

  const handleResetDay = async () => {
    if (!selectedDate) return;
    setResetting(true);
    try {
      const res = await fetch('/api/admin/lessons?date=' + selectedDate, { method: 'DELETE' });
      if (!res.ok) {
        alert('초기화 실패');
        return;
      }
      loadData();
    } finally {
      setResetting(false);
    }
  };

  const currentIndex = selectedDate ? filteredDates.indexOf(selectedDate) : -1;
  const goPrev = () => {
    if (currentIndex > 0) setSelectedDate(filteredDates[currentIndex - 1]);
  };
  const goNext = () => {
    if (currentIndex >= 0 && currentIndex < filteredDates.length - 1) {
      setSelectedDate(filteredDates[currentIndex + 1]);
    }
  };

  const hasAnyAssignment = slots.some((s) => s.assigned.length > 0);

  const toggleCopyTarget = (date: string) => {
    setCopyTargets((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const runCopy = async () => {
    if (!selectedDate || copyTargets.size === 0) return;
    setCopying(true);
    setCopyResult('');
    try {
      const res = await fetch('/api/admin/lessons/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromDate: selectedDate,
          toDates: Array.from(copyTargets),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCopyResult(data.error || '복사 실패');
        return;
      }
      const lines = Object.entries(data.summary as Record<string, { copied: number; skipped: number }>).map(
        ([date, s]) => date + ': ' + s.copied + '건 복사, ' + s.skipped + '건 건너뜀'
      );
      setCopyResult(lines.join(' / '));
      setCopyTargets(new Set());
    } catch {
      setCopyResult('네트워크 오류');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1C2B33]">
      <header className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] px-5 pt-8 pb-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-[family-name:var(--font-mono-club)] text-xs tracking-[0.25em] text-[#1C2B33]/50 uppercase">
              Admin Roster
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              레슨 배정판
            </h1>
          </div>

          <a
            href="/admin/calendar"
            className="text-sm text-[#1C2B33]/50 underline underline-offset-2 hover:text-[#1C2B33]"
          >
            월별 레슨일 관리
          </a>
        </div>

        {/* 요일 필터 & 과거 날짜 보기 버튼 바 */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', '전체'],
                ['tue', '화요일만'],
                ['thu', '목요일만'],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={
                  'rounded-full px-3 py-1.5 text-sm font-medium transition-colors ' +
                  (filter === key
                    ? 'bg-[#1C2B33] text-white'
                    : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/60')
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/* 과거 날짜 보기 토글 버튼 */}
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
            {showPast ? '✓ 과거 날짜 포함됨' : '과거 날짜 보기'}
          </button>
        </div>

        {/* 날짜 선택 Prev / Next */}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentIndex <= 0}
            className="grid h-9 w-9 place-items-center rounded-full border border-[#1C2B33]/15 text-lg leading-none disabled:opacity-30 hover:bg-[#1C2B33]/5"
            aria-label="이전 레슨일"
          >
            Prev
          </button>

          <div className="rounded-full border border-[#1C2B33]/15 bg-white px-4 py-2 text-center">
            {selectedDate ? (
              <span className="font-[family-name:var(--font-mono-club)] text-sm font-semibold">
                {selectedDate} ({dowLabel(selectedDate)})
              </span>
            ) : (
              <span className="text-sm text-[#1C2B33]/40">선택 가능한 레슨일 없음</span>
            )}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={currentIndex < 0 || currentIndex >= filteredDates.length - 1}
            className="grid h-9 w-9 place-items-center rounded-full border border-[#1C2B33]/15 text-lg leading-none disabled:opacity-30 hover:bg-[#1C2B33]/5"
            aria-label="다음 레슨일"
          >
            Next
          </button>
        </div>

        {/* 복사 버튼 + 전체 초기화 버튼 */}
        {selectedDate && hasAnyAssignment && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setCopyPanelOpen((v) => !v);
                  setCopyResult('');
                }}
                className="rounded-full border border-[#1C2B33]/15 bg-white px-4 py-1.5 text-sm font-medium text-[#1C2B33]/70 hover:bg-[#1C2B33]/5"
              >
                {copyPanelOpen ? '복사 패널 닫기' : '이 배정을 다른 날짜에 복사'}
              </button>

              <button
                type="button"
                onClick={handleResetDay}
                disabled={resetting}
                className="rounded-full border border-[#B5482F]/30 bg-white px-4 py-1.5 text-sm font-medium text-[#B5482F] disabled:opacity-40 hover:bg-[#B5482F]/10"
              >
                {resetting ? '초기화 중...' : '이 날짜 전체 초기화'}
              </button>
            </div>

            {copyPanelOpen && (
              <div className="mt-3 max-w-md rounded-2xl border border-[#1C2B33]/10 bg-white p-4">
                <p className="mb-2 text-sm text-[#1C2B33]/60">
                  {selectedDate}의 배정을 복사할 날짜를 선택하세요.
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {rawDates
                    .filter((d) => d !== selectedDate)
                    .map((d) => (
                      <label key={d} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={copyTargets.has(d)}
                          onChange={() => toggleCopyTarget(d)}
                        />
                        {d} ({dowLabel(d)})
                      </label>
                    ))}
                  {rawDates.filter((d) => d !== selectedDate).length === 0 && (
                    <p className="text-sm text-[#1C2B33]/40">복사할 다른 레슨일이 없습니다.</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={runCopy}
                  disabled={copyTargets.size === 0 || copying}
                  className="mt-3 rounded-full bg-[#1C2B33] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {copying ? '복사 중...' : '선택한 날짜에 복사 (' + copyTargets.size + ')'}
                </button>

                {copyResult && <p className="mt-2 text-xs text-[#1C2B33]/60">{copyResult}</p>}
              </div>
            )}
          </div>
        )}
      </header>

      {error && <p className="px-5 pt-4 text-sm text-[#B5482F] sm:px-8">{error}</p>}
      {loading && <p className="px-5 pt-4 text-sm text-[#1C2B33]/50 sm:px-8">불러오는 중...</p>}

      <main className="px-5 py-6 sm:px-8">
        <div className="relative max-w-2xl">
          <div className="absolute top-2 bottom-2 left-[52px] w-px bg-[#1C2B33]/10 sm:left-[68px]" />

          <div className="space-y-3">
            {slots.map((slot) => {
              const showAll = !!showAllOverride[slot.id];
              const options = eligibleMembers.filter((m) => showAll || !m.alreadyAssignedToday);
              const isFull = slot.assigned.length >= slot.capacity;
              const startH = slot.start_time.slice(0, 5);

              return (
                <div key={slot.id} className="relative flex gap-4 sm:gap-6">
                  <div className="w-[52px] shrink-0 pt-3 text-right sm:w-[68px]">
                    <span className="font-[family-name:var(--font-mono-club)] text-lg font-bold sm:text-xl">
                      {startH}
                    </span>
                  </div>

                  <div
                    className={
                      'z-10 mt-4 h-3 w-3 shrink-0 rounded-full border-2 border-[#FAFAF7] ' +
                      (isFull ? 'bg-[#1F6F63]' : 'bg-[#C98A2B]')
                    }
                    style={{ marginLeft: '-6px' }}
                  />

                  <div className="flex-1 rounded-2xl border border-[#1C2B33]/10 bg-white p-3 shadow-[0_1px_2px_rgba(28,43,51,0.04)]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {slot.assigned.map((a) => (
                        <span
                          key={a.lessonId}
                          className="flex items-center gap-1.5 rounded-full bg-[#FAFAF7] py-1.5 pr-1.5 pl-3 text-sm"
                        >
                          <span className="font-medium">{a.name}</span>
                          <span className="text-xs text-[#1C2B33]/35">
                            {a.department ?? '-'} {a.phone ?? '-'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemove(a.lessonId)}
                            className="grid h-5 w-5 place-items-center rounded-full text-xs text-[#B5482F] hover:bg-[#B5482F]/10"
                            aria-label="배정 삭제"
                          >
                            X
                          </button>
                        </span>
                      ))}

                      {isFull ? (
                        <span className="rounded-full bg-[#1F6F63]/10 px-3 py-1.5 text-xs font-medium text-[#1F6F63]">
                          정원 마감
                        </span>
                      ) : (
                        <>
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssign(slot.id, e.target.value, showAll);
                              }
                            }}
                            className="rounded-full border border-[#1C2B33]/15 bg-white px-3 py-1.5 text-sm"
                          >
                            <option value="">+ 배정</option>
                            {options.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} {m.alreadyAssignedToday ? '(중복)' : ''}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() =>
                              setShowAllOverride((prev) => ({ ...prev, [slot.id]: !showAll }))
                            }
                            className={
                              'rounded-full px-2.5 py-1.5 text-xs font-medium ' +
                              (showAll ? 'bg-[#C98A2B] text-white' : 'bg-[#1C2B33]/5 text-[#1C2B33]/45')
                            }
                          >
                            중복
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {!loading && selectedDate && slots.length === 0 && (
              <p className="pl-[68px] text-sm text-[#1C2B33]/40">이 날짜에는 시간대가 없습니다.</p>
            )}
            {!loading && !selectedDate && (
              <p className="pl-[68px] text-sm text-[#1C2B33]/40">
                표시할 레슨일이 없습니다. 과거 날짜를 보려면 상단의 &apos;과거 날짜 보기&apos;를 눌러주세요.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}