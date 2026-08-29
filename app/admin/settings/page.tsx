'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminDrawer from '@/components/AdminDrawer';

type Member = {
  id: number;
  name: string;
  department: string | null;
  phone: string | null;
  employee_no: string | null;
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

// 🎯 화면 표시용 전화번호 하이픈 헬퍼 함수 (DB 01012345678 -> 화면 010-1234-5678)
function displayPhone(phoneStr: string | null | undefined): string {
  if (!phoneStr) return '-';
  const clean = phoneStr.replace(/[^0-9]/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  return phoneStr;
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'members' | 'slots'>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  // 1초 플로팅 토스트
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

  // 신규 등록 폼
  const [newMember, setNewMember] = useState({ name: '', employee_no: '', department: '', phone: '' });
  const [newSlot, setNewSlot] = useState({ day_of_week: 2, start_time: '10:00', end_time: '10:30', capacity: 2 });

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
        setNewMember({ name: '', employee_no: '', department: '', phone: '' });
        loadData();
        showToast('수강생이 등록되었습니다.');
      } else {
        showToast(data.error || '등록 실패');
      }
    } catch {
      showToast('네트워크 오류');
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
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
              정보 관리
            </h1>
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

      <main className="max-w-4xl px-5 py-6 sm:px-8">
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
                <input
                  type="text"
                  placeholder="부서"
                  value={newMember.department}
                  onChange={(e) => setNewMember({ ...newMember, department: e.target.value })}
                  className="rounded-lg border border-[#1C2B33]/15 px-3 py-1.5 text-sm"
                />
                <input
                  type="tel"
                  placeholder="전화번호 (숫자 11자리)"
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

            <div className="overflow-hidden rounded-2xl border border-[#1C2B33]/10 bg-white shadow-[0_1px_2px_rgba(28,43,51,0.04)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] font-[family-name:var(--font-mono-club)] text-xs text-[#1C2B33]/60">
                  <tr>
                    <th className="py-3 px-4">상태</th>
                    <th className="py-3 px-4">사번</th>
                    <th className="py-3 px-4">이름</th>
                    <th className="py-3 px-4">부서</th>
                    <th className="py-3 px-4">전화번호</th>
                    <th className="py-3 px-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C2B33]/5">
                  {members.map((m) => (
                    <tr key={m.id} className={m.is_active ? '' : 'bg-[#1C2B33]/[0.02] opacity-50'}>
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleMemberActive(m)}
                          className={
                            'rounded-full px-2 py-0.5 text-xs font-semibold ' +
                            (m.is_active ? 'bg-[#1F6F63]/10 text-[#1F6F63]' : 'bg-[#1C2B33]/10 text-[#1C2B33]/50')
                          }
                        >
                          {m.is_active ? '활성' : '비활성'}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#1C2B33]">{m.employee_no ?? '-'}</td>
                      <td className="py-2.5 px-4 font-medium">{m.name}</td>
                      <td className="py-2.5 px-4 text-[#1C2B33]/60">{m.department ?? '-'}</td>
                      {/* 🎯 화면 표시 시 하이픈 포맷팅 적용 */}
                      <td className="py-2.5 px-4 font-[family-name:var(--font-mono-club)] text-[#1C2B33]/70">
                        {displayPhone(m.phone)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteMember(m.id, m.name)}
                          className="rounded px-2 py-1 text-xs text-[#B5482F] hover:bg-[#B5482F]/10"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-[#1C2B33]/40">
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

            <div className="overflow-hidden rounded-2xl border border-[#1C2B33]/10 bg-white shadow-[0_1px_2px_rgba(28,43,51,0.04)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] font-[family-name:var(--font-mono-club)] text-xs text-[#1C2B33]/60">
                  <tr>
                    <th className="py-3 px-4">요일</th>
                    <th className="py-3 px-4">시작 시간</th>
                    <th className="py-3 px-4">종료 시간</th>
                    <th className="py-3 px-4">정원</th>
                    <th className="py-3 px-4 text-right">관리</th>
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
                      <td className="py-2.5 px-4 text-right">
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

      {/* 1초 하단 플로팅 토스트 배너 */}
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