'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminDrawer from '@/components/AdminDrawer';

type LessonDay = 'TUE' | 'THU' | 'BOTH';

type Member = {
  id: number;
  employee_no: string;
  name: string;
  department: string | null;
  phone: string | null;
  lesson_day: LessonDay;
  is_active: boolean;
};

function displayPhone(phoneStr: string | null | undefined): string {
  if (!phoneStr) return '-';
  const clean = phoneStr.replace(/[^0-9]/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  return phoneStr;
}

function getLessonDayLabel(day: LessonDay) {
  if (day === 'TUE') return { label: '화요일', bg: 'bg-[#1C2B33]/10 text-[#1C2B33]' };
  if (day === 'THU') return { label: '목요일', bg: 'bg-[#8F3A24]/10 text-[#8F3A24]' };
  return { label: '화·목', bg: 'bg-[#1F6F63]/10 text-[#1F6F63]' };
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState<'ALL' | LessonDay>('ALL');
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // 신규 등록 / 수정 폼 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formName, setFormName] = useState('');
  const [formEmpNo, setFormEmpNo] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLessonDay, setFormLessonDay] = useState<LessonDay>('TUE');
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 1200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/members');
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members || []);
      } else {
        showToast('회원 목록 조회 실패');
      }
    } catch {
      showToast('데이터 불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // 신규 등록 모달 열기
  const openCreateModal = () => {
    setEditingId(null);
    setFormName('');
    setFormEmpNo('');
    setFormDept('');
    setFormPhone('');
    setFormLessonDay('TUE');
    setFormIsActive(true);
    setModalOpen(true);
  };

  // 수정 모달 열기
  const openEditModal = (m: Member) => {
    setEditingId(m.id);
    setFormName(m.name);
    setFormEmpNo(m.employee_no || '');
    setFormDept(m.department || '');
    setFormPhone(m.phone || '');
    setFormLessonDay(m.lesson_day || 'TUE');
    setFormIsActive(m.is_active);
    setModalOpen(true);
  };

  // 저장 (신규 등록 or 수정)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('이름을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const isEdit = editingId !== null;
      const res = await fetch('/api/admin/members', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          employee_no: formEmpNo,
          name: formName,
          department: formDept,
          phone: formPhone,
          lesson_day: formLessonDay,
          is_active: formIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '저장 실패');
        return;
      }

      showToast(isEdit ? '회원 정보가 수정되었습니다.' : '신규 회원이 등록되었습니다.');
      setModalOpen(false);
      loadMembers();
    } catch {
      showToast('네트워크 오류');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (dayFilter !== 'ALL' && m.lesson_day !== dayFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.department && m.department.toLowerCase().includes(q)) ||
      (m.phone && m.phone.includes(q)) ||
      (m.employee_no && m.employee_no.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-24 text-[#1C2B33]">
      <header className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] px-5 pt-8 pb-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AdminDrawer />
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
              회원 관리
            </h1>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex h-9 items-center gap-1.5 rounded-full bg-[#1C2B33] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#1C2B33]/90 active:scale-95 transition-all"
          >
            <span>+</span>
            <span>회원 등록</span>
          </button>
        </div>

        {/* 요일 필터 & 검색 */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {(['ALL', 'TUE', 'THU', 'BOTH'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDayFilter(d)}
                className={
                  'h-8 rounded-full px-3 text-xs font-semibold transition-colors ' +
                  (dayFilter === d
                    ? 'bg-[#1C2B33] text-white shadow-xs'
                    : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
                }
              >
                {d === 'ALL' ? '전체' : d === 'TUE' ? '화요일반' : d === 'THU' ? '목요일반' : '화·목반'}
              </button>
            ))}
          </div>

          <div className="relative w-full max-w-xs">
            <input
              type="text"
              placeholder="이름, 부서, 전화번호 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-[#1C2B33]/20 bg-white px-4 py-1.5 text-xs text-[#1C2B33] placeholder:text-[#1C2B33]/40 focus:border-[#1C2B33] focus:outline-none shadow-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#1C2B33]/40 hover:text-[#1C2B33]"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        <div className="rounded-3xl border border-[#1C2B33]/10 bg-white p-5 shadow-[0_4px_20px_rgba(28,43,51,0.04)] sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-bold text-[#1C2B33]/70">
              총 {filteredMembers.length}명
            </span>
          </div>

          {loading ? (
            <p className="py-12 text-center text-sm text-[#1C2B33]/50">불러오는 중...</p>
          ) : filteredMembers.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#1C2B33]/50">
              {search ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {filteredMembers.map((m) => {
                const dayTag = getLessonDayLabel(m.lesson_day);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-2xl border border-[#1C2B33]/10 bg-[#FAFAF7]/50 p-4 transition-all hover:border-[#1C2B33]/30 hover:bg-[#FAFAF7]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#1C2B33]">{m.name}</span>
                        <span className={'rounded-md px-1.5 py-0.5 text-[10px] font-bold ' + dayTag.bg}>
                          {dayTag.label}
                        </span>
                        {!m.is_active && (
                          <span className="rounded-md bg-[#B5482F]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#B5482F]">
                            비활성
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[#1C2B33]/60">
                        {m.department || '부서 미입력'}
                      </div>
                      <div className="mt-0.5 font-[family-name:var(--font-mono-club)] text-xs text-[#1C2B33]/40">
                        {displayPhone(m.phone)}
                      </div>
                    </div>

                    {/* 🎯 수정 버튼 */}
                    <button
                      type="button"
                      onClick={() => openEditModal(m)}
                      className="ml-3 shrink-0 rounded-full border border-[#1C2B33]/15 bg-white px-3 py-1 text-xs font-semibold text-[#1C2B33]/70 hover:bg-[#1C2B33]/5 active:scale-95 transition-all"
                    >
                      수정
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* 🎯 회원 등록 / 수정 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[#1C2B33]">
              {editingId !== null ? '회원 정보 수정' : '신규 회원 등록'}
            </h3>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1C2B33]/70">
                  이름 <span className="text-[#B5482F]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="홍길동"
                  className="mt-1 w-full rounded-xl border border-[#1C2B33]/20 px-3 py-2 text-sm focus:border-[#1C2B33] focus:outline-none"
                />
              </div>

              {/* 🎯 레슨 요일 선택 (화 / 목 / 화목) */}
              <div>
                <label className="block text-xs font-bold text-[#1C2B33]/70">
                  레슨 요일 <span className="text-[#B5482F]">*</span>
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'TUE', label: '화요일' },
                      { id: 'THU', label: '목요일' },
                      { id: 'BOTH', label: '화·목' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormLessonDay(item.id)}
                      className={
                        'h-9 rounded-xl border text-xs font-bold transition-all ' +
                        (formLessonDay === item.id
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
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    placeholder="개발팀"
                    className="mt-1 w-full rounded-xl border border-[#1C2B33]/20 px-3 py-2 text-sm focus:border-[#1C2B33] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1C2B33]/70">사번</label>
                  <input
                    type="text"
                    value={formEmpNo}
                    onChange={(e) => setFormEmpNo(e.target.value)}
                    placeholder="선택사항"
                    className="mt-1 w-full rounded-xl border border-[#1C2B33]/20 px-3 py-2 text-sm focus:border-[#1C2B33] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2B33]/70">전화번호</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  className="mt-1 w-full rounded-xl border border-[#1C2B33]/20 px-3 py-2 text-sm focus:border-[#1C2B33] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#1C2B33]"
                />
                <label htmlFor="isActiveCheck" className="text-xs font-semibold text-[#1C2B33]/80">
                  활성 회원 (시간표 배정 대상 포함)
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-[#1C2B33]/60 hover:bg-[#1C2B33]/5"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-[#1C2B33] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#1C2B33]/90 disabled:opacity-50"
                >
                  {submitting ? '저장 중...' : editingId !== null ? '수정 완료' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 블랙 테마 토스트 */}
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