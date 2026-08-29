'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import AdminDrawer from '@/components/AdminDrawer';

type Member = {
  id: number;
  name: string;
  department: string | null;
  phone: string | null;
  alreadyAssignedToday?: boolean;
};

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

type DragItem = {
  lessonId: number | string;
  sourceSlotId: number;
  memberName: string;
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

function displayPhone(phoneStr: string | null | undefined): string {
  if (!phoneStr) return '-';
  const clean = phoneStr.replace(/[^0-9]/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  return phoneStr;
}

export default function AdminAssignPage() {
  const [rawDates, setRawDates] = useState<string[]>([]);
  const [showPast, setShowPast] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [showDetailInfo, setShowDetailInfo] = useState(false);

  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [originalSlots, setOriginalSlots] = useState<Slot[]>([]);
  const [eligibleMembers, setEligibleMembers] = useState<Member[]>([]);
  const [showAllOverride, setShowAllOverride] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toastMessage, setToastMessage] = useState('');

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

  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<number | null>(null);

  const [copyPanelOpen, setCopyPanelOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);

  const isDirty = useMemo(() => {
    return JSON.stringify(slots) !== JSON.stringify(originalSlots);
  }, [slots, originalSlots]);

  const [showSaveBar, setShowSaveBar] = useState(false);

  useEffect(() => {
    if (!isDirty) {
      setShowSaveBar(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowSaveBar(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isDirty, slots]);

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

  const confirmSwitchDate = (newDate: string) => {
    if (isDirty) {
      if (!confirm('저장하지 않은 변경사항이 있습니다. 취소하고 이동하시겠습니까?')) {
        return;
      }
    }
    setSelectedDate(newDate);
    const [y, m] = newDate.split('-').map(Number);
    setCalYear(y);
    setCalMonth(m);
  };

  const handlePrevLesson = () => {
    if (currentLessonIndex > 0) {
      confirmSwitchDate(navigableLessonDates[currentLessonIndex - 1]);
    } else if (currentLessonIndex === -1 && selectedDate) {
      const prev = [...navigableLessonDates].reverse().find((d) => d < selectedDate);
      if (prev) confirmSwitchDate(prev);
    }
  };

  const handleNextLesson = () => {
    if (currentLessonIndex >= 0 && currentLessonIndex < navigableLessonDates.length - 1) {
      confirmSwitchDate(navigableLessonDates[currentLessonIndex + 1]);
    } else if (currentLessonIndex === -1 && selectedDate) {
      const next = navigableLessonDates.find((d) => d > selectedDate);
      if (next) confirmSwitchDate(next);
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
      setOriginalSlots([]);
      setEligibleMembers([]);
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
      setOriginalSlots(data.slots ?? []);
      setEligibleMembers(data.eligibleMembers ?? []);
    } catch {
      showToast('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssign = (slotId: number, memberIdStr: string) => {
    if (!memberIdStr || !selectedDate) return;
    const memberId = Number(memberIdStr);
    const targetMember = eligibleMembers.find((m) => m.id === memberId);
    if (!targetMember) return;

    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slotId) return s;
        return {
          ...s,
          assigned: [
            ...s.assigned,
            {
              lessonId: `temp-${Date.now()}-${Math.random()}`,
              memberId: targetMember.id,
              name: targetMember.name,
              department: targetMember.department,
              phone: targetMember.phone,
              isCompleted: false,
            },
          ],
        };
      })
    );
  };

  const handleRemove = (lessonId: number | string) => {
    setSlots((prev) =>
      prev.map((s) => ({
        ...s,
        assigned: s.assigned.filter((a) => a.lessonId !== lessonId),
      }))
    );
  };

  const handleToggleCompleted = (lessonId: number | string) => {
    setSlots((prev) =>
      prev.map((s) => ({
        ...s,
        assigned: s.assigned.map((a) =>
          a.lessonId === lessonId ? { ...a, isCompleted: !a.isCompleted } : a
        ),
      }))
    );
  };

  const handleDropToSlot = (targetSlotId: number) => {
    setDragOverSlotId(null);
    if (!draggedItem) return;

    if (draggedItem.sourceSlotId === targetSlotId) {
      setDraggedItem(null);
      return;
    }

    const targetSlot = slots.find((s) => s.id === targetSlotId);
    if (targetSlot && targetSlot.assigned.length >= targetSlot.capacity) {
      showToast('해당 시간대는 이미 정원 마감되었습니다.');
      setDraggedItem(null);
      return;
    }

    const movedLessonId = draggedItem.lessonId;
    const movingItem = slots
      .flatMap((s) => s.assigned)
      .find((a) => a.lessonId === movedLessonId);

    if (!movingItem) return;

    setSlots((prev) =>
      prev.map((s) => {
        if (s.id === draggedItem.sourceSlotId) {
          return { ...s, assigned: s.assigned.filter((a) => a.lessonId !== movedLessonId) };
        }
        if (s.id === targetSlotId) {
          return { ...s, assigned: [...s.assigned, movingItem] };
        }
        return s;
      })
    );
    setDraggedItem(null);
  };

  const handleResetDay = () => {
    if (!confirm('이 날짜의 모든 배정을 화면에서 비우시겠습니까?\n(하단 저장을 눌러야 최종 반영됩니다)')) return;
    setSlots((prev) => prev.map((s) => ({ ...s, assigned: [] })));
  };

  const handleRevert = () => {
    setSlots(originalSlots);
    setShowSaveBar(false);
    showToast('원래대로 되돌렸습니다.');
  };

  const handleSaveChanges = async () => {
    if (!selectedDate || saving) return;
    setSaving(true);
    try {
      const assignments = slots.flatMap((slot) =>
        slot.assigned.map((a) => ({
          timeSlotId: slot.id,
          memberId: a.memberId,
          isCompleted: !!a.isCompleted,
        }))
      );

      const res = await fetch('/api/admin/lessons/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonDate: selectedDate,
          assignments,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '저장 실패');
        return;
      }

      setOriginalSlots(slots);
      setShowSaveBar(false);
      showToast('저장되었습니다.');
    } catch {
      showToast('저장 중 네트워크 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const assignedMemberIds = useMemo(() => {
    return new Set(slots.flatMap((s) => s.assigned.map((a) => a.memberId)));
  }, [slots]);

  const validCopyDates = useMemo(() => {
    return rawDates
      .filter((d) => d.slice(0, 7) >= currentYm && d !== selectedDate)
      .sort();
  }, [rawDates, currentYm, selectedDate]);

  const toggleCopyTarget = (date: string) => {
    setCopyTargets((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const runCopy = async () => {
    if (!selectedDate || copyTargets.size === 0) return;
    if (isDirty) {
      alert('현재 날짜의 수정사항을 먼저 [저장]한 후 복사해주세요.');
      return;
    }
    setCopying(true);
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
        showToast(data.error || '복사 실패');
        return;
      }
      showToast('선택한 날짜에 성공적으로 복사되었습니다.');
      setCopyTargets(new Set());
      setCopyPanelOpen(false);
    } catch {
      showToast('네트워크 오류');
    } finally {
      setCopying(false);
    }
  };

  const hasAnyAssignment = slots.some((s) => s.assigned.length > 0);

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-24 text-[#1C2B33]">
      <header className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] px-5 pt-8 pb-6 sm:px-8">
        <div className="flex items-center gap-3">
          <AdminDrawer />
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
            레슨 시간표
          </h1>
        </div>

        {/* 날짜 선택 네비게이션 영역 (높이 및 폰트 통일) */}
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
                      confirmSwitchDate(item.dateStr);
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

        {selectedDate && hasAnyAssignment && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCopyPanelOpen((v) => !v)}
                className="rounded-full border border-[#1C2B33]/15 bg-white px-4 py-1.5 text-sm font-medium text-[#1C2B33]/70 hover:bg-[#1C2B33]/5"
              >
                {copyPanelOpen ? '복사 닫기' : '날짜복사'}
              </button>

              <button
                type="button"
                onClick={handleResetDay}
                className="rounded-full border border-[#B5482F]/30 bg-white px-4 py-1.5 text-sm font-medium text-[#B5482F] hover:bg-[#B5482F]/10"
              >
                비우기
              </button>

              <button
                type="button"
                onClick={() => setShowDetailInfo((prev) => !prev)}
                className={
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors ' +
                  (showDetailInfo
                    ? 'bg-[#1C2B33] text-white shadow-sm'
                    : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
                }
              >
                정보
              </button>
            </div>

            {copyPanelOpen && (
              <div className="mt-3 max-w-md rounded-2xl border border-[#1C2B33]/10 bg-white p-4">
                <p className="mb-2 text-sm text-[#1C2B33]/60">
                  {selectedDate}의 배정을 복사할 레슨일을 선택하세요 (이번 달 및 이후).
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {validCopyDates.map((d) => (
                    <label key={d} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={copyTargets.has(d)}
                        onChange={() => toggleCopyTarget(d)}
                      />
                      {d} ({dowLabel(d)})
                    </label>
                  ))}
                  {validCopyDates.length === 0 && (
                    <p className="text-sm text-[#1C2B33]/40">복사 가능한 레슨일이 없습니다.</p>
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
              </div>
            )}
          </div>
        )}
      </header>

      <main className="px-5 py-6 sm:px-8">
        <div className="relative max-w-2xl">
          <div className="absolute top-2 bottom-2 left-[52px] w-px bg-[#1C2B33]/10 sm:left-[68px]" />

          <div className="space-y-3">
            {slots.map((slot) => {
              const showAll = !!showAllOverride[slot.id];
              const options = eligibleMembers.filter(
                (m) => showAll || !assignedMemberIds.has(m.id)
              );
              const isFull = slot.assigned.length >= slot.capacity;
              const emptySlotsCount = Math.max(0, slot.capacity - slot.assigned.length);
              const startH = slot.start_time.slice(0, 5);
              const isDragOver = dragOverSlotId === slot.id;

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

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverSlotId !== slot.id) {
                        setDragOverSlotId(slot.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverSlotId === slot.id) {
                        setDragOverSlotId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropToSlot(slot.id);
                    }}
                    className={
                      'flex-1 rounded-2xl border p-3 transition-all ' +
                      (isDragOver
                        ? 'border-dashed border-[#1F6F63] bg-[#1F6F63]/5 ring-2 ring-[#1F6F63]/20 shadow-md'
                        : 'border-[#1C2B33]/10 bg-white shadow-[0_1px_2px_rgba(28,43,51,0.04)]')
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {slot.assigned.map((a) => {
                        const isThisDragging = draggedItem?.lessonId === a.lessonId;
                        const isCompleted = !!a.isCompleted;

                        return (
                          <span
                            key={a.lessonId}
                            draggable
                            onDragStart={(e) => {
                              setDraggedItem({
                                lessonId: a.lessonId,
                                sourceSlotId: slot.id,
                                memberName: a.name,
                              });
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDragOverSlotId(null);
                            }}
                            className={
                              'group inline-flex h-[34px] cursor-grab items-center justify-between gap-1.5 rounded-full border px-3 text-sm transition-all select-none active:cursor-grabbing ' +
                              (isThisDragging
                                ? 'opacity-30 scale-95 bg-[#1C2B33]/10 border-transparent'
                                : isCompleted
                                ? 'bg-[#E8F3EE] text-[#1F6F63] border-[#1F6F63]/30'
                                : 'bg-[#FAFAF7] text-[#1C2B33] border-[#1C2B33]/10 hover:bg-[#1C2B33]/5')
                            }
                            title="클릭: 완료/출석 토글 / 마우스 드래그: 시간대 이동"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleCompleted(a.lessonId);
                              }}
                              className={
                                'cursor-pointer truncate font-medium text-sm transition-colors ' +
                                (isCompleted ? 'line-through text-[#1F6F63]' : 'text-[#1C2B33]')
                              }
                            >
                              {a.name}
                            </button>

                            {showDetailInfo && (
                              <span
                                className={
                                  'text-xs ' +
                                  (isCompleted ? 'text-[#1F6F63]/60' : 'text-[#1C2B33]/40')
                                }
                              >
                                {a.department ?? '-'} {displayPhone(a.phone)}
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemove(a.lessonId);
                              }}
                              className="grid h-4 w-4 place-items-center rounded-full text-xs text-[#B5482F]/60 hover:bg-[#B5482F]/10 hover:text-[#B5482F]"
                              aria-label="배정 즉시 삭제"
                              title="배정 즉시 삭제"
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}

                      {Array.from({ length: emptySlotsCount }).map((_, idx) => (
                        <div key={`empty-slot-${slot.id}-${idx}`} className="relative inline-block">
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssign(slot.id, e.target.value);
                              }
                            }}
                            className="h-[34px] w-[76px] cursor-pointer appearance-none rounded-full border border-dashed border-[#1C2B33]/25 bg-[#FAFAF7]/60 pl-2.5 pr-5 text-left text-sm font-medium text-[#1C2B33]/60 transition-colors hover:border-[#1C2B33]/50 hover:bg-[#FAFAF7] hover:text-[#1C2B33] focus:border-[#1C2B33] focus:outline-none"
                          >
                            <option value="" disabled hidden>
                              이름
                            </option>
                            {options.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} {assignedMemberIds.has(m.id) ? '(중복)' : ''}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[#1C2B33]/40">
                            ▼
                          </div>
                        </div>
                      ))}

                      {!isFull && (
                        <button
                          type="button"
                          onClick={() =>
                            setShowAllOverride((prev) => ({ ...prev, [slot.id]: !showAll }))
                          }
                          className={
                            'h-[34px] rounded-full px-2.5 text-xs font-medium transition-colors ' +
                            (showAll
                              ? 'bg-[#C98A2B] text-white'
                              : 'bg-[#1C2B33]/5 text-[#1C2B33]/45 hover:bg-[#1C2B33]/10')
                          }
                          title="당일 중복 배정 수강생 포함 토글"
                        >
                          중복
                        </button>
                      )}
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

      {showSaveBar && isDirty && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#1C2B33] px-5 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="text-xs text-white/70">수정된 내용이 있습니다</span>
          <button
            type="button"
            onClick={handleRevert}
            className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
          >
            ↺ 되돌리기
          </button>
          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={saving}
            className="rounded-full bg-[#1F6F63] px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-[#1F6F63]/90 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      )}

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