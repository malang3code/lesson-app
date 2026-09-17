'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface RecruitmentSetting {
  id: number;
  is_open: boolean;
  term_month: string;
  notice: string | null;
  available_times?: string[];
}

export default function RecruitmentSettingsPage() {
  const [setting, setSetting] = useState<RecruitmentSetting | null>(null);
  const [availableTerms, setAvailableTerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 폼 상태
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [notice, setNotice] = useState('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 1500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingRes, termsRes] = await Promise.all([
        fetch('/api/recruitment'),
        fetch('/api/admin/terms'),
      ]);

      const settingData = await settingRes.json();
      const termsData = await termsRes.json();

      const termsList: string[] = termsData.terms ?? [];
      setAvailableTerms(termsList);

      if (settingRes.ok && settingData) {
        setSetting(settingData);
        setIsOpen(Boolean(settingData.is_open));
        const currentTermMonth = settingData.term_month || settingData.current_term || '';
        setSelectedTerm(currentTermMonth);
        setNotice(settingData.notice || '');

        if (currentTermMonth && !termsList.includes(currentTermMonth)) {
          setAvailableTerms([currentTermMonth, ...termsList]);
        }
      } else {
        showToast(settingData.error || '설정 조회 실패');
      }
    } catch {
      showToast('데이터 불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTermChange = (term: string) => {
    setSelectedTerm(term);
    if (term) {
      setNotice(`[${term}] 레슨 신청이 시작되었습니다. 희망하시는 요일과 시간을 선택해 주세요.`);
    } else {
      setNotice('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerm) {
      alert('모집 기수를 선택해 주세요.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/recruitment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_open: isOpen,
          term_month: selectedTerm,
          notice: notice.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('모집 설정이 저장되었습니다.');
        setSetting(data.setting);
      } else {
        showToast(data.error || '저장 실패');
      }
    } catch {
      showToast('네트워크 오류');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-3 pb-20 text-xs">
      {/* 본문 폼 카드 */}
      <div className="rounded-xl border border-[#1C2B33]/15 bg-white p-3.5 shadow-2xs">
        {loading ? (
          <div className="py-6 text-center text-xs text-[#1C2B33]/40 animate-pulse">
            모집 설정을 불러오는 중...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3.5">
            {/* 1. 수강 신청 모집 활성화 스위치 */}
            <div className="flex items-center justify-between border-b border-[#1C2B33]/10 pb-3">
              <div>
                <span className="block text-xs font-bold text-[#1C2B33]">
                  수강 신청 모집 활성화
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className={
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ' +
                  (isOpen ? 'bg-[#1F6F63]' : 'bg-[#1C2B33]/20')
                }
              >
                <span
                  className={
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ' +
                    (isOpen ? 'translate-x-4' : 'translate-x-0')
                  }
                />
              </button>
            </div>

            {/* 2. 대상 기수 선택 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#1C2B33]">
                  모집 대상 기수 <span className="text-[#B5482F]">*</span>
                </label>
                <Link
                  href="/admin/calendar"
                  className="text-[11px] font-semibold text-[#1F6F63] hover:underline"
                >
                  캘린더에서 새 기수 생성 ↗
                </Link>
              </div>

              {availableTerms.length === 0 ? (
                <div className="rounded-lg border border-[#C98A2B]/30 bg-[#FFF8E7] p-2.5 text-[11px] text-[#A06C18]">
                  등록된 기수가 없습니다. <strong>레슨일 관리</strong>에서 월별 기수를 등록해 주세요.
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedTerm}
                    onChange={(e) => handleTermChange(e.target.value)}
                    className="h-8 w-full appearance-none rounded-lg border border-[#1C2B33]/20 bg-[#FAFAF7]/60 pl-2.5 pr-7 font-[family-name:var(--font-mono-club)] text-xs font-semibold text-[#1C2B33] focus:border-[#1C2B33] focus:bg-white focus:outline-none transition-all cursor-pointer"
                    required
                  >
                    <option value="">기수를 선택하세요</option>
                    {availableTerms.map((term) => (
                      <option key={term} value={term}>
                        {term} 기수
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#1C2B33]/40">
                    ▼
                  </div>
                </div>
              )}
              <p className="mt-1 text-[10px] text-[#1C2B33]/50">
                * 레슨일 관리에서 일정을 등록한 기수 목록이 자동으로 표시됩니다.
              </p>
            </div>

            {/* 3. 공지사항 / 안내 문구 */}
            <div>
              <label className="block text-xs font-bold text-[#1C2B33] mb-1">
                모집 안내 문구 (선택)
              </label>
              <textarea
                value={notice}
                onChange={(e) => setNotice(e.target.value)}
                rows={2}
                placeholder="수강생 신청 화면 상단 또는 마감 시 노출될 공지사항을 입력하세요."
                className="w-full rounded-lg border border-[#1C2B33]/20 bg-[#FAFAF7]/60 p-2.5 text-xs text-[#1C2B33] placeholder:text-[#1C2B33]/30 focus:border-[#1C2B33] focus:bg-white focus:outline-none transition-all resize-none"
              />
            </div>

            {/* 저장 버튼 */}
            <div className="pt-1 flex justify-end">
              <button
                type="submit"
                disabled={saving || availableTerms.length === 0}
                className="h-7 px-4 rounded-full bg-[#1C2B33] text-xs font-bold text-white shadow-2xs hover:bg-[#1C2B33]/90 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
              >
                {saving ? '저장 중...' : '모집 설정 저장하기'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 토스트 메시지 */}
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