'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

type PreferredDay = 'TUE_ONLY' | 'THU_ONLY' | 'ANY' | 'TUE' | 'THU' | 'BOTH';
type LessonDay = 'TUE' | 'THU' | 'BOTH';
type ViewMode = 'default' | 'notes';

interface Application {
  id: number;
  term_month: string;
  employee_no: string;
  name: string;
  department: string | null;
  phone: string | null;
  preferred_day: PreferredDay;
  preferred_time_1: string | null;
  preferred_time_2: string | null;
  notes: string | null;
  status: string; // 'ON' | 'OFF'
  lesson_day?: LessonDay;
  created_at?: string;
  editStatus?: string;
  editLessonDay?: LessonDay;
}

function mapPreferredToLessonDay(preferred: PreferredDay): LessonDay {
  if (preferred === 'THU' || preferred === 'THU_ONLY') return 'THU';
  if (preferred === 'BOTH' || preferred === 'ANY') return 'BOTH';
  return 'TUE';
}

function getDayBadge(day: PreferredDay) {
  if (day === 'THU' || day === 'THU_ONLY') return { label: '목요일', bg: 'bg-[#8F3A24]/10 text-[#8F3A24]' };
  if (day === 'BOTH' || day === 'ANY') return { label: '화/목', bg: 'bg-[#1F6F63]/10 text-[#1F6F63]' };
  return { label: '화요일', bg: 'bg-[#1C2B33]/10 text-[#1C2B33]' };
}

