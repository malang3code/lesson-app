'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AdminDrawer from '@/components/AdminDrawer';
import LessonScheduleView, { Slot, Member, AssignedItem, SwapHistoryItem } from '@/components/LessonScheduleView';
import LessonSwapModal, { SwapTargetInfo } from '@/components/LessonSwapModal';
import { useScheduleSaveBar } from '@/hooks/useScheduleSaveBar';
import { toPng } from 'html-to-image';

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
  const [capturing, setCapturing] = useState(false);

  // 🎯 스왑(변경) 관련 상태
  const [swapModeActive, setSwapModeActive] = useState(false);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapSourceInfo, setSwapSourceInfo] = useState<SwapTargetInfo | null>(null);
  const [swapHistories, setSwapHistories] = useState<SwapHistoryItem[]>([]);
  const [pendingSwap, setPendingSwap] = useState<{
    source: SwapTargetInfo;
    target: SwapTargetInfo;
  } | null>(null);

  const captureRef = useRef<HTMLDivElement>(null);

  const [copyPanelOpen, setCopyPanelOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);

  const overCapacitySlots = useMemo(() => slots.filter((s) => (s.assigned || []).length > s.capacity), [slots]);
  const hasOverCapacity = overCapacitySlots.length > 0;

  // 🎯 해당 날짜 스왑 이력 로드
  const loadSwapHistories = useCallback(async (date: string | null) => {
    if (!date) {
      setSwapHistories([]);
      return;
    }
    try {
      const res = await fetch(`/api/lessons/swap?date=${date}`);
      const data = await res.json();
      if (res.ok) {
        setSwapHistories(data.histories || []);
      }
    } catch {
      setSwapHistories([]);
    }
  }, []);

  useEffect(() => {
    loadSwapHistories(selectedDate);
  }, [selectedDate, loadSwapHistories]);

  // 🎯 공통 저장 바 훅 연결
  const {
    isDirty,
    showSaveBar,
    saving,
    toastMessage,
    showToast,
    closeToast,
    handleRevert,
    handleSave,
  } = useScheduleSaveBar({
    currentData: slots,
    originalData: originalSlots,
    onRevertCallback: () => {
      setSlots(originalSlots);
      setPendingSwap(null);
    },
    onSave: async () => {
      if (!selectedDate || hasOverCapacity) return false;

      if (pendingSwap) {
        const swapRes = await fetch('/api/lessons/swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: pendingSwap.source,
            target: pendingSwap.target,
          }),
        });

        const swapData = await swapRes.json();
        if (!swapRes.ok) {
          showToast(swapData.error || '일정 변경 저장 실패');
          return false;
        }

        setPendingSwap(null);
        await loadData();
        await loadSwapHistories(selectedDate);
        return true;
      }

      const assignments = slots.flatMap((slot) =>
        (slot.assigned || []).map((a) => ({
          timeSlotId: slot.id,
          memberId: a.memberId,
          isCompleted: !!a.isCompleted,
        }))
      );
      const res = await fetch('/api/admin/lessons/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonDate: selectedDate, assignments }),
      });
      if (res.ok) {
        setOriginalSlots(slots);
        return true;
      } else {
        showToast('저장 실패');
        return false;
      }
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const currentYm = today.slice(0, 7);
  const currentCalYm = `${calYear}-${String(calMonth).padStart(2, '0')}`;

  useEffect(() => {
    fetch('/api/lesson-dates')
      .then((res) => res.json())
      .then((data) => {
        const dates: string[] = data.dates ?? [];
        setRawDates(dates);
        const upcoming = dates.find((d) => d >= today);
        const initial = upcoming || dates[0] || null;
        if (initial) {
          setSelectedDate(initial);
          const [y, m] = initial.split('-').map(Number);
          setCalYear(y);
          setCalMonth(m);
        }
      })
      .catch(() => showToast('레슨일 목록을 불러오지 못했습니다'));
  }, [showToast, today]);

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

  const navigableLessonDates = useMemo(() => {
    const list = showPast ? [...rawDates] : rawDates.filter((d) => d.slice(0, 7) >= currentYm);
    return list.sort();
  }, [rawDates, showPast, currentYm]);

  const currentLessonIndex = selectedDate ? navigableLessonDates.indexOf(selectedDate) : -1;

  const confirmSwitchDate = (newDate: string) => {
    if (isDirty && !confirm('저장하지 않은 변경사항이 있습니다. 취소하고 이동하시겠습니까?')) return;
    setSelectedDate(newDate);
    const [y, m] = newDate.split('-').map(Number);
    setCalYear(y);
    setCalMonth(m);
    setSwapModeActive(false);
  };

  const loadData = useCallback(async () => {
    if (!selectedDate) {
      setSlots([]);
      setOriginalSlots([]);
      setEligibleMembers([]);
      return;
    }
    setLoading(true);
    setSlots([]);
    try {
      const res = await fetch('/api/admin/day-data?date=' + selectedDate);
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '조회 실패'); return; }
      setSlots(data.slots ?? []);
      setOriginalSlots(data.slots ?? []);
      setEligibleMembers(data.eligibleMembers ?? []);
    } catch {
      showToast('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAssign = (slotId: number, memberIdStr: string) => {
    const memberId = Number(memberIdStr);
    const target = eligibleMembers.find((m) => m.id === memberId);
    if (!target) return;
    setSlots((prev) =>
      prev.map((s) =>
        s.id !== slotId
          ? s
          : {
              ...s,
              assigned: [
                ...(s.assigned || []),
                {
                  lessonId: `temp-${Date.now()}-${Math.random()}`,
                  memberId: target.id,
                  name: target.name,
                  department: target.department,
                  phone: target.phone,
                  lesson_day: target.lesson_day,
                  isCompleted: false,
                },
              ],
            }
      )
    );
  };

  const handleRemove = (lessonId: number | string) => {
    setSlots((prev) =>
      prev.map((s) => ({
        ...s,
        assigned: (s.assigned || []).filter((a) => String(a.lessonId) !== String(lessonId)),
      }))
    );
  };

  const handleToggleCompleted = (lessonId: number | string) => {
    setSlots((prev) =>
      prev.map((s) => ({
        ...s,
        assigned: (s.assigned || []).map((a) =>
          String(a.lessonId) === String(lessonId) ? { ...a, isCompleted: !a.isCompleted } : a
        ),
      }))
    );
  };

  const handleInitiateSwap = (slot: Slot, item: AssignedItem) => {
    if (!selectedDate) return;
    setSwapSourceInfo({
      lessonDate: selectedDate,
      timeSlotId: slot.id,
      timeStr: (slot.start_time || '').slice(0, 5),
      memberId: item.memberId,
      memberName: item.name,
    });
    setSwapModalOpen(true);
  };

  const handleSelectSwapTarget = (target: SwapTargetInfo) => {
    if (!swapSourceInfo) return;

    setPendingSwap({
      source: swapSourceInfo,
      target,
    });

    if (swapSourceInfo.lessonDate === target.lessonDate) {
      setSlots((prev) => {
        const sourceItem = prev
          .flatMap((s) => s.assigned || [])
          .find((a) => a.memberId === swapSourceInfo.memberId);
        const targetItem = target.memberId
          ? prev.flatMap((s) => s.assigned || []).find((a) => a.memberId === target.memberId)
          : null;

        return prev.map((s) => {
          let list = [...(s.assigned || [])];
          if (s.id === swapSourceInfo.timeSlotId) {
            list = list.filter((a) => a.memberId !== swapSourceInfo.memberId);
            if (targetItem) list.push(targetItem);
          }
          if (s.id === target.timeSlotId) {
            if (targetItem) list = list.filter((a) => a.memberId !== target.memberId);
            if (sourceItem) list.push(sourceItem);
          }
          return { ...s, assigned: list };
        });
      });
    } else {
      setSlots((prev) =>
        prev.map((s) => {
          if (s.id === swapSourceInfo.timeSlotId) {
            return {
              ...s,
              assigned: (s.assigned || []).filter((a) => a.memberId !== swapSourceInfo.memberId),
            };
          }
          return s;
        })
      );
    }

    setSwapModalOpen(false);
    setSwapModeActive(false);
    showToast(`${swapSourceInfo.memberName} ⟷ ${target.memberName} 변경 준비 완료 (하단 저장 클릭)`);
  };

  const handleRevertSwapHistory = async (historyId: number) => {
    if (!confirm('이 변경 건을 원래 일정으로 되돌리시겠습니까?')) return;
    try {
      const res = await fetch(`/api/lessons/swap?id=${historyId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '원복 실패');
        return;
      }
      showToast('원래 일정으로 복구되었습니다.');
      await loadData();
      await loadSwapHistories(selectedDate);
    } catch {
      showToast('네트워크 오류');
    }
  };

  const handleShareImage = async () => {
    if (!captureRef.current || capturing || !selectedDate) return;
    setCapturing(true);
    showToast('이미지 생성 중...');
    try {
      const dataUrl = await toPng(captureRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: '#FAFAF7' });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `lesson-${selectedDate}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: `${selectedDate} 레슨 시간표`, files: [file] });
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `레슨시간표_${selectedDate}.png`;
        link.click();
      }
    } catch {
      showToast('이미지 생성 실패');
    } finally {
      setCapturing(false);
    }
  };

  const runCopy = async () => {
    if (!selectedDate || copyTargets.size === 0 || isDirty) return;
    setCopying(true);
    try {
      const res = await fetch('/api/admin/lessons/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDate: selectedDate, toDates: Array.from(copyTargets) }),
      });
      if (res.ok) {
        showToast('선택한 날짜에 성공적으로 복사되었습니다.');
        setCopyTargets(new Set());
        setCopyPanelOpen(false);
      } else {
        showToast('복사 실패');
      }
    } catch {
      showToast('네트워크 오류');
    } finally {
      setCopying(false);
    }
  };

  return (
    <>
      <LessonScheduleView
        mode="admin"
        drawer={<AdminDrawer />}
        selectedDate={selectedDate}
        slots={slots}
        loading={loading}
        capturing={capturing}
        toastMessage={toastMessage}
        captureRef={captureRef}
        onShareImage={handleShareImage}
        canPrev={currentLessonIndex > 0}
        canNext={currentLessonIndex >= 0 && currentLessonIndex < navigableLessonDates.length - 1}
        onPrev={() => currentLessonIndex > 0 && confirmSwitchDate(navigableLessonDates[currentLessonIndex - 1])}
        onNext={() => currentLessonIndex < navigableLessonDates.length - 1 && confirmSwitchDate(navigableLessonDates[currentLessonIndex + 1])}
        calendarOpen={calendarOpen}
        onToggleCalendar={() => setCalendarOpen((v) => !v)}
        calYear={calYear}
        calMonth={calMonth}
        calendarDays={calendarDays}
        showPast={showPast}
        onToggleShowPast={() => setShowPast((v) => !v)}
        onPrevMonth={() => setCalMonth((prev) => (prev === 1 ? (setCalYear((y) => y - 1), 12) : prev - 1))}
        onNextMonth={() => setCalMonth((prev) => (prev === 12 ? (setCalYear((y) => y + 1), 1) : prev + 1))}
        onSelectDate={(d) => { confirmSwitchDate(d); setCalendarOpen(false); }}
        currentCalYm={currentCalYm}
        currentYm={currentYm}
        swapModeActive={swapModeActive}
        onToggleSwapMode={() => setSwapModeActive((v) => !v)}
        onInitiateSwap={handleInitiateSwap}
        swapHistories={swapHistories}
        onRevertSwapHistory={handleRevertSwapHistory}
        showDetailInfo={showDetailInfo}
        onToggleDetailInfo={() => setShowDetailInfo((v) => !v)}
        eligibleMembers={eligibleMembers}
        showAllOverride={showAllOverride}
        onToggleOverride={(slotId) => setShowAllOverride((prev) => ({ ...prev, [slotId]: !prev[slotId] }))}
        onAssign={handleAssign}
        onRemove={handleRemove}
        onToggleCompleted={handleToggleCompleted}
        copyPanelOpen={copyPanelOpen}
        onToggleCopyPanel={() => setCopyPanelOpen((v) => !v)}
        copyTargets={copyTargets}
        onToggleCopyTarget={(d) => setCopyTargets((prev) => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; })}
        validCopyDates={rawDates.filter((d) => d.slice(0, 7) >= currentYm && d !== selectedDate).sort()}
        copying={copying}
        onRunCopy={runCopy}
        onResetDay={() => confirm('배정을 모두 비우시겠습니까?') && setSlots((p) => p.map((s) => ({ ...s, assigned: [] })))}
        isDirty={isDirty}
        saving={saving}
        hasOverCapacity={hasOverCapacity}
        overCapacityCount={overCapacitySlots.length}
        showSaveBar={showSaveBar}
        onRevert={handleRevert}
        onSaveChanges={handleSave}
        onCloseToast={closeToast}
      />

      <LessonSwapModal
        isOpen={swapModalOpen}
        onClose={() => setSwapModalOpen(false)}
        sourceInfo={swapSourceInfo}
        rawDates={rawDates}
        currentYm={currentYm}
        onSelectTarget={handleSelectSwapTarget}
      />
    </>
  );
}