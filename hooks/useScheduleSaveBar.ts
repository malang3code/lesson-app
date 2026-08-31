'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

interface UseScheduleSaveBarOptions<T> {
  currentData: T;
  originalData: T;
  onSave: () => Promise<boolean | void>;
  onRevertCallback?: () => void;
  debounceMs?: number; // 기본값 1000ms
}

export function useScheduleSaveBar<T>({
  currentData,
  originalData,
  onSave,
  onRevertCallback,
  debounceMs = 1000,
}: UseScheduleSaveBarOptions<T>) {
  const [showSaveBar, setShowSaveBar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 1. 데이터 변경 여부 비교
  const isDirty = useMemo(() => {
    return JSON.stringify(currentData) !== JSON.stringify(originalData);
  }, [currentData, originalData]);

  // 2. 1초 뒤 하단 플로팅 저장 바 노출 디바운스
  useEffect(() => {
    if (!isDirty) {
      setShowSaveBar(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowSaveBar(true);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [isDirty, currentData, debounceMs]);

  // 3. 브라우저 탭 닫기/새로고침 시 이탈 방지 경고
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // 4. 토스트 알림 및 자동 닫힘 (1.2초)
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 1200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // 5. 되돌리기 핸들러
  const handleRevert = useCallback(() => {
    setShowSaveBar(false);
    onRevertCallback?.();
    showToast('원래대로 되돌렸습니다.');
  }, [onRevertCallback, showToast]);

  // 6. 일괄 저장 실행 핸들러
  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await onSave();
      if (result !== false) {
        setShowSaveBar(false);
        showToast('저장되었습니다.');
      }
    } catch {
      showToast('저장 중 네트워크 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }, [saving, onSave, showToast]);

  return {
    isDirty,
    showSaveBar,
    saving,
    toastMessage,
    showToast,
    closeToast: () => setToastMessage(''),
    handleRevert,
    handleSave,
  };
}