function addMonths(dateStr: string, months: number): string {
  const [year, month] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1 + months, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getDefaultTargetTerms(): string[] {
  const now = new Date();
  const currentY = now.getFullYear();
  const currentM = String(now.getMonth() + 1).padStart(2, '0');
  const currentTerm = `${currentY}-${currentM}`;

  return [
    addMonths(currentTerm, -1),
    currentTerm,
    addMonths(currentTerm, 1),
  ];
}

export default function ApplicationsSettingsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [originalApplications, setOriginalApplications] = useState<Application[]>([]);
  
  const defaultTerms = useMemo(() => getDefaultTargetTerms(), []);
  const [selectedTerm, setSelectedTerm] = useState<string>(defaultTerms[1]);
  
  const [viewMode, setViewMode] = useState<ViewMode>('default');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 1500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const availableTermsInDb = useMemo(() => {
    const set = new Set<string>();
    defaultTerms.forEach(t => set.add(t));
    originalApplications.forEach((a) => {
      if (a.term_month) set.add(a.term_month);
    });
    return Array.from(set).sort().reverse();
  }, [originalApplications, defaultTerms]);

  const quickTerms = useMemo(() => {
    return defaultTerms;
  }, [defaultTerms]);

  const olderTerms = useMemo(() => {
    return availableTermsInDb.filter((t) => !quickTerms.includes(t));
  }, [availableTermsInDb, quickTerms]);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/admin/applications?term=${encodeURIComponent(selectedTerm)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        const list: Application[] = (data.applications ?? []).map((item: any) => ({
          ...item,
          editStatus: item.status,
          editLessonDay: (item.lesson_day as LessonDay) || mapPreferredToLessonDay(item.preferred_day),
        }));
        setApplications(list);
        setOriginalApplications(JSON.parse(JSON.stringify(list)));
      } else {
        showToast(data.error || '조회 실패');
      }
    } catch {
      showToast('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, [selectedTerm, showToast]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const handleSelectTerm = (term: string) => {
    const isTermSetUp = availableTermsInDb.includes(term);

    if (!isTermSetUp) {
      const confirmMove = window.confirm(
        `아직 [${term}] 기수 설정이 되지 않았습니다.\n레슨일 관리 페이지로 이동하시겠습니까?`
      );
      if (confirmMove) {
        router.push('/admin/calendar');
        return;
      }
      return;
    }

    setSelectedTerm(term);
  };

  const dirtyMap = useMemo(() => {
    const map = new Map<number, { status: string; lesson_day: LessonDay }>();
    applications.forEach((app) => {
      const orig = originalApplications.find((o) => o.id === app.id);
      if (orig && (orig.editStatus !== app.editStatus || orig.editLessonDay !== app.editLessonDay)) {
        map.set(app.id, { status: app.editStatus!, lesson_day: app.editLessonDay! });
      }
    });
    return map;
  }, [applications, originalApplications]);

  const isDirty = dirtyMap.size > 0;

  const handleToggleStatus = (id: number) => {
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id === id) {
          const nextStatus = app.editStatus === 'ON' ? 'OFF' : 'ON';
          return { ...app, editStatus: nextStatus };
        }
        return app;
      })
    );
  };

  const handleChangeLessonDay = (id: number, day: LessonDay) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, editLessonDay: day } : app))
    );
  };

  const handleRevert = () => {
    setApplications(JSON.parse(JSON.stringify(originalApplications)));
    showToast('변경사항을 되돌렸습니다.');
  };

  const handleBatchSave = async () => {
    if (saving || !isDirty) return;
    setSaving(true);

    try {
      const updates = Array.from(dirtyMap.entries()).map(([id, info]) => ({
        id,
        status: info.status as 'ON' | 'OFF',
        lesson_day: info.lesson_day,
      }));

      const res = await fetch('/api/admin/applications/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('신청 내역 변경 및 배정 요일이 일괄 저장되었습니다.');
        setOriginalApplications(JSON.parse(JSON.stringify(applications)));
        loadApplications();
      } else {
        showToast(data.error || '일괄 저장 실패');
      }
    } catch {
      showToast('네트워크 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteApplication = async (id: number, name: string, empNo: string) => {
    if (
      !confirm(
        `'${name}'(${empNo})님의 신청 내역을 삭제하시겠습니까?\n삭제 후 해당 사번으로 다시 신청할 수 있습니다.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/applications?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setApplications((prev) => prev.filter((item) => item.id !== id));
        setOriginalApplications((prev) => prev.filter((item) => item.id !== id));
        showToast('신청 내역이 삭제되었습니다.');
      } else {
        showToast(data.error || '삭제 실패');
      }
    } catch {
      showToast('네트워크 오류');
    }
  };

  const totalColumns = viewMode === 'default' ? 7 : 5;

  return (
    <div className="max-w-xl space-y-3 pb-20 text-xs">
      {/* 상단 필터 바 및 2단계 뷰 전환 버튼 영역 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1C2B33]/15 bg-white px-3 py-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1 overflow-x-auto no-scrollbar">
          <span className="font-bold text-[#1C2B33]/60 mr-0.5">기수:</span>
          
          {quickTerms.map((t) => {
            const isCurrentMonth = t === defaultTerms[1];
            const label = isCurrentMonth ? `${t} (이번달)` : t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => handleSelectTerm(t)}
                className={
                  'h-6 rounded-full px-2 text-[11px] font-semibold transition-all cursor-pointer ' +
                  (selectedTerm === t
                    ? 'bg-[#1C2B33] text-white shadow-2xs'
                    : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
                }
              >
                {label}
              </button>
            );
          })}

          {olderTerms.length > 0 && (
            <select
              value={olderTerms.includes(selectedTerm) ? selectedTerm : ''}
              onChange={(e) => {
                if (e.target.value) handleSelectTerm(e.target.value);
              }}
              className="h-6 rounded-full border border-[#1C2B33]/15 bg-white px-1.5 text-[11px] font-semibold text-[#1C2B33]/70 focus:outline-none cursor-pointer"
            >
              <option value="" disabled>
                과거 ▼
              </option>
              {olderTerms.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* 2단계 뷰 전환 버튼 그룹 (기본 / 요청사항) */}
          <div className="inline-flex rounded-lg border border-[#1C2B33]/15 bg-[#FAFAF7] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('default')}
              className={
                'rounded px-2.5 py-0.5 font-semibold transition-all cursor-pointer text-[11px] ' +
                (viewMode === 'default'
                  ? 'bg-[#1C2B33] text-white shadow-2xs'
                  : 'text-[#1C2B33]/70 hover:text-[#1C2B33]')
              }
            >
              기본
            </button>
            <button
              type="button"
              onClick={() => setViewMode('notes')}
              className={
                'rounded px-2.5 py-0.5 font-semibold transition-all cursor-pointer text-[11px] ' +
                (viewMode === 'notes'
                  ? 'bg-[#1F6F63] text-white shadow-2xs'
                  : 'text-[#1C2B33]/70 hover:text-[#1C2B33]')
              }
            >
              요청사항
            </button>
          </div>

          <div className="text-[11px] font-medium text-[#1C2B33]/60 whitespace-nowrap">
            총 <strong className="text-[#1C2B33]">{applications.length}</strong>건
            {isDirty && <span className="ml-1 font-bold text-[#C98A2B]">(변경)</span>}
          </div>
        </div>
      </div>

      {/* 신청 목록 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-[#1C2B33]/15 bg-white shadow-2xs">
        <table className="w-full text-center text-xs">
          <thead className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] font-[family-name:var(--font-mono-club)] text-[#1C2B33]/60">
            <tr>
              {viewMode === 'default' ? (
                <>
                  <th className="py-2.5 px-2 text-center">사번</th>
                  <th className="py-2.5 px-2 text-center">이름</th>
                  <th className="py-2.5 px-2 text-center">희망</th>
                  <th className="py-2.5 px-2 text-center">선호</th>
                  <th className="py-2.5 px-2 text-center">상태</th>
                  <th className="py-2.5 px-2 text-center">확정</th>
                  <th className="py-2.5 px-2 text-center">삭제</th>
                </>
              ) : (
                <>
                  <th className="py-2.5 px-1 text-center whitespace-nowrap w-[90px]">사번</th>
                  <th className="py-2.5 px-1 text-center whitespace-nowrap w-[70px]">이름</th>
                  <th className="py-2.5 px-1 text-center whitespace-nowrap w-[60px]">상태</th>
                  <th className="py-2.5 px-1 text-center whitespace-nowrap w-[75px]">확정</th>
                  <th className="py-2.5 px-3 text-left w-full">요청사항</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1C2B33]/5">
            {loading ? (
              <tr>
                <td colSpan={totalColumns} className="py-6 text-center text-[#1C2B33]/40 animate-pulse">
                  불러오는 중...
                </td>
              </tr>
            ) : applications.length === 0 ? (
              <tr>
                <td colSpan={totalColumns} className="py-6 text-center text-[#1C2B33]/40">
                  [{selectedTerm}] 접수 내역 없음
                </td>
              </tr>
            ) : (
              applications.map((item) => {
                const isApproved = item.editStatus === 'ON';
                const isChanged = dirtyMap.has(item.id);
                const dayBadge = getDayBadge(item.preferred_day);
                const timeText = [item.preferred_time_1, item.preferred_time_2]
                  .filter(Boolean)
                  .join(' / ');

                return (
                  <tr
                    key={item.id}
                    className={
                      'transition-colors ' +
                      (isChanged
                        ? 'bg-[#1F6F63]/5 ring-1 ring-inset ring-[#1F6F63]/30'
                        : isApproved
                        ? 'hover:bg-[#FAFAF7]/60'
                        : 'bg-[#1C2B33]/[0.02] opacity-60')
                    }
                  >
                    {viewMode === 'default' ? (
                      <>
                        <td className="py-2 px-2 font-semibold text-[#1C2B33] whitespace-nowrap">{item.employee_no}</td>
                        <td className="py-2 px-2 font-medium text-[#1C2B33] whitespace-nowrap">{item.name}</td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <span className={'rounded px-1.5 py-0.5 text-[10px] font-bold ' + dayBadge.bg}>
                            {dayBadge.label}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-[family-name:var(--font-mono-club)] text-[#1C2B33]/70 whitespace-nowrap">{timeText || '-'}</td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item.id)}
                            className={
                              'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight transition-all active:scale-95 cursor-pointer ' +
                              (isApproved
                                ? 'bg-[#1F6F63]/15 text-[#1F6F63] border border-[#1F6F63]/30 shadow-2xs'
                                : 'bg-[#1C2B33]/10 text-[#1C2B33]/40 border border-[#1C2B33]/15')
                            }
                          >
                            {isApproved ? 'ON' : 'OFF'}
                          </button>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <select
                            value={item.editLessonDay}
                            onChange={(e) => handleChangeLessonDay(item.id, e.target.value as LessonDay)}
                            disabled={!isApproved}
                            className={
                              'h-6 rounded border px-1 text-[10px] font-bold transition-all cursor-pointer ' +
                              (isApproved
                                ? 'border-[#1F6F63]/30 bg-white text-[#1F6F63] focus:outline-none'
                                : 'border-[#1C2B33]/10 bg-[#FAFAF7] text-[#1C2B33]/30 opacity-50 cursor-not-allowed')
                            }
                          >
                            <option value="TUE">화요일</option>
                            <option value="THU">목요일</option>
                            <option value="BOTH">화/목</option>
                          </select>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteApplication(item.id, item.name, item.employee_no)}
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[#B5482F] hover:bg-[#B5482F]/10 cursor-pointer"
                          >
                            삭제
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-1 font-semibold text-[#1C2B33] whitespace-nowrap text-center">{item.employee_no}</td>
                        <td className="py-2 px-1 font-medium text-[#1C2B33] whitespace-nowrap text-center">{item.name}</td>
                        <td className="py-2 px-1 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item.id)}
                            className={
                              'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight transition-all active:scale-95 cursor-pointer ' +
                              (isApproved
                                ? 'bg-[#1F6F63]/15 text-[#1F6F63] border border-[#1F6F63]/30 shadow-2xs'
                                : 'bg-[#1C2B33]/10 text-[#1C2B33]/40 border border-[#1C2B33]/15')
                            }
                          >
                            {isApproved ? 'ON' : 'OFF'}
                          </button>
                        </td>
                        <td className="py-2 px-1 whitespace-nowrap text-center">
                          <select
                            value={item.editLessonDay}
                            onChange={(e) => handleChangeLessonDay(item.id, e.target.value as LessonDay)}
                            disabled={!isApproved}
                            className={
                              'h-6 rounded border px-1 text-[10px] font-bold transition-all cursor-pointer ' +
                              (isApproved
                                ? 'border-[#1F6F63]/30 bg-white text-[#1F6F63] focus:outline-none'
                                : 'border-[#1C2B33]/10 bg-[#FAFAF7] text-[#1C2B33]/30 opacity-50 cursor-not-allowed')
                            }
                          >
                            <option value="TUE">화요일</option>
                            <option value="THU">목요일</option>
                            <option value="BOTH">화/목</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-left text-[#1C2B33]/80 font-normal whitespace-nowrap overflow-hidden text-ellipsis max-w-[280px]">
                          {item.notes || '-'}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 하단 플로팅 저장 바 */}
      {isDirty && (
        <div className="fixed bottom-6 left-6 z-40 flex w-auto max-w-xs items-center justify-between gap-3 rounded-xl bg-[#1C2B33] px-4 py-2.5 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="truncate text-[11px] text-white/80 whitespace-nowrap block">
            변경됨 ({dirtyMap.size}건)
          </span>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleRevert}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
            >
              ↺ 취소
            </button>
            <button
              type="button"
              onClick={handleBatchSave}
              disabled={saving}
              className="shrink-0 whitespace-nowrap rounded-full bg-[#1F6F63] px-3.5 py-1 text-[11px] font-bold text-white shadow transition-all hover:bg-[#1F6F63]/90 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? '저장중' : '저장'}
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-[#1C2B33] px-3 py-2 text-[11px] font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            className="text-white/50 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}