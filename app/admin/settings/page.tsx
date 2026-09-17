'use client';

import { useState, useEffect, useCallback } from 'react';

type Member = {
  id: number;
  name: string;
  department: string | null;
  phone: string | null;
  employee_no: string | null;
};

function displayPhone(phoneStr: string | null | undefined): string {
  if (!phoneStr) return '-';
  const clean = phoneStr.replace(/[^0-9]/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  return phoneStr;
}

export default function MembersSettingsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<{
    id: number;
    name: string;
    employee_no: string;
    department: string;
    phone: string;
  } | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 1500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/members');
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members ?? []);
      } else {
        showToast(data.error || '회원 목록을 불러오지 못했습니다.');
      }
    } catch {
      showToast('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleDeleteMember = async (id: number, name: string) => {
    if (!confirm(`'${name}' 회원을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/admin/settings/members?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadMembers();
        showToast('회원이 삭제되었습니다.');
      } else {
        const data = await res.json();
        showToast(data.error || '삭제 실패');
      }
    } catch {
      showToast('삭제 중 오류가 발생했습니다.');
    }
  };

  const openEditModal = (m: Member) => {
    setEditingMember({
      id: m.id,
      name: m.name,
      employee_no: m.employee_no ?? '',
      department: m.department ?? '',
      phone: m.phone ?? '',
    });
    setEditModalOpen(true);
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    if (!editingMember.name.trim() || !editingMember.employee_no.trim()) {
      showToast('이름과 사번은 필수 항목입니다.');
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
        loadMembers();
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

  if (loading) return <p className="text-xs text-[#1C2B33]/40">불러오는 중...</p>;

  return (
    <div className="max-w-xl space-y-3 pb-20 text-xs">
      {/* 안내 문구 */}
      <div className="rounded-xl border border-[#1C2B33]/15 bg-[#FAFAF7] px-3 py-2 text-[11px] text-[#1C2B33]/70 shadow-2xs">
        ℹ️ 마스터 회원 명단입니다. 신규 회원은 <b>레슨 신청 및 승인</b> 시 자동 등록됩니다.
      </div>

      {/* 회원 목록 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-[#1C2B33]/15 bg-white shadow-2xs">
        <table className="w-full text-center text-xs">
          <thead className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] font-[family-name:var(--font-mono-club)] text-[#1C2B33]/60">
            <tr>
              <th className="py-2.5 px-2 text-center w-20">사번</th>
              <th className="py-2.5 px-2 text-center w-16">이름</th>
              <th className="py-2.5 px-2 text-center w-24">전화번호</th>
              <th className="py-2.5 px-3 text-left">부서</th>
              <th className="py-2.5 px-2 text-center w-20">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1C2B33]/5">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-[#FAFAF7]/60 transition-colors">
                <td className="py-2 px-2 text-center font-semibold text-[#1C2B33] whitespace-nowrap">
                  {m.employee_no ?? '-'}
                </td>
                <td className="py-2 px-2 text-center font-medium text-[#1C2B33] whitespace-nowrap">{m.name}</td>
                <td className="py-2 px-2 text-center font-[family-name:var(--font-mono-club)] text-[#1C2B33]/70 whitespace-nowrap">
                  {displayPhone(m.phone)}
                </td>
                <td className="py-2 px-3 text-left text-[#1C2B33]/70 truncate font-normal">
                  {m.department ?? '-'}
                </td>
                <td className="py-2 px-2 text-center whitespace-nowrap space-x-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(m)}
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-[#1C2B33]/70 hover:bg-[#1C2B33]/5 cursor-pointer"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(m.id, m.name)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-[#B5482F] hover:bg-[#B5482F]/10 cursor-pointer"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-[#1C2B33]/40">
                  등록된 회원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 수정 모달 */}
      {editModalOpen && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-xs">
            <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[#1C2B33]">
              회원 정보 수정
            </h3>

            <form onSubmit={handleUpdateMember} className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#1C2B33]/70">
                    사번 <span className="text-[#B5482F]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingMember.employee_no}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, employee_no: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-[#1C2B33]/20 px-2.5 py-1.5 text-xs focus:border-[#1C2B33] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#1C2B33]/70">
                    이름 <span className="text-[#B5482F]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingMember.name}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, name: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-[#1C2B33]/20 px-2.5 py-1.5 text-xs focus:border-[#1C2B33] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#1C2B33]/70">부서</label>
                  <input
                    type="text"
                    value={editingMember.department}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, department: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-[#1C2B33]/20 px-2.5 py-1.5 text-xs focus:border-[#1C2B33] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#1C2B33]/70">전화번호</label>
                  <input
                    type="tel"
                    maxLength={11}
                    value={editingMember.phone}
                    onChange={(e) => {
                      const onlyNums = e.target.value.replace(/[^0-9]/g, '');
                      setEditingMember({ ...editingMember, phone: onlyNums });
                    }}
                    className="mt-1 w-full rounded-lg border border-[#1C2B33]/20 px-2.5 py-1.5 text-xs focus:border-[#1C2B33] focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-[#1C2B33]/60 hover:bg-[#1C2B33]/5 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="rounded-full bg-[#1C2B33] px-4 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-[#1C2B33]/90 disabled:opacity-50 cursor-pointer"
                >
                  {submittingEdit ? '저장 중...' : '수정 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-[#1C2B33] px-3 py-2 text-[11px] font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage('')} className="text-[11px] text-white/50 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}