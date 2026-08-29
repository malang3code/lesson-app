'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ViewerDrawer from '../../../components/ViewerDrawer';
import { toPng } from 'html-to-image';

type AssignedItem = {
  lessonId: number | string;
  memberId: number;
  name: string;
  department: string | null;
  phone: string | null;
  isCompleted?: boolean;
};

type Slot = {
  id: number;
  start_time: string;
  end_time: string;
  capacity: number;
  assigned: AssignedItem[];
};

function dowLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return ['일', '월', '화', '수', '목', '금', '토'][dow];
}

function todayStr() {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

export default function ViewerAssignPage() {
  const [rawDates, setRawDates] = useState<string[]>([]);
  const [showPast, setShowPast] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [calendarOpen, setCalendarOpen] = useState(false);

  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const [toastMessage, setToastMessage] = useState('');

  // 캡처 영역 참조
  const captureRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    fetch('/api/lesson-dates')
      .then((res) => res.json())
      .then((data) => {
        const dates: string[] = data.dates ?? [];
        setRawDates(dates);

        const today = todayStr();
        const upcoming = dates.find((d) => d >= today);
        if (upcoming) {
          setSelectedDate(upcoming);
          const [y, m] = upcoming.split('-').map(Number);
          setCalYear(y);
          setCalMonth(m);
        } else if (dates.length > 0) {
          setSelectedDate(dates[0]);
          const [y, m] = dates[0].split('-').map(Number);
          setCalYear(y);
          setCalMonth(m);
        }
      })
      .catch(() => showToast('레슨일 목록을 불러오지 못했습니다'));
  }, [showToast]);

  const activeLessonDateSet = useMemo(() => new Set(rawDates), [rawDates]);

  const today = todayStr();
  const currentYm = today.slice(0, 7);
  const currentCalYm = `${calYear}-${String(calMonth).padStart(2, '0')}`;

  const calendarDays = useMemo(() => {
    const firstDow = new Date(calYear, calMonth - 1, 1).getDay();
    const lastDate = new Date(calYear, calMonth, 0).getDate();

    const days: ({ dateStr: string; dayNum: number; isLesson: boolean; isBeforeCurrentMonth: boolean } | null)[] = [];
    for (let i = 0; i < firstDow; i++) {
      days.push(null);
    }

    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const ym = dateStr.slice(0, 7);
      days.push({
        dateStr,
        dayNum: d,
        isLesson: activeLessonDateSet.has(dateStr),
        isBeforeCurrentMonth: ym < currentYm,
      });
    }

    return days;
  }, [calYear, calMonth, activeLessonDateSet, currentYm]);

  const navigableLessonDates = useMemo(() => {
    const list = showPast
      ? [...rawDates]
      : rawDates.filter((d) => d.slice(0, 7) >= currentYm);
    return list.sort();
  }, [rawDates, showPast, currentYm]);

  const currentLessonIndex = selectedDate ? navigableLessonDates.indexOf(selectedDate) : -1;

  const handleSwitchDate = (newDate: string) => {
    setSelectedDate(newDate);
    const [y, m] = newDate.split('-').map(Number);
    setCalYear(y);
    setCalMonth(m);
  };

  const handlePrevLesson = () => {
    if (currentLessonIndex > 0) {
      handleSwitchDate(navigableLessonDates[currentLessonIndex - 1]);
    } else if (currentLessonIndex === -1 && selectedDate) {
      const prev = [...navigableLessonDates].reverse().find((d) => d < selectedDate);
      if (prev) handleSwitchDate(prev);
    }
  };

  const handleNextLesson = () => {
    if (currentLessonIndex >= 0 && currentLessonIndex < navigableLessonDates.length - 1) {
      handleSwitchDate(navigableLessonDates[currentLessonIndex + 1]);
    } else if (currentLessonIndex === -1 && selectedDate) {
      const next = navigableLessonDates.find((d) => d > selectedDate);
      if (next) handleSwitchDate(next);
    }
  };

  const handlePrevCalMonth = () => {
    setCalMonth((prev) => {
      if (prev === 1) {
        setCalYear((y) => y - 1);
        return 12;
      }
      return prev - 1;
    });
  };

  const handleNextCalMonth = () => {
    setCalMonth((prev) => {
      if (prev === 12) {
        setCalYear((y) => y + 1);
        return 1;
      }
      return prev + 1;
    });
  };

  const loadData = useCallback(async () => {
    if (!selectedDate) {
      setSlots([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/day-data?date=' + selectedDate);
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '조회 실패');
        return;
      }
      setSlots(data.slots ?? []);
    } catch {
      showToast('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 📷 모바일 이미지 캡처 & 공유 핸들러
  const handleShareImage = async () => {
    if (!captureRef.current || capturing || !selectedDate) return;
    setCapturing(true);
    showToast('이미지 생성 중...');

    try {
      const dataUrl = await toPng(captureRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#FAFAF7',
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `lesson-${selectedDate}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${selectedDate} 레슨 시간표`,
          text: `[레슨 시간표] ${selectedDate} (${dowLabel(selectedDate)}) 일정입니다.`,
          files: [file],
        });
        showToast('공유창을 열었습니다.');
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `레슨시간표_${selectedDate}.png`;
        link.click();
        showToast('시간표 이미지가 저장되었습니다.');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showToast('이미지 생성 실패');
      }
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-24 text-[#1C2B33]">
      <header className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] px-5 pt-8 pb-6 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <ViewerDrawer />
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
            레슨 시간표
          </h1>

          {/* 🎯 레슨 시간표 바로 오른쪽에 컴팩트하게 배치 */}
          <button
            type="button"
            onClick={handleShareImage}
            disabled={capturing || !selectedDate || slots.length === 0}
            className="flex h-8 items-center gap-1.5 rounded-full border border-[#1C2B33]/15 bg-white px-3 text-xs font-semibold text-[#1C2B33] shadow-xs transition-all active:scale-95 hover:bg-[#1C2B33]/5 disabled:opacity-40"
          >
            <span className="text-xs">📷</span>
            <span>{capturing ? '생성 중...' : '이미지 공유'}</span>
          </button>
        </div>

        {/* 날짜 네비게이션 */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrevLesson}
            disabled={currentLessonIndex <= 0}
            className="flex h-8 items-center gap-1 rounded-full border border-[#1C2B33]/15 bg-white px-3 text-xs font-semibold text-[#1C2B33]/80 transition-colors hover:bg-[#1C2B33]/5 disabled:opacity-30"
            aria-label="이전 레슨일"
          >
            ◀ 이전
          </button>

          <div className="flex h-8 items-center justify-center rounded-full border border-[#1C2B33]/20 bg-white px-3.5 shadow-xs">
            {selectedDate ? (
              <span className="font-[family-name:var(--font-mono-club)] text-xs font-bold text-[#1C2B33]">
                {selectedDate} ({dowLabel(selectedDate)})
              </span>
            ) : (
              <span className="text-xs text-[#1C2B33]/40">선택된 날짜 없음</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleNextLesson}
            disabled={
              currentLessonIndex === -1 ||
              currentLessonIndex >= navigableLessonDates.length - 1
            }
            className="flex h-8 items-center gap-1 rounded-full border border-[#1C2B33]/15 bg-white px-3 text-xs font-semibold text-[#1C2B33]/80 transition-colors hover:bg-[#1C2B33]/5 disabled:opacity-30"
            aria-label="다음 레슨일"
          >
            다음 ▶
          </button>

          <button
            type="button"
            onClick={() => setCalendarOpen((v) => !v)}
            className={
              'flex h-8 items-center rounded-full px-3 text-xs font-semibold transition-colors ' +
              (calendarOpen
                ? 'bg-[#1C2B33] text-white shadow-xs'
                : 'border border-[#1C2B33]/20 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
            }
          >
            {calendarOpen ? '✕ 달력 접기' : '📅 달력으로 선택'}
          </button>
        </div>

        {/* 달력 팝업 */}
        {calendarOpen && (
          <div className="mt-3 max-w-sm rounded-2xl border border-[#1C2B33]/10 bg-white p-4 shadow-[0_4px_12px_rgba(28,43,51,0.08)]">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrevCalMonth}
                disabled={!showPast && currentCalYm <= currentYm}
                className="grid h-7 w-7 place-items-center rounded-full border border-[#1C2B33]/15 text-xs text-[#1C2B33]/70 disabled:opacity-20 hover:bg-[#1C2B33]/5"
                aria-label="이전 달"
              >
                ◀
              </button>
              <span className="font-[family-name:var(--font-display)] text-base font-semibold">
                {calYear}년 {calMonth}월
              </span>
              <button
                type="button"
                onClick={handleNextCalMonth}
                className="grid h-7 w-7 place-items-center rounded-full border border-[#1C2B33]/15 text-xs text-[#1C2B33]/70 hover:bg-[#1C2B33]/5"
                aria-label="다음 달"
              >
                ▶
              </button>
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

              {calendarDays.map((item, idx) => {
                if (!item) return <div key={`empty-${idx}`} className="h-8" />;

                const isSelected = selectedDate === item.dateStr;
                const isDimmed = !showPast && item.isBeforeCurrentMonth;

                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    onClick={() => {
                      handleSwitchDate(item.dateStr);
                      setCalendarOpen(false);
                    }}
                    disabled={isDimmed}
                    className={
                      'relative h-8 rounded-lg text-xs font-medium transition-all ' +
                      (isSelected
                        ? 'bg-[#1C2B33] text-white shadow font-bold'
                        : item.isLesson
                        ? 'bg-[#1C2B33]/10 text-[#1C2B33] font-semibold hover:bg-[#1C2B33]/15'
                        : isDimmed
                        ? 'opacity-25 text-[#1C2B33]/40 cursor-not-allowed'
                        : 'text-[#1C2B33]/40 hover:bg-[#1C2B33]/5')
                    }
                  >
                    {item.dayNum}
                    {item.isLesson && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#8F3A24]" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 border-t border-[#1C2B33]/10 pt-2.5">
              <button
                type="button"
                onClick={() => setShowPast((prev) => !prev)}
                className="text-xs text-[#1C2B33]/60 underline underline-offset-2 hover:text-[#1C2B33]"
              >
                {showPast ? '✓ 이전 달 포함됨 (클릭 시 제외)' : '이전 달(과거) 레슨일 조회'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 본문 시간표 영역 */}
      <main className="px-5 py-6 sm:px-8">
        <div ref={captureRef} className="relative max-w-2xl bg-[#FAFAF7] p-2 rounded-3xl">
          <div className="absolute top-4 bottom-4 left-[52px] w-px bg-[#1C2B33]/10 sm:left-[68px]" />

          <div className="space-y-3">
            {slots.map((slot) => {
              const isFull = slot.assigned.length >= slot.capacity;
              const emptySlotsCount = Math.max(0, slot.capacity - slot.assigned.length);
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
                    <div className="flex flex-wrap items-center gap-2">
                      {slot.assigned.map((a) => {
                        const isCompleted = !!a.isCompleted;

                        return (
                          <span
                            key={a.lessonId}
                            className={
                              'inline-flex h-[34px] items-center rounded-full border px-3.5 text-sm font-medium transition-all select-none ' +
                              (isCompleted
                                ? 'bg-[#E8F3EE] text-[#1F6F63] border-[#1F6F63]/30 line-through'
                                : 'bg-[#FAFAF7] text-[#1C2B33] border-[#1C2B33]/10')
                            }
                          >
                            {a.name}
                          </span>
                        );
                      })}

                      {Array.from({ length: emptySlotsCount }).map((_, idx) => (
                        <div
                          key={`empty-${slot.id}-${idx}`}
                          className="flex h-[34px] w-[64px] items-center justify-center rounded-full border border-dashed border-[#1C2B33]/15 text-xs text-[#1C2B33]/25 select-none"
                        >
                          빈자리
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {!loading && selectedDate && slots.length === 0 && (
              <p className="pl-[68px] text-sm text-[#1C2B33]/40">
                {activeLessonDateSet.has(selectedDate)
                  ? '이 날짜에는 시간대 슬롯이 없습니다.'
                  : '등록된 레슨일이 아닙니다.'}
              </p>
            )}
          </div>
        </div>
      </main>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-[#1C2B33] px-4 py-3 text-sm font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}