'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Slot } from '@/components/LessonScheduleView';

export type SwapTargetInfo = {
  lessonDate: string;
  timeSlotId: number;
  timeStr: string;
  memberId?: number;
  memberName: string;
};

interface LessonSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceInfo: SwapTargetInfo | null;
  rawDates: string[];
  currentYm: string;
  onSelectTarget: (target: SwapTargetInfo) => void;
}

function dowLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return ['일', '월', '화', '수', '목', '금', '토'][dow];
}

export default function LessonSwapModal({
  isOpen,
  onClose,
  sourceInfo,
  rawDates,
  currentYm,
  onSelectTarget,
}: LessonSwapModalProps) {
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1);
  const [targetSlots, setTargetSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen && sourceInfo) {
      setTargetDate(sourceInfo.lessonDate);
      const [y, m] = sourceInfo.lessonDate.split('-').map(Number);
      setCalYear(y);
      setCalMonth(m);
    }
  }, [isOpen, sourceInfo]);

  // 대상 날짜의 슬롯 데이터 로드
  const fetchTargetDayData = useCallback(async (date: string) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/admin/day-data?date=${date}`);
      const data = await res.json();
      if (res.ok) {
        setTargetSlots(data.slots || []);
      } else {
        setTargetSlots([]);
      }
    } catch {
      setTargetSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && targetDate) {
      fetchTargetDayData(targetDate);
    }
  }, [isOpen, targetDate, fetchTargetDayData]);

  const activeLessonDateSet = useMemo(() => new Set(rawDates), [rawDates]);

  const calendarDays = useMemo(() => {
    const firstDow = new Date(calYear, calMonth - 1, 1).getDay();
    const lastDate = new Date(calYear, calMonth, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDow; i++) days.push(null);
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

  if (!isOpen || !sourceInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#FAFAF7] p-5 shadow-2xl border border-[#1C2B33]/15 max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-[#1C2B33]/10 pb-3">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-[#1F6F63] uppercase">레슨 일정 교환</span>
            <h2 className="text-base font-bold text-[#1C2B33] sm:text-lg">
              변경할 대상 선택
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-sm text-[#1C2B33]/50 hover:bg-[#1C2B33]/5 hover:text-[#1C2B33]"
          >
            ✕
          </button>
        </div>

        {/* 원본 정보 카드 */}
        <div className="mt-3 rounded-2xl bg-[#1C2B33]/5 p-3 flex items-center justify-between">
          <div className="text-xs">
            <span className="text-[#1C2B33]/60">선택한 수강생: </span>
            <span className="font-bold text-[#1C2B33]">{sourceInfo.memberName}</span>
          </div>
          <div className="font-[family-name:var(--font-mono-club)] text-xs font-semibold text-[#1C2B33]/80">
            {sourceInfo.lessonDate} ({dowLabel(sourceInfo.lessonDate)}) {sourceInfo.timeStr}
          </div>
        </div>

        {/* 바디 (스크롤 가능) */}
        <div className="mt-3 overflow-y-auto space-y-4 pr-1">
          {/* 1. 캘린더 미니 뷰 */}
          <div className="rounded-2xl border border-[#1C2B33]/10 bg-white p-3 shadow-xs">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCalMonth((prev) => (prev === 1 ? (setCalYear((y) => y - 1), 12) : prev - 1))}
                className="grid h-6 w-6 place-items-center rounded-full border border-[#1C2B33]/15 text-xs text-[#1C2B33]/70 hover:bg-[#1C2B33]/5"
              >
                ◀
              </button>
              <span className="text-xs font-bold text-[#1C2B33]">
                {calYear}년 {calMonth}월
              </span>
              <button
                type="button"
                onClick={() => setCalMonth((prev) => (prev === 12 ? (setCalYear((y) => y + 1), 1) : prev + 1))}
                className="grid h-6 w-6 place-items-center rounded-full border border-[#1C2B33]/15 text-xs text-[#1C2B33]/70 hover:bg-[#1C2B33]/5"
              >
                ▶
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-[family-name:var(--font-mono-club)]">
              {['일', '월', '화', '수', '목', '금', '토'].map((dow, idx) => (
                <div
                  key={dow}
                  className={
                    'py-0.5 font-semibold ' +
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
                if (!item) return <div key={`empty-${idx}`} className="h-6" />;
                const isSelected = targetDate === item.dateStr;
                const isLesson = item.isLesson;

                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    disabled={!isLesson}
                    onClick={() => setTargetDate(item.dateStr)}
                    className={
                      'relative h-6 rounded-md text-[11px] font-medium transition-all ' +
                      (isSelected
                        ? 'bg-[#1C2B33] text-white font-bold shadow-xs'
                        : isLesson
                        ? 'bg-[#1C2B33]/10 text-[#1C2B33] font-semibold hover:bg-[#1C2B33]/20'
                        : 'text-[#1C2B33]/25 cursor-not-allowed')
                    }
                  >
                    {item.dayNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 대상 날짜의 시간대 및 수강생 목록 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-[#1C2B33]">
                {targetDate ? `${targetDate} (${dowLabel(targetDate)}) 시간대 선택` : '날짜를 선택하세요'}
              </span>
              <span className="text-[10px] text-[#1C2B33]/50">변경 또는 빈자리 클릭</span>
            </div>

            {loadingSlots ? (
              <div className="py-8 text-center text-xs text-[#1C2B33]/40 animate-pulse">
                시간표 불러오는 중...
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {targetSlots.map((slot) => {
                  const timeStr = (slot.start_time || '').slice(0, 5);
                  const assigned = slot.assigned || [];
                  const emptyCount = Math.max(0, (slot.capacity || 2) - assigned.length);

                  return (
                    <div
                      key={slot.id}
                      className="flex items-center gap-2 rounded-xl border border-[#1C2B33]/10 bg-white p-2 text-xs shadow-2xs"
                    >
                      <span className="w-12 font-[family-name:var(--font-mono-club)] font-bold text-[#1C2B33] text-right">
                        {timeStr}
                      </span>
                      <div className="flex flex-1 flex-wrap items-center gap-1.5">
                        {/* 배정된 수강생들 */}
                        {assigned.map((a) => {
                          const isSelf =
                            sourceInfo.lessonDate === targetDate &&
                            sourceInfo.timeSlotId === slot.id &&
                            sourceInfo.memberId === a.memberId;

                          return (
                            <button
                              key={a.lessonId}
                              type="button"
                              disabled={isSelf}
                              onClick={() => {
                                onSelectTarget({
                                  lessonDate: targetDate!,
                                  timeSlotId: slot.id,
                                  timeStr,
                                  memberId: a.memberId,
                                  memberName: a.name,
                                });
                              }}
                              className={
                                'inline-flex h-7 items-center rounded-full border px-2.5 font-medium transition-all ' +
                                (isSelf
                                  ? 'border-[#1C2B33]/10 bg-[#1C2B33]/5 text-[#1C2B33]/30 cursor-not-allowed'
                                  : 'border-[#1C2B33]/15 bg-[#FAFAF7] text-[#1C2B33] hover:border-[#1F6F63] hover:bg-[#E8F3EE] hover:text-[#1F6F63] active:scale-95')
                              }
                            >
                              {a.name} {isSelf && '(본인)'}
                            </button>
                          );
                        })}

                        {/* 빈자리 슬롯 */}
                        {Array.from({ length: emptyCount }).map((_, idx) => (
                          <button
                            key={`empty-${slot.id}-${idx}`}
                            type="button"
                            onClick={() => {
                              onSelectTarget({
                                lessonDate: targetDate!,
                                timeSlotId: slot.id,
                                timeStr,
                                memberName: '빈자리',
                              });
                            }}
                            className="inline-flex h-7 items-center rounded-full border border-dashed border-[#1C2B33]/25 bg-[#FAFAF7]/50 px-2.5 text-xs text-[#1C2B33]/60 transition-all hover:border-[#1F6F63] hover:bg-[#E8F3EE] hover:text-[#1F6F63] active:scale-95"
                          >
                            + 빈자리
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}