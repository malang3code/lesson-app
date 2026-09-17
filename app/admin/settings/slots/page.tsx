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

  if (loading) return <p className="text-xs text-[#1C2B33]/40">불러오는 중...</p>;

  return (
    <div className="max-w-xl space-y-3 pb-20 text-xs">
      {/* 슬롯 추가 폼 */}
      <form
        onSubmit={handleAddSlot}
        className="rounded-xl border border-[#1C2B33]/15 bg-white p-3 shadow-2xs space-y-2.5"
      >
        <h3 className="font-bold text-[#1C2B33] mb-1">+ 새 시간대 슬롯 추가</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-[#1C2B33]/60 mb-1">요일</label>
            <select
              value={newSlot.day_of_week}
              onChange={(e) => setNewSlot({ ...newSlot, day_of_week: Number(e.target.value) })}
              className="w-full h-7 rounded-lg border border-[#1C2B33]/20 bg-white px-2 text-xs font-bold text-[#1C2B33] focus:outline-none cursor-pointer"
            >
              <option value={2}>화요일</option>
              <option value={4}>목요일</option>
              <option value={1}>월요일</option>
              <option value={3}>수요일</option>
              <option value={5}>금요일</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#1C2B33]/60 mb-1">정원 (명)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={newSlot.capacity}
              onChange={(e) => setNewSlot({ ...newSlot, capacity: Number(e.target.value) })}
              required
              className="w-full h-7 rounded-lg border border-[#1C2B33]/20 px-2 text-xs font-bold text-[#1C2B33] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-[#1C2B33]/60 mb-1">시작 시간</label>
            <input
              type="time"
              value={newSlot.start_time}
              onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
              required
              className="w-full h-7 rounded-lg border border-[#1C2B33]/20 px-2 text-xs font-[family-name:var(--font-mono-club)] text-[#1C2B33] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#1C2B33]/60 mb-1">종료 시간</label>
            <input
              type="time"
              value={newSlot.end_time}
              onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
              required
              className="w-full h-7 rounded-lg border border-[#1C2B33]/20 px-2 text-xs font-[family-name:var(--font-mono-club)] text-[#1C2B33] focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-1 flex justify-end">
          <button
            type="submit"
            className="h-7 px-4 rounded-full bg-[#1C2B33] text-xs font-bold text-white shadow-2xs hover:bg-[#1C2B33]/90 active:scale-95 cursor-pointer transition-all"
          >
            슬롯 추가
          </button>
        </div>
      </form>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-[#1C2B33]/15 bg-white shadow-2xs">
        <table className="w-full text-center text-xs">
          <thead className="border-b border-[#1C2B33]/10 bg-[#FAFAF7] font-[family-name:var(--font-mono-club)] text-[#1C2B33]/60">
            <tr>
              <th className="py-2.5 px-2 text-center">요일</th>
              <th className="py-2.5 px-2 text-center">시작 시간</th>
              <th className="py-2.5 px-2 text-center">종료 시간</th>
              <th className="py-2.5 px-2 text-center">정원</th>
              <th className="py-2.5 px-2 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1C2B33]/5">
            {slots.map((s) => {
              const dowLabel = DOW_LABELS[s.day_of_week] || '';
              const isThu = s.day_of_week === 4;
              const badgeBg = isThu ? 'bg-[#8F3A24]/10 text-[#8F3A24]' : 'bg-[#1C2B33]/10 text-[#1C2B33]';

              return (
                <tr key={s.id} className="hover:bg-[#FAFAF7]/60 transition-colors">
                  <td className="py-2 px-2 text-center whitespace-nowrap">
                    <span className={'rounded px-1.5 py-0.5 text-[10px] font-bold ' + badgeBg}>
                      {dowLabel}요일
                    </span>
                  </td>
                  <td className="py-2 px-2 font-[family-name:var(--font-mono-club)] font-semibold text-[#1C2B33] whitespace-nowrap">
                    {s.start_time.slice(0, 5)}
                  </td>
                  <td className="py-2 px-2 font-[family-name:var(--font-mono-club)] font-semibold text-[#1C2B33] whitespace-nowrap">
                    {s.end_time.slice(0, 5)}
                  </td>
                  <td className="py-2 px-2 text-[#1C2B33]/80 whitespace-nowrap">
                    {s.capacity}명
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleDeleteSlot(s.id)}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[#B5482F] hover:bg-[#B5482F]/10 cursor-pointer transition-colors"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
            {slots.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-[#1C2B33]/40">
                  등록된 시간대 슬롯이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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