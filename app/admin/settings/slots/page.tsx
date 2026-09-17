'use client';

import { useState, useEffect, useCallback } from 'react';

type TimeSlot = {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
};

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function SlotsSettingsPage() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  const [newSlot, setNewSlot] = useState({
    day_of_week: 2,
    start_time: '10:00',
    end_time: '10:30',
    capacity: 2,
  });

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 1500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/slots');
      const data = await res.json();
      if (res.ok) setSlots(data.slots ?? []);
    } catch {
      showToast('시간대 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

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
        loadSlots();
        showToast('시간대 슬롯이 추가되었습니다.');
      } else {
        showToast(data.error || '등록 실패');
      }
    } catch {
      showToast('네트워크 오류');
    }
  };

  const handleDeleteSlot = async (id: number) => {
    if (!confirm('이 시간대 슬롯을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/admin/settings/slots?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadSlots();
        showToast('시간대 슬롯이 삭제되었습니다.');
      }
    } catch {
      showToast('삭제 실패');
    }
  };

  if (loading) return <p className="text-sm text-[#1C2B33]/40">불러오는 중...</p>;

  return (
    <div className="space-y-6">
      {/* 슬롯 추가 폼 */}
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

      {/* 테이블 */}
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