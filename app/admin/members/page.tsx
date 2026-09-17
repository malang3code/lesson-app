'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  const [currentTerm] = useState('2026-09'); // 기본 기수
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmpNo, setEditingEmpNo] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formEmpNo, setFormEmpNo] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLessonDay, setFormLessonDay] = useState<LessonDay>('TUE');
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
      const res = await fetch(`/api/admin/members?term=${currentTerm}`);
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
  }, [currentTerm, showToast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const openCreateModal = () => {
    setEditingEmpNo(null);
    setFormName('');
    setFormEmpNo('');
    setFormDept('');
    setFormPhone('');
    setFormLessonDay('TUE');
    setModalOpen(true);
  };

  const openEditModal = (m: Member) => {
    setEditingEmpNo(m.employee_no);
    setFormName(m.name);
    setFormEmpNo(m.employee_no || '');
    setFormDept(m.department || '');
    setFormPhone(m.phone || '');
    setFormLessonDay(m.lesson_day || 'TUE');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmpNo.trim()) {
      showToast('사번과 이름을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_no: formEmpNo,
          name: formName,
          department: formDept,
          phone: formPhone,
          lesson_day: formLessonDay,
          term: currentTerm,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '저장 실패');
        return;
      }

      showToast('저장되었습니다.');
      setModalOpen(false);
      loadMembers();
    } catch {
      showToast('네트워크 오류');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (employeeNo: string, name: string) => {
    if (!confirm(`'${name}' 회원을 이번 기수(${currentTerm}) 명단에서 제외하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/admin/members?employee_no=${employeeNo}&term=${currentTerm}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadMembers();
        showToast('제외되었습니다.');
      } else {
        showToast('삭제 실패');
      }
    } catch {
      showToast('네트워크 오류');
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

          <div className="flex items-center gap-2">
            {/* 🎯 화면 전환 버튼 */}
            <div className="flex rounded-full border border-[#1C2B33]/15 bg-white p-1 shadow-xs">
              <span className="rounded-full bg-[#1C2B33] px-3.5 py-1.5 text-xs font-bold text-white">
                기수별 수강생
              </span>
              <Link
                href="/admin/settings/members"
                className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#1C2B33]/60 hover:text-[#1C2B33]"
              >
                전체 마스터 명단
              </Link>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="flex h-9 items-center gap-1.5 rounded-full bg-[#1C2B33] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#1C2B33]/90 active:scale-95 transition-all"
            >
              <span>+</span>
              <span>수강생 등록</span>
            </button>
          </div>
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
              {currentTerm} 기수 총 {filteredMembers.length}명
            </span>
          </div>

          {loading ? (
            <p className="py-12 text-center text-sm text-[#1C2B33]/50">불러오는 중...</p>
          ) : filteredMembers.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#1C2B33]/50">
              {search ? '검색 결과가 없습니다.' : '등록된 수강생이 없습니다.'}
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
                      </div>
                      <div className="mt-1 text-xs text-[#1C2B33]/60">
                        {m.department || '부서 미입력'} ({m.employee_no})
                      </div>
                      <div className="mt-0.5 font-[family-name:var(--font-mono-club)] text-xs text-[#1C2B33]/40">
                        {displayPhone(m.phone)}
                      </div>
                    </div>

                    <div className="ml-3 flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(m)}
                        className="rounded-full border border-[#1C2B33]/15 bg-white px-2.5 py-1 text-xs font-semibold text-[#1C2B33]/70 hover:bg-[#1C2B33]/5"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(m.employee_no, m.name)}
                        className="rounded-full px-2 py-1 text-xs text-[#B5482F] hover:bg-[#B5482F]/10"
                      >
                        제외
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* 등록 / 수정 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[#1C2B33]">
              {editingEmpNo !== null ? '수강생 정보 수정' : '신규 수강생 등록'}
            </h3>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1C2B33]/70">
                  사번 <span className="text-[#B5482F]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formEmpNo}
                  onChange={(e) => setFormEmpNo(e.target.value)}
                  placeholder="20190413"
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
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="홍길동"
                  className="mt-1 w-full rounded-xl border border-[#1C2B33]/20 px-3 py-2 text-sm focus:border-[#1C2B33] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2B33]/70">
                  레슨 요일 <span className="text-[#B5482F]">*</span>
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {([
                    { id: 'TUE', label: '화요일' },
                    { id: 'THU', label: '목요일' },
                    { id: 'BOTH', label: '화·목' },
                  ] as const).map((item) => (
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
                  <label className="block text-xs font-bold text-[#1C2B33]/70">전화번호</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="01012345678"
                    className="mt-1 w-full rounded-xl border border-[#1C2B33]/20 px-3 py-2 text-sm focus:border-[#1C2B33] focus:outline-none"
                  />
                </div>
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
                  {submitting ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-[#1C2B33] px-4 py-3 text-sm font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage('')} className="text-xs text-white/50 hover:text-white">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}