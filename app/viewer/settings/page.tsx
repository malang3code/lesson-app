'use client';

import { useState, useEffect, useCallback } from 'react';
import ViewerDrawer from '../../../components/ViewerDrawer';

type Member = {
  id: number;
  name: string;
  department: string | null;
  phone: string | null;
  employee_no?: string | null;
  lesson_day?: string | null;
  lesson_time?: string | null;
};

type SlotConfig = {
  id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  capacity: number;
};

export default function ViewerSettingsPage() {
  const [activeTab, setActiveTab] = useState<'members' | 'slots'>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [slots, setSlots] = useState<SlotConfig[]>([]);
  const [loading, setLoading] = useState(false);
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

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/members');
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '회원 목록 조회 실패');
        return;
      }
      setMembers(data.members ?? []);
    } catch {
      showToast('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/slots');
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '슬롯 목록 조회 실패');
        return;
      }
      setSlots(data.slots ?? []);
    } catch {
      showToast('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab === 'members') loadMembers();
    else loadSlots();
  }, [activeTab, loadMembers, loadSlots]);

  return (
    <div className="min-h-screen bg-[#FAFAF7] pb-20 text-[#1C2B33]">
      <header className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] px-5 pt-8 pb-6 sm:px-8">
        <div className="flex items-center gap-3">
          <ViewerDrawer />
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
            정보 조회 (뷰어)
          </h1>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={
              'rounded-full px-5 py-2 text-sm font-semibold transition-colors ' +
              (activeTab === 'members'
                ? 'bg-[#1C2B33] text-white shadow-sm'
                : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
            }
          >
            수강생 목록
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('slots')}
            className={
              'rounded-full px-5 py-2 text-sm font-semibold transition-colors ' +
              (activeTab === 'slots'
                ? 'bg-[#1C2B33] text-white shadow-sm'
                : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
            }
          >
            시간대 슬롯 목록
          </button>
        </div>
      </header>

      <main className="px-5 py-6 sm:px-8">
        {activeTab === 'members' ? (
          <div className="max-w-4xl overflow-hidden rounded-3xl border border-[#1C2B33]/10 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] text-xs font-semibold text-[#1C2B33]/60">
                  <tr>
                    <th className="px-4 py-3">이름</th>
                    <th className="px-4 py-3">소속</th>
                    <th className="px-4 py-3">연락처</th>
                    <th className="px-4 py-3">고정 요일/시간</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C2B33]/5">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-[#FAFAF7]/50">
                      <td className="px-4 py-3 font-semibold">{m.name}</td>
                      <td className="px-4 py-3 text-[#1C2B33]/70">{m.department ?? '-'}</td>
                      <td className="px-4 py-3 text-[#1C2B33]/70">{m.phone ?? '-'}</td>
                      <td className="px-4 py-3 text-[#1C2B33]/70">
                        {m.lesson_day ? `${m.lesson_day}요일` : '-'} {m.lesson_time ?? ''}
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && !loading && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[#1C2B33]/40">
                        등록된 수강생이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl overflow-hidden rounded-3xl border border-[#1C2B33]/10 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] text-xs font-semibold text-[#1C2B33]/60">
                <tr>
                  <th className="px-4 py-3">요일</th>
                  <th className="px-4 py-3">시간대</th>
                  <th className="px-4 py-3">정원</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C2B33]/5">
                {slots.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FAFAF7]/50">
                    <td className="px-4 py-3 font-semibold">{s.day_of_week}요일</td>
                    <td className="px-4 py-3 font-[family-name:var(--font-mono-club)]">
                      {s.start_time.slice(0, 5)} ~ {s.end_time.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3">{s.capacity}명</td>
                  </tr>
                ))}
                {slots.length === 0 && !loading && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[#1C2B33]/40">
                      등록된 시간대 슬롯이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-[#1C2B33] px-4 py-3 text-sm font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}