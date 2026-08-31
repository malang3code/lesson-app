'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AdminDrawer from '@/components/AdminDrawer';

type LessonDay = 'TUE' | 'THU' | 'BOTH';

type Member = {
  id: number;
  name: string;
  department: string | null;
  phone: string | null;
  employee_no: string | null;
  lesson_day: LessonDay;
  is_active: boolean;
};

type TimeSlot = {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
};

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function displayPhone(phoneStr: string | null | undefined): string {
  if (!phoneStr) return '-';
  const clean = phoneStr.replace(/[^0-9]/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  return phoneStr;
}

function getLessonDayBadge(day: LessonDay | undefined) {
  if (day === 'THU') return { label: '목요일', bg: 'bg-[#8F3A24]/10 text-[#8F3A24]' };
  if (day === 'BOTH') return { label: '화/목', bg: 'bg-[#1F6F63]/10 text-[#1F6F63]' };
  return { label: '화요일', bg: 'bg-[#1C2B33]/10 text-[#1C2B33]' };
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'members' | 'slots'>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const [toastMessage, setToastMessage] = useState('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 1000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // 🎯 활성 회원 기준 화요일 / 목요일 인원수 집계
  const { tueCount, thuCount } = useMemo(() => {
    const activeMembers = members.filter((m) => m.is_active);
    const tue = activeMembers.filter((m) => m.lesson_day === 'TUE' || m.lesson_day === 'BOTH').length;
    const thu = activeMembers.filter((m) => m.lesson_day === 'THU' || m.lesson_day === 'BOTH').length;
    return { tueCount: tue, thuCount: thu };
  }, [members]);

  // 신규 등록 폼 상태
  const [newMember, setNewMember] = useState<{
    name: string;
    employee_no: string;
    department: string;
    phone: string;
    lesson_day: LessonDay;
  }>({
    name: '',
    employee_no: '',
    department: '',
    phone: '',
    lesson_day: 'TUE',
  });

  const [newSlot, setNewSlot] = useState({
    day_of_week: 2,
    start_time: '10:00',
    end_time: '10:30',
    capacity: 2,
  });

  // 회원 수정 모달 상태
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<{
    id: number;
    name: string;
    employee_no: string;
    department: string;
    phone: string;
    lesson_day: LessonDay;
    is_active: boolean;
  } | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        fetch('/api/admin/settings/members'),
        fetch('/api/admin/settings/slots'),
      ]);
      const mData = await mRes.json();
      const sData = await sRes.json();

      if (mRes.ok) setMembers(mData.members ?? []);
      if (sRes.ok) setSlots(sData.slots ?? []);
    } catch {
      showToast('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 수강생 등록
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name.trim() || !newMember.employee_no.trim()) {
      showToast('이름과 사번은 필수 입력 항목입니다.');
      return;
    }

    if (newMember.phone.trim() && newMember.phone.trim().length !== 11) {
      showToast('전화번호는 숫자 11자리여야 합니다.');
      return;
    }

    try {
      const res = await fetch('/api/admin/settings/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember),
      });
      const data = await res.json();
      if (res.ok) {
        setNewMember({ name: '', employee_no: '', department: '', phone: '', lesson_day: 'TUE' });
        loadData();
        showToast('수강생이 등록되었습니다.');
      } else {
        showToast(data.error || '등록 실패');
      }
    } catch {
      showToast('네트워크 오류');
    }
  };

  // 수정 모달 열기
  const openEditModal = (m: Member) => {
    setEditingMember({
      id: m.id,
      name: m.name,
      employee_no: m.employee_no ?? '',
      department: m.department ?? '',
      phone: m.phone ?? '',
      lesson_day: m.lesson_day || 'TUE',
      is_active: m.is_active,
    });
    setEditModalOpen(true);
  };

  // 회원 정보 수정 제출
  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    if (!editingMember.name.trim() || !editingMember.employee_no.trim()) {
      showToast('이름과 사번은 필수 입력 항목입니다.');
      return;
    }

    setSubmittingEdit(true);
    try {
      const res = await fetch('/api/admin/settings/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMember),
      });
      const data = await res.json();
      if (res.ok) {
        setEditModalOpen(false);
        setEditingMember(null);
        loadData();
        showToast('회원 정보가 수정되었습니다.');
      } else {
        showToast(data.error || '수정 실패');
      }
    } catch {
      showToast('네트워크 오류');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // 수강생 활성/비활성 토글
  const handleToggleMemberActive = async (member: Member) => {
    try {
      const res = await fetch('/api/admin/settings/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id, is_active: !member.is_active }),
      });
      if (res.ok) {
        loadData();
      }
    } catch {
      showToast('상태 변경 실패');
    }
  };

  // 수강생 삭제
  const handleDeleteMember = async (id: number, name: string) => {
    if (!confirm(`'${name}' 수강생을 삭제하시겠습니까?\n(배정된 레슨 내역도 함께 삭제됩니다)`)) return;
    try {
      const res = await fetch(`/api/admin/settings/members?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
        showToast('수강생이 삭제되었습니다.');
      }
    } catch {
      showToast('삭제 실패');
    }
  };

  // 시간대 등록
  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/settings/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSlot),
      });
      const data = await res.json();
      if (res.ok) {
        loadData();
        showToast('시간대 슬롯이 추가되었습니다.');
      } else {
        showToast(data.error || '등록 실패');
      }
    } catch {
      showToast('네트워크 오류');
    }
  };

  // 시간대 삭제
  const handleDeleteSlot = async (id: number) => {
    if (!confirm('이 시간대 슬롯을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/admin/settings/slots?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
        showToast('시간대 슬롯이 삭제되었습니다.');
      }
    } catch {
      showToast('삭제 실패');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1C2B33]">
      <header className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] px-5 pt-8 pb-6 sm:px-8">
        <div className="flex items-center gap-3">
          <AdminDrawer />
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
                정보 관리
              </h1>
              {/* 🎯 활성 수강생 화 ??명 / 목 ??명 표시 */}
              <div className="flex items-center gap-1.5 rounded-full border border-[#1C2B33]/15 bg-white px-3 py-1 text-sm font-semibold text-[#1C2B33]/80 shadow-2xs">
                <span>화 {tueCount}명</span>
                <span className="text-[#1C2B33]/30">/</span>
                <span>목 {thuCount}명</span>
              </div>
            </div>
            <a
              href="/admin/assign"
              className="mt-1 inline-block text-sm text-[#1C2B33]/50 underline underline-offset-2 hover:text-[#1C2B33]"
            >
              ← 돌아가기
            </a>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ' +
              (activeTab === 'members'
                ? 'bg-[#1C2B33] text-white shadow-sm'
                : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
            }
          >
            수강생 관리 ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('slots')}
            className={
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ' +
              (activeTab === 'slots'
                ? 'bg-[#1C2B33] text-white shadow-sm'
                : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
            }
          >
            시간대 슬롯 관리 ({slots.length})
          </button>
        </div>
      </header>

      <main className="max-w-5xl px-3 py-6 sm:px-8">
        {loading ? (
          <p className="text-sm text-[#1C2B33]/40">불러오는 중...</p>
        ) : activeTab === 'members' ? (
          /* ================= 수강생 관리 탭 ================= */
          <div className="space-y-6">
            <form
              onSubmit={handleAddMember}
              className="rounded-2xl border border-[#1C2B33]/10 bg-white p-4 shadow-[0_1px_2px_rgba(28,43,51,0.04)]"
            >
              <h2 className="mb-3 text-sm font-semibold text-[#1C2B33]">+ 새 수강생 등록</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <input
                  type="text"
                  placeholder="사번 (필수)"
                  value={newMember.employee_no}
                  onChange={(e) => setNewMember({ ...newMember, employee_no: e.target.value })}
                  className="rounded-lg border border-[#1C2B33]/15 px-3 py-1.5 text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="이름 (필수)"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  className="rounded-lg border border-[#1C2B33]/15 px-3 py-1.5 text-sm"
                  required
                />
                <select
                  value={newMember.lesson_day}
                  onChange={(e) =>
                    setNewMember({ ...newMember, lesson_day: e.target.value as LessonDay })
                  }
                  className="rounded-lg border border-[#1C2B33]/15 px-3 py-1.5 text-sm bg-white font-medium"
                >
                  <option value="TUE">화요일</option>
                  <option value="THU">목요일</option>
                  <option value="BOTH">화/목</option>
                </select>
                <input
                  type="text"
                  placeholder="부서"
                  value={newMember.department}
                  onChange={(e) => setNewMember({ ...newMember, department: e.target.value })}
                  className="rounded-lg border border-[#1C2B33]/15 px-3 py-1.5 text-sm"
                />
                <input
                  type="tel"
                  placeholder="전화번호 (11자리)"
                  maxLength={11}
                  value={newMember.phone}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/[^0-9]/g, '');
                    setNewMember({ ...newMember, phone: onlyNums });
                  }}
                  className="rounded-lg border border-[#1C2B33]/15 px-3 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="col-span-2 rounded-lg bg-[#1C2B33] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#1C2B33]/90 sm:col-span-1"
                >
                  등록
                </button>
              </div>
            </form>

            <div className="overflow-x-auto rounded-2xl border border-[#1C2B33]/10 bg-white shadow-[0_1px_2px_rgba(28,43,51,0.04)]">
              <table className="w-full text-center text-sm">
                <thead className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] font-[family-name:var(--font-mono-club)] text-xs text-[#1C2B33]/60">
                  <tr>
                    <th className="py-3 px-3 text-center">상태</th>
                    <th className="py-3 px-2 text-center">사번</th>
                    <th className="py-3 px-2 text-center">이름</th>
                    <th className="py-3 px-3 text-center">요일</th>
                    <th className="py-3 px-3 text-center">전화번호</th>
                    {/* 🎯 부서 컬럼 헤더: 가운데 정렬 */}
                    <th className="py-3 px-4 text-center">부서</th>
                    <th className="py-3 px-3 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C2B33]/5">
                  {members.map((m) => {
                    const badge = getLessonDayBadge(m.lesson_day);
                    return (
                      <tr key={m.id} className={m.is_active ? '' : 'bg-[#1C2B33]/[0.02] opacity-50'}>
                        {/* 1. 상태 */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleMemberActive(m)}
                            className={
                              'inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight transition-all active:scale-95 ' +
                              (m.is_active
                                ? 'bg-[#1F6F63]/15 text-[#1F6F63] border border-[#1F6F63]/30'
                                : 'bg-[#1C2B33]/10 text-[#1C2B33]/40 border border-[#1C2B33]/15')
                            }
                          >
                            {m.is_active ? 'ON' : 'OFF'}
                          </button>
                        </td>

                        {/* 2. 사번 */}
                        <td className="py-2.5 px-2 text-center font-semibold text-[#1C2B33] whitespace-nowrap">
                          {m.employee_no ?? '-'}
                        </td>

                        {/* 3. 이름 */}
                        <td className="py-2.5 px-2 text-center font-medium whitespace-nowrap">
                          {m.name}
                        </td>

                        {/* 4. 요일 */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={'rounded-md px-2 py-0.5 text-xs font-bold ' + badge.bg}>
                            {badge.label}
                          </span>
                        </td>

                        {/* 5. 전화번호 */}
                        <td className="py-2.5 px-3 text-center font-[family-name:var(--font-mono-club)] text-[#1C2B33]/70 whitespace-nowrap">
                          {displayPhone(m.phone)}
                        </td>

                        {/* 6. 부서: 🎯 데이터만 왼쪽 정렬 (text-left) */}
                        <td className="py-2.5 px-4 text-left text-[#1C2B33]/70 max-w-[160px] truncate font-normal">
                          {m.department ?? '-'}
                        </td>

                        {/* 7. 관리 */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap space-x-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(m)}
                            className="rounded px-2 py-1 text-xs font-semibold text-[#1C2B33]/70 hover:bg-[#1C2B33]/5"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(m.id, m.name)}
                            className="rounded px-2 py-1 text-xs text-[#B5482F] hover:bg-[#B5482F]/10"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-[#1C2B33]/40">
                        등록된 수강생이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ================= 시간대 슬롯 관리 탭 ================= */
          <div className="space-y-6">
            <form
              onSubmit={handleAddSlot}
              className="rounded-2xl border border-[#1C2B33]/10 bg-white p-4 shadow-[0_1px_2px_rgba(28,43,51,0.04)]"
            >
              <h2 className="mb-3 text-sm font-semibold text-[#1C2B33]">+ 새 시간대 슬롯 추가</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <select
                  value={newSlot.day_of_week}
                  onChange={(e) => setNewSlot({ ...newSlot, day_of_week: Number(e.target.value) })}
                  className="rounded-lg border border-[#1C2B33]/15 px-3 py-1.5 text-sm"
                >
                  <option value={2}>화요일</option>
                  <option value={4}>목요일</option>
                  <option value={1}>월요일</option>
                  <option value={3}>수요일</option>
                  <option value={5}>금요일</option>
                </select>
                <input
                  type="time"
                  value={newSlot.start_time}
                  onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                  className="rounded-lg border border-[#1C2B33]/15 px-3 py-1.5 text-sm"
                  required
                />
                <input
                  type="time"
                  value={newSlot.end_time}
                  onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                  className="rounded-lg border border-[#1C2B33]/15 px-3 py-1.5 text-sm"
                  required
                />
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={newSlot.capacity}
                  onChange={(e) => setNewSlot({ ...newSlot, capacity: Number(e.target.value) })}
                  placeholder="정원(명)"
                  className="rounded-lg border border-[#1C2B33]/15 px-3 py-1.5 text-sm"
                  required
                />
                <button
                  type="submit"
                  className="col-span-2 rounded-lg bg-[#1C2B33] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#1C2B33]/90 sm:col-span-1"
                >
                  추가
                </button>
              </div>
            </form>

            <div className="overflow-x-auto rounded-2xl border border-[#1C2B33]/10 bg-white shadow-[0_1px_2px_rgba(28,43,51,0.04)]">
              <table className="w-full text-center text-sm">
                <thead className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] font-[family-name:var(--font-mono-club)] text-xs text-[#1C2B33]/60">
                  <tr>
                    <th className="py-3 px-4 text-center">요일</th>
                    <th className="py-3 px-4 text-center">시작 시간</th>
                    <th className="py-3 px-4 text-center">종료 시간</th>
                    <th className="py-3 px-4 text-center">정원</th>
                    <th className="py-3 px-4 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C2B33]/5">
                  {slots.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 px-4 font-semibold text-[#1C2B33]">
                        {DOW_LABELS[s.day_of_week]}요일
                      </td>
                      <td className="py-2.5 px-4 font-[family-name:var(--font-mono-club)]">
                        {s.start_time.slice(0, 5)}
                      </td>
                      <td className="py-2.5 px-4 font-[family-name:var(--font-mono-club)]">
                        {s.end_time.slice(0, 5)}
                      </td>
                      <td className="py-2.5 px-4 text-[#1C2B33]/70">{s.capacity}명</td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(s.id)}
                          className="rounded px-2 py-1 text-xs text-[#B5482F] hover:bg-[#B5482F]/10"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                  {slots.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-[#1C2B33]/40">
                        등록된 시간대 슬롯이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 회원 수정 팝업 모달 */}
      {editModalOpen && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[#1C2B33]">
              회원 정보 수정
            </h3>

            <form onSubmit={handleUpdateMember} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1C2B33]/70">
                    사번 <span className="text-[#B5482F]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingMember.employee_no}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, employee_no: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-[#1C2B33]/20 px-3 py-2 text-sm focus:border-[#1C2B33] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1C2B33]/70">
                    이름 <span className="text-[#B5482F]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingMember.name}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, name: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-[#1C2B33]/20 px-3 py-2 text-sm focus:border-[#1C2B33] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2B33]/70">
                  레슨 요일 <span className="text-[#B5482F]">*</span>
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'TUE', label: '화요일' },
                      { id: 'THU', label: '목요일' },
                      { id: 'BOTH', label: '화/목' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setEditingMember({ ...editingMember, lesson_day: item.id })
                      }
                      className={
                        'h-9 rounded-xl border text-xs font-bold transition-all ' +
                        (editingMember.lesson_day === item.id
                          ? 'border-[#1C2B33] bg-[#1C2B33] text-white shadow-xs'
                          : 'border-[#1C2B33]/15 bg-[#FAFAF7] text-[#1C2B33]/60 hover:bg-[#1C2B33]/5')
                      }
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1C2B33]/70">부서</label>
                  <input
                    type="text"
                    value={editingMember.department}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, department: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-[#1C2B33]/20 px-3 py-2 text-sm focus:border-[#1C2B33] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1C2B33]/70">전화번호</label>
                  <input
                    type="tel"
                    maxLength={11}
                    value={editingMember.phone}
                    onChange={(e) => {
                      const onlyNums = e.target.value.replace(/[^0-9]/g, '');
                      setEditingMember({ ...editingMember, phone: onlyNums });
                    }}
                    className="mt-1 w-full rounded-xl border border-[#1C2B33]/20 px-3 py-2 text-sm focus:border-[#1C2B33] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="modalActiveCheck"
                  checked={editingMember.is_active}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded accent-[#1C2B33]"
                />
                <label htmlFor="modalActiveCheck" className="text-xs font-semibold text-[#1C2B33]/80">
                  활성 회원 (시간표 배정 대상 포함)
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-[#1C2B33]/60 hover:bg-[#1C2B33]/5"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="rounded-full bg-[#1C2B33] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#1C2B33]/90 disabled:opacity-50"
                >
                  {submittingEdit ? '저장 중...' : '수정 완료'}
                </button>
              </div>
            </form>
          </div>
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