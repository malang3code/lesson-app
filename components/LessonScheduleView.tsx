'use client';

import { ReactNode, RefObject, useMemo, useState } from 'react';

export type LessonDay = 'TUE' | 'THU' | 'BOTH';

export type AssignedItem = {
  lessonId: number | string;
  memberId: number;
  name: string;
  department: string | null;
  phone: string | null;
  lesson_day?: LessonDay;
  isCompleted?: boolean;
};

export type Slot = {
  id: number;
  start_time: string;
  end_time: string;
  capacity: number;
  assigned?: AssignedItem[];
};

export type Member = {
  id: number;
  name: string;
  department: string | null;
  phone: string | null;
  lesson_day?: LessonDay;
};

export type SwapHistoryItem = {
  id: number;
  source_date: string;
  source_time: string;
  source_member_name: string;
  target_date: string;
  target_time: string;
  target_member_name: string;
  created_at: string;
};

function dowLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return ['일', '월', '화', '수', '목', '금', '토'][dow];
}

function displayPhone(phoneStr: string | null | undefined): string {
  if (!phoneStr || !phoneStr.trim()) return '010-0000-0000';
  const clean = phoneStr.replace(/[^0-9]/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  return phoneStr;
}

function formatCreatedAt(utcDateStr: string): string {
  try {
    const d = new Date(utcDateStr);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  } catch {
    return '';
  }
}

interface LessonScheduleViewProps {
  mode: 'admin' | 'viewer';
  drawer: ReactNode;
  selectedDate: string | null;
  slots: Slot[];
  loading: boolean;
  capturing: boolean;
  toastMessage: string;
  captureRef: RefObject<HTMLDivElement | null>;
  onShareImage: () => void;
  // 네비게이션 & 캘린더
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  calendarOpen: boolean;
  onToggleCalendar: () => void;
  calYear: number;
  calMonth: number;
  calendarDays: ({ dateStr: string; dayNum: number; isLesson: boolean; isBeforeCurrentMonth: boolean } | null)[];
  showPast: boolean;
  onToggleShowPast: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (d: string) => void;
  currentCalYm: string;
  currentYm: string;
  // 변경(스왑) 모드
  swapModeActive?: boolean;
  onToggleSwapMode?: () => void;
  onInitiateSwap?: (slot: Slot, item: AssignedItem) => void;
  swapHistories?: SwapHistoryItem[];
  onRevertSwapHistory?: (historyId: number) => void;
  // 정보 토글 (관리자 전용)
  showDetailInfo?: boolean;
  onToggleDetailInfo?: () => void;
  // 초기 배정 및 수동 관리 (관리자 전용)
  eligibleMembers?: Member[];
  showAllOverride?: Record<number, boolean>;
  onToggleOverride?: (slotId: number) => void;
  onAssign?: (slotId: number, memberId: string) => void;
  onRemove?: (lessonId: number | string) => void;
  onToggleCompleted?: (lessonId: number | string) => void;
  // 🎯 네이티브 드래그 앤 드롭
  onMoveMemberToSlot?: (lessonId: number | string, srcSlotId: number, destSlotId: number) => void;
  // 관리자 도구
  copyPanelOpen?: boolean;
  onToggleCopyPanel?: () => void;
  copyTargets?: Set<string>;
  onToggleCopyTarget?: (d: string) => void;
  validCopyDates?: string[];
  copying?: boolean;
  onRunCopy?: () => void;
  onResetDay?: () => void;
  // 하단 저장 바 & 초과 경고
  isDirty?: boolean;
  saving?: boolean;
  hasOverCapacity?: boolean;
  overCapacityCount?: number;
  showSaveBar?: boolean;
  onRevert?: () => void;
  onSaveChanges?: () => void;
  onCloseToast?: () => void;
}

export default function LessonScheduleView(props: LessonScheduleViewProps) {
  const isAdmin = props.mode === 'admin';
  const hasAssignments = props.slots.some((s) => (s.assigned || []).length > 0);
  const [dragOverSlotId, setDragOverSlotId] = useState<number | null>(null);

  const [y, m, d] = props.selectedDate ? props.selectedDate.split('-').map(Number) : [0, 0, 0];
  const currentSelectedDow = props.selectedDate ? new Date(y, m - 1, d).getDay() : null;

  const assignedMemberIds = new Set(
    props.slots.flatMap((s) => (s.assigned || []).map((a) => a.memberId))
  );

  const { completedCount, totalAssignedCount } = useMemo(() => {
    let completed = 0;
    let total = 0;
    props.slots.forEach((s) => {
      (s.assigned || []).forEach((a) => {
        total += 1;
        if (a.isCompleted) completed += 1;
      });
    });
    return { completedCount: completed, totalAssignedCount: total };
  }, [props.slots]);

  return (
    <div className="min-h-dvh bg-[#FAFAF7] pb-24 text-[#1C2B33] overscroll-y-none">
      {/* 🎯 상단 헤더 */}
      <header className="px-4 pt-4 pb-1 sm:px-6 max-w-[580px]">
        <div className="flex items-center gap-3">
          {props.drawer}
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[#1C2B33] sm:text-2xl">
            레슨 시간표
          </h1>

          <button
            type="button"
            onClick={props.onShareImage}
            disabled={props.capturing || !props.selectedDate || props.slots.length === 0}
            className="flex h-7 items-center gap-1.5 rounded-full border border-[#1C2B33]/15 bg-white px-2.5 text-xs font-semibold text-[#1C2B33] shadow-2xs transition-all active:scale-95 hover:bg-[#1C2B33]/5 disabled:opacity-40"
          >
            <span className="text-xs">📷</span>
            <span>{props.capturing ? '생성 중...' : '이미지 공유'}</span>
          </button>
        </div>

        {/* 컨트롤 버튼 바 */}
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            type="button"
            onClick={props.onPrev}
            disabled={!props.canPrev}
            className="flex h-7 shrink-0 items-center gap-0.5 rounded-full border border-[#1C2B33]/15 bg-white px-2.5 text-xs font-semibold text-[#1C2B33]/80 transition-colors hover:bg-[#1C2B33]/5 disabled:opacity-30"
          >
            ◀ 이전
          </button>

          <button
            type="button"
            onClick={props.onToggleCalendar}
            className={
              'flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold transition-colors ' +
              (props.calendarOpen
                ? 'bg-[#1C2B33] text-white shadow-2xs'
                : 'border border-[#1C2B33]/20 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
            }
          >
            {props.calendarOpen ? '✕ 닫기' : '📅 캘린더'}
          </button>

          <button
            type="button"
            onClick={props.onNext}
            disabled={!props.canNext}
            className="flex h-7 shrink-0 items-center gap-0.5 rounded-full border border-[#1C2B33]/15 bg-white px-2.5 text-xs font-semibold text-[#1C2B33]/80 transition-colors hover:bg-[#1C2B33]/5 disabled:opacity-30"
          >
            다음 ▶
          </button>

          {isAdmin && props.selectedDate && hasAssignments && (
            <>
              <button
                type="button"
                onClick={props.onToggleCopyPanel}
                className={
                  'flex h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium transition-colors ' +
                  (props.copyPanelOpen
                    ? 'border-[#1C2B33] bg-[#1C2B33] text-white'
                    : 'border-[#1C2B33]/15 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
                }
              >
                날짜복사
              </button>

              <button
                type="button"
                onClick={props.onResetDay}
                className="flex h-7 shrink-0 items-center rounded-full border border-[#B5482F]/30 bg-white px-2.5 text-xs font-medium text-[#B5482F] transition-colors hover:bg-[#B5482F]/10"
              >
                비우기
              </button>

              <button
                type="button"
                onClick={props.onToggleDetailInfo}
                className={
                  'flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-medium transition-colors ' +
                  (props.showDetailInfo
                    ? 'bg-[#1C2B33] text-white shadow-2xs'
                    : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
                }
              >
                정보
              </button>
            </>
          )}
        </div>

        {/* 캘린더 드롭다운 */}
        {props.calendarOpen && (
          <div className="mt-2.5 max-w-sm rounded-2xl border border-[#1C2B33]/10 bg-white p-4 shadow-[0_4px_12px_rgba(28,43,51,0.08)] animate-in fade-in zoom-in-95 duration-150">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={props.onPrevMonth}
                disabled={!props.showPast && props.currentCalYm <= props.currentYm}
                className="grid h-7 w-7 place-items-center rounded-full border border-[#1C2B33]/15 text-xs text-[#1C2B33]/70 disabled:opacity-20 hover:bg-[#1C2B33]/5"
              >
                ◀
              </button>
              <span className="font-[family-name:var(--font-display)] text-base font-semibold">
                {props.calYear}년 {props.calMonth}월
              </span>
              <button
                type="button"
                onClick={props.onNextMonth}
                className="grid h-7 w-7 place-items-center rounded-full border border-[#1C2B33]/15 text-xs text-[#1C2B33]/70 hover:bg-[#1C2B33]/5"
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

              {props.calendarDays.map((item, idx) => {
                if (!item) return <div key={`empty-${idx}`} className="h-8" />;
                const isSelected = props.selectedDate === item.dateStr;
                const isDimmed = !props.showPast && item.isBeforeCurrentMonth;

                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    onClick={() => props.onSelectDate(item.dateStr)}
                    disabled={isDimmed}
                    className={
                      'relative h-8 rounded-lg text-xs font-medium transition-all ' +
                      (isSelected
                        ? 'bg-[#1C2B33] text-white shadow-xs font-bold'
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

            <div className="mt-3 border-t border-[#1C2B33]/10 pt-2.5 text-center">
              <button
                type="button"
                onClick={props.onToggleShowPast}
                className="text-xs text-[#1C2B33]/60 underline underline-offset-2 hover:text-[#1C2B33]"
              >
                {props.showPast ? '✓ 이전 달 포함됨' : '이전 달(과거) 레슨일 조회'}
              </button>
            </div>
          </div>
        )}

        {/* 날짜 복사 모달 */}
        {isAdmin && props.selectedDate && hasAssignments && props.copyPanelOpen && (
          <div className="mt-2.5 max-w-sm rounded-2xl border border-[#1C2B33]/10 bg-white p-3.5 shadow-sm animate-in fade-in duration-150">
            <p className="mb-2 text-xs text-[#1C2B33]/60">
              {props.selectedDate}의 배정을 복사할 레슨일을 선택하세요.
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {(props.validCopyDates || []).map((d) => (
                <label key={d} className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={props.copyTargets?.has(d)}
                    onChange={() => props.onToggleCopyTarget?.(d)}
                  />
                  {d} ({dowLabel(d)})
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={props.onRunCopy}
              disabled={(props.copyTargets?.size ?? 0) === 0 || props.copying}
              className="mt-3 rounded-full bg-[#1C2B33] px-3.5 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              {props.copying ? '복사 중...' : `선택한 날짜에 복사 (${props.copyTargets?.size ?? 0})`}
            </button>
          </div>
        )}
      </header>

      {/* 🎯 본문 시간표 영역 */}
      <main className="px-4 pt-1.5 pb-4 sm:px-6 w-full max-w-[580px]">
        <div ref={props.captureRef} className="relative w-full bg-[#FAFAF7] p-2 sm:p-3 rounded-2xl">
          {/* 날짜 헤더 & 출석 현황 & [🔄 변경] 버튼 */}
          {props.selectedDate && (
            <div className="mb-3 pb-2 border-b-2 border-[#1C2B33]/15 flex items-center justify-between">
              <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                <span className="font-[family-name:var(--font-display)] text-lg font-bold text-[#1C2B33] sm:text-xl">
                  {props.selectedDate} ({dowLabel(props.selectedDate)})
                </span>
                <span className="text-xs font-semibold text-[#1C2B33]/60">
                  레슨 시간표
                  {totalAssignedCount > 0 && (
                    <span className="ml-1 text-[#1F6F63] font-bold font-[family-name:var(--font-mono-club)]">
                      ({completedCount}/{totalAssignedCount})
                    </span>
                  )}
                </span>
              </div>

              <button
                type="button"
                onClick={props.onToggleSwapMode}
                className={
                  'flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-all ' +
                  (props.swapModeActive
                    ? 'bg-[#1F6F63] text-white shadow-2xs ring-2 ring-[#1F6F63]/30'
                    : 'border border-[#1C2B33]/20 bg-white text-[#1C2B33]/80 hover:bg-[#1C2B33]/5')
                }
              >
                <span>🔄</span>
                <span>{props.swapModeActive ? '변경 취소' : '변경'}</span>
              </button>
            </div>
          )}

          {/* 변경 모드 안내 배너 */}
          {props.swapModeActive && (
            <div className="mb-3 rounded-xl bg-[#E8F3EE] p-2 text-xs font-medium text-[#1F6F63] animate-in fade-in duration-150">
              💡 변경할 수강생 이름을 클릭하면 다른 날짜/시간대 선택 창이 열립니다.
            </div>
          )}

          <div className="relative">
            <div className="absolute top-3.5 bottom-3.5 left-[52px] w-px bg-[#1C2B33]/10 sm:left-[60px]" />

            <div className="space-y-2">
              {props.loading ? (
                <div className="py-12 text-center text-sm font-medium text-[#1C2B33]/40 animate-pulse">
                  시간표 불러오는 중...
                </div>
              ) : (
                props.slots.map((slot) => {
                  const assignedList = slot.assigned || [];
                  const capacity = slot.capacity || 2;
                  const isExceptionActive = !!props.showAllOverride?.[slot.id];

                  const options = (props.eligibleMembers || []).filter((m) => {
                    if (isExceptionActive) return true;
                    if (assignedMemberIds.has(m.id)) return false;
                    const memberDay = m.lesson_day || 'TUE';
                    if (memberDay === 'BOTH') return true;
                    if (currentSelectedDow === 2) return memberDay === 'TUE';
                    if (currentSelectedDow === 4) return memberDay === 'THU';
                    return true;
                  });

                  const isOver = assignedList.length > capacity;
                  const isFull = assignedList.length >= capacity;
                  const emptySlotsCount = Math.max(0, capacity - assignedList.length);
                  const startH = (slot.start_time || '').slice(0, 5);
                  const isDragOver = dragOverSlotId === slot.id;

                  return (
                    <div key={slot.id} className="relative flex items-center gap-2.5 sm:gap-3.5">
                      <div className="w-[52px] shrink-0 text-right sm:w-[60px]">
                        <span className="font-[family-name:var(--font-mono-club)] text-base font-bold sm:text-lg whitespace-nowrap">
                          {startH}
                        </span>
                      </div>

                      <div
                        className={
                          'z-10 h-3 w-3 shrink-0 rounded-full border-2 border-[#FAFAF7] ' +
                          (isOver
                            ? 'bg-[#B5482F] animate-pulse'
                            : isFull
                            ? 'bg-[#1F6F63]'
                            : 'bg-[#C98A2B]')
                        }
                        style={{ marginLeft: '-6px' }}
                      />

                      {/* 🎯 슬롯 카드 컨테이너 (정밀 드롭 & 시각 피드백) */}
                      <div
                        data-slot-id={slot.id}
                        onDragOver={
                          isAdmin && !props.swapModeActive
                            ? (e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (dragOverSlotId !== slot.id) {
                                  setDragOverSlotId(slot.id);
                                }
                              }
                            : undefined
                        }
                        onDragLeave={
                          isAdmin && !props.swapModeActive
                            ? (e) => {
                                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                  setDragOverSlotId(null);
                                }
                              }
                            : undefined
                        }
                        onDrop={
                          isAdmin && !props.swapModeActive
                            ? (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDragOverSlotId(null);
                                try {
                                  const raw = e.dataTransfer.getData('text/plain');
                                  if (raw) {
                                    const parsed = JSON.parse(raw);
                                    props.onMoveMemberToSlot?.(parsed.lessonId, parsed.sourceSlotId, slot.id);
                                  }
                                } catch (err) {
                                  console.error('Drop error:', err);
                                }
                              }
                            : undefined
                        }
                        className={
                          'relative flex-1 rounded-2xl border px-2.5 py-2 transition-all ' +
                          (isDragOver
                            ? 'border-dashed border-[#1F6F63] bg-[#1F6F63]/10 ring-2 ring-[#1F6F63]/30 shadow-sm'
                            : isOver
                            ? 'border-[#B5482F] bg-[#B5482F]/5 shadow-2xs'
                            : 'border-[#1C2B33]/10 bg-white shadow-[0_1px_2px_rgba(28,43,51,0.04)]')
                        }
                      >
                        {/* ⚠️ 예쁜 초과 경고 뱃지 */}
                        {isOver && (
                          <div className="pointer-events-none absolute -top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-[#B5482F] px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                            <span>⚠️ 초과</span>
                            <span>({assignedList.length}/{capacity})</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          {assignedList.map((a) => {
                            const isCompleted = !!a.isCompleted;
                            const memDay = a.lesson_day || 'TUE';
                            const isCrossDay =
                              memDay !== 'BOTH' &&
                              ((currentSelectedDow === 2 && memDay === 'THU') ||
                                (currentSelectedDow === 4 && memDay === 'TUE'));

                            return (
                              <div
                                key={a.lessonId}
                                draggable={isAdmin && !props.swapModeActive}
                                onDragStart={
                                  isAdmin && !props.swapModeActive
                                    ? (e) => {
                                        e.stopPropagation();
                                        e.dataTransfer.setData(
                                          'text/plain',
                                          JSON.stringify({ lessonId: a.lessonId, sourceSlotId: slot.id })
                                        );
                                        e.dataTransfer.effectAllowed = 'move';
                                      }
                                    : undefined
                                }
                                onDragEnd={
                                  isAdmin && !props.swapModeActive
                                    ? () => setDragOverSlotId(null)
                                    : undefined
                                }
                                className={
                                  'group inline-flex h-[32px] shrink-0 items-center justify-between gap-1.5 rounded-full border px-2.5 text-sm transition-all select-none ' +
                                  (isAdmin && !props.swapModeActive ? 'cursor-grab active:cursor-grabbing hover:border-[#1C2B33]/40 ' : '') +
                                  (props.swapModeActive
                                    ? 'border-[#1F6F63] bg-[#E8F3EE] text-[#1F6F63] ring-1 ring-[#1F6F63]/20 hover:scale-105'
                                    : isCompleted
                                    ? 'bg-[#E8F3EE] text-[#1F6F63] border-[#1F6F63]/30'
                                    : isOver
                                    ? 'bg-white text-[#B5482F] border-[#B5482F]/40 font-semibold'
                                    : isCrossDay
                                    ? 'bg-[#FFF8E7] text-[#C98A2B] border-[#C98A2B]/40 font-medium'
                                    : 'bg-[#FAFAF7] text-[#1C2B33] border-[#1C2B33]/10 hover:bg-[#1C2B33]/5')
                                }
                              >
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (props.swapModeActive) {
                                      props.onInitiateSwap?.(slot, a);
                                    } else {
                                      props.onToggleCompleted?.(a.lessonId);
                                    }
                                  }}
                                  className={
                                    'cursor-pointer whitespace-nowrap font-medium text-sm transition-colors ' +
                                    (props.swapModeActive
                                      ? 'text-[#1F6F63] font-bold'
                                      : isCompleted
                                      ? 'line-through text-[#1F6F63]'
                                      : isOver
                                      ? 'text-[#B5482F]'
                                      : isCrossDay
                                      ? 'text-[#A06C18]'
                                      : 'text-[#1C2B33]')
                                  }
                                  title={props.swapModeActive ? '클릭하여 일정 변경' : '클릭하여 출석 체크/취소'}
                                >
                                  {props.swapModeActive && '🔄 '}
                                  {a.name}{isCrossDay ? `(${memDay === 'TUE' ? '화' : '목'})` : ''}
                                </span>

                                {isAdmin && props.showDetailInfo && (
                                  <span className={'pointer-events-none whitespace-nowrap text-xs ' + (isCompleted ? 'text-[#1F6F63]/60' : 'text-[#1C2B33]/40')}>
                                    {displayPhone(a.phone)} {a.department ?? '-'}
                                  </span>
                                )}

                                {isAdmin && !props.swapModeActive && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); props.onRemove?.(a.lessonId); }}
                                    className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-xs text-[#B5482F]/60 hover:bg-[#B5482F]/10 hover:text-[#B5482F]"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          })}

                          {isAdmin ? (
                            Array.from({ length: emptySlotsCount }).map((_, idx) => (
                              <div key={`empty-slot-${slot.id}-${idx}`} className="relative inline-block shrink-0">
                                <select
                                  value=""
                                  onChange={(e) => e.target.value && props.onAssign?.(slot.id, e.target.value)}
                                  className="h-[32px] w-[74px] cursor-pointer appearance-none rounded-full border border-dashed border-[#1C2B33]/25 bg-[#FAFAF7]/60 pl-2.5 pr-4 text-left text-xs font-medium text-[#1C2B33]/60 transition-colors hover:border-[#1C2B33]/50 hover:bg-[#FAFAF7] hover:text-[#1C2B33] focus:border-[#1C2B33] focus:outline-none"
                                >
                                  <option value="" disabled hidden>이름</option>
                                  {options.map((m) => {
                                    const isDup = assignedMemberIds.has(m.id);
                                    const memDay = m.lesson_day || 'TUE';
                                    const isOtherDay =
                                      memDay !== 'BOTH' &&
                                      ((currentSelectedDow === 2 && memDay === 'THU') ||
                                        (currentSelectedDow === 4 && memDay === 'TUE'));
                                    let suffix = isDup ? '(중복)' : isOtherDay ? `(${memDay === 'TUE' ? '화' : '목'})` : '';
                                    return (
                                      <option key={m.id} value={m.id}>
                                        {m.name} {suffix}
                                      </option>
                                    );
                                  })}
                                </select>
                                <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-[#1C2B33]/40">
                                  ▼
                                </div>
                              </div>
                            ))
                          ) : (
                            Array.from({ length: emptySlotsCount }).map((_, idx) => (
                              <span
                                key={`empty-${slot.id}-${idx}`}
                                className="inline-flex h-[32px] items-center rounded-full border border-dashed border-[#1C2B33]/20 bg-[#FAFAF7]/40 px-3 text-xs font-normal text-[#1C2B33]/40"
                              >
                                빈자리
                              </span>
                            ))
                          )}

                          {isAdmin && !isFull && (
                            <button
                              type="button"
                              onClick={() => props.onToggleOverride?.(slot.id)}
                              className={
                                'h-[32px] shrink-0 rounded-full px-2 text-xs font-semibold transition-colors ' +
                                (isExceptionActive
                                  ? 'bg-[#C98A2B] text-white shadow-2xs'
                                  : 'bg-[#1C2B33]/5 text-[#1C2B33]/45 hover:bg-[#1C2B33]/10')
                              }
                            >
                              예외
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 🎯 하단 변경 내역(히스토리) */}
          {props.swapHistories && props.swapHistories.length > 0 && props.selectedDate && (
            <div className="mt-3.5 rounded-2xl border border-[#1C2B33]/10 bg-white p-2.5 shadow-2xs">
              <div className="mb-1.5 flex items-center justify-between border-b border-[#1C2B33]/10 pb-1">
                <span className="font-[family-name:var(--font-display)] text-[11px] font-bold text-[#1C2B33]">
                  📋 {props.selectedDate} 레슨 변경 이력
                </span>
              </div>
              <div className="space-y-1">
                {props.swapHistories.map((h) => {
                  const isSourceCurrent = h.source_date === props.selectedDate;
                  const leftDate = isSourceCurrent ? h.source_date : h.target_date;
                  const leftTime = isSourceCurrent ? h.source_time : h.target_time;
                  const leftName = isSourceCurrent ? h.source_member_name : h.target_member_name;

                  const rightDate = isSourceCurrent ? h.target_date : h.source_date;
                  const rightTime = isSourceCurrent ? h.target_time : h.source_time;
                  const rightName = isSourceCurrent ? h.target_member_name : h.source_member_name;

                  const eventTimeStr = formatCreatedAt(h.created_at);

                  return (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-1.5 rounded-lg bg-[#FAFAF7] px-2 py-1 text-[11px] text-[#1C2B33] border border-[#1C2B33]/5"
                    >
                      <div className="flex items-center gap-1 font-medium text-[11px] overflow-x-auto no-scrollbar whitespace-nowrap min-w-0 pr-1">
                        {eventTimeStr && (
                          <span className="font-[family-name:var(--font-mono-club)] text-[9px] font-semibold text-[#1C2B33]/50 bg-[#1C2B33]/5 px-1 py-0.5 rounded shrink-0">
                            {eventTimeStr}
                          </span>
                        )}

                        <span className="text-[#1F6F63] font-bold shrink-0">
                          {leftDate.slice(5)}({dowLabel(leftDate)}) {leftTime}
                        </span>
                        <span className="font-bold text-[#1C2B33] shrink-0">{leftName}</span>
                        <span className="text-[#1C2B33]/40 font-normal shrink-0">⟷</span>
                        <span className="text-[#1F6F63] font-bold shrink-0">
                          {rightDate.slice(5)}({dowLabel(rightDate)}) {rightTime}
                        </span>
                        <span className="font-bold text-[#1C2B33] shrink-0">{rightName}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => props.onRevertSwapHistory?.(h.id)}
                        className="inline-flex h-5 shrink-0 items-center rounded-full border border-[#B5482F]/30 bg-white px-1.5 text-[10px] font-semibold text-[#B5482F] shadow-2xs hover:bg-[#B5482F]/10 active:scale-95 transition-all"
                      >
                        ↩ 원복
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 🎯 하단 플로팅 저장 바 (초과 발생 시 실시간 경고 및 저장 방지) */}
      {props.showSaveBar && props.isDirty && (
        <div className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 items-center justify-between gap-2.5 rounded-2xl bg-[#1C2B33] px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="min-w-0 flex-1 truncate">
            {props.hasOverCapacity ? (
              <span className="truncate text-xs font-semibold text-[#E57373] whitespace-nowrap block">
                ⚠️ 정원 초과 ({props.overCapacityCount}개)
              </span>
            ) : (
              <span className="truncate text-xs text-white/80 whitespace-nowrap block">
                수정된 내용이 있습니다
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={props.onRevert}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 active:scale-95 transition-all"
            >
              ↺ 되돌리기
            </button>
            <button
              type="button"
              onClick={props.onSaveChanges}
              disabled={props.saving || props.hasOverCapacity}
              className={
                'shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow transition-all ' +
                (props.hasOverCapacity
                  ? 'bg-white/20 text-white/40 cursor-not-allowed'
                  : 'bg-[#1F6F63] hover:bg-[#1F6F63]/90 active:scale-95 disabled:opacity-50')
              }
            >
              {props.saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 토스트 메시지 */}
      {props.toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl bg-[#1C2B33] px-4 py-3 text-sm font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span>{props.toastMessage}</span>
          <button type="button" onClick={props.onCloseToast} className="text-xs text-white/50 hover:text-white">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}