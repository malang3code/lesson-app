'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface RecruitmentSetting {
  is_open: boolean;
  current_term: string;
  notice?: string;
  available_times?: string[];
}

// 🎯 UTF-8 바이트 수 계산 헬퍼 함수
function getUtf8BytesLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x0080) {
      bytes += 1;
    } else if (code < 0x0800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // surrogate pair
      i++;
      bytes += 4;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

export default function ApplyPage() {
  const [setting, setSetting] = useState<RecruitmentSetting | null>(null);
  const [loading, setLoading] = useState(true);

  // 입력 폼 상태
  const [employeeNo, setEmployeeNo] = useState('');
  const [isCheckingEmployee, setIsCheckingEmployee] = useState(false);
  const [employeeChecked, setEmployeeChecked] = useState(false);
  const [isExistingMember, setIsExistingMember] = useState(false);

  // 사용자 정보
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');

  // 희망 조건
  const [preferredDay, setPreferredDay] = useState<'TUE_ONLY' | 'THU_ONLY' | 'ANY'>('ANY');
  const [preferredTime1, setPreferredTime1] = useState('');
  const [preferredTime2, setPreferredTime2] = useState('');
  const [notes, setNotes] = useState('');

  // 제출 상태
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function fetchRecruitment() {
      try {
        const res = await fetch('/api/recruitment');
        const data = await res.json();
        if (res.ok) {
          setSetting(data);
        } else {
          setErrorMessage(data.error || '모집 설정을 불러올 수 없습니다.');
        }
      } catch {
        setErrorMessage('서버와 통신할 수 없습니다.');
      } finally {
        setLoading(false);
      }
    }
    fetchRecruitment();
  }, []);

  // 사번 확인 로직
  const handleCheckEmployee = async () => {
    const cleanEmpNo = employeeNo.trim();

    if (!cleanEmpNo) {
      alert('사번을 입력해 주세요.');
      return;
    }
    if (!/^\d{8}$/.test(cleanEmpNo)) {
      alert('사번은 숫자 8자리여야 합니다.');
      return;
    }

    setIsCheckingEmployee(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/apply/check-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_no: cleanEmpNo }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '사번 조회에 실패했습니다.');
      }

      setEmployeeChecked(true);

      if (data.exists && data.member) {
        setIsExistingMember(true);
        setName(data.member.name || '');
        setDepartment(data.member.department || '');
        setPhone((data.member.phone || '').replace(/[^0-9]/g, ''));
      } else {
        setIsExistingMember(false);
        setName('');
        setDepartment('');
        setPhone('');
      }
    } catch (err: any) {
      alert(err.message || '사번 확인 중 오류가 발생했습니다.');
    } finally {
      setIsCheckingEmployee(false);
    }
  };

  // 🎯 기타 요청사항 변경 핸들러 (최대 66바이트 제한)
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    // 한 글자씩 타이핑하면서 바이트 체크 (66바이트 초과 시 자르기 또는 입력 방지)
    let currentBytes = 0;
    let slicedVal = '';

    for (let i = 0; i < val.length; i++) {
      const code = val.charCodeAt(i);
      let charBytes = 1;
      if (code >= 0x0080 && code < 0x0800) {
        charBytes = 2;
      } else if (code >= 0x0800 || (code >= 0xd800 && code <= 0xdbff)) {
        if (code >= 0xd800 && code <= 0xdbff) i++;
        charBytes = 3;
      }

      if (currentBytes + charBytes > 66) {
        break;
      }
      currentBytes += charBytes;
      slicedVal += val[i];
    }

    setNotes(slicedVal);
  };

  // 신청서 제출 로직
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeChecked) {
      alert('먼저 사번 확인을 진행해 주세요.');
      return;
    }

    const cleanEmpNo = employeeNo.trim();
    if (!/^\d{8}$/.test(cleanEmpNo)) {
      alert('사번은 숫자 8자리여야 합니다.');
      return;
    }

    if (!isExistingMember) {
      if (!name.trim()) return alert('이름을 입력해 주세요.');
      if (!department.trim()) return alert('부서를 입력해 주세요.');
      
      const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
      if (!/^\d{11}$/.test(cleanPhone)) {
        return alert('전화번호는 숫자 11자리여야 합니다. (예: 01012345678)');
      }
    }

    // 🎯 최종 제출 전 바이트 안전 검증 (66바이트)
    if (getUtf8BytesLength(notes) > 66) {
      alert('기타 요청사항은 최대 66바이트(한글 기준 약 22자)까지만 입력 가능합니다.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_no: cleanEmpNo,
          name,
          department,
          phone: phone.replace(/[^0-9]/g, ''),
          preferred_day: preferredDay,
          preferred_time_1: preferredTime1,
          preferred_time_2: preferredTime2,
          notes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '신청 접수에 실패했습니다.');
      }

      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || '신청 접수 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#FAFAF7] flex items-center justify-center text-sm font-medium text-[#1C2B33]/40 animate-pulse">
        모집 정보를 확인하고 있습니다...
      </div>
    );
  }

  // 1. 모집 마감 상태
  if (!setting?.is_open) {
    return (
      <div className="min-h-dvh bg-[#FAFAF7] pb-8 text-[#1C2B33] overscroll-y-none">
        <header className="w-full max-w-lg px-4 pt-4 pb-1 sm:px-6">
          <div className="mb-4">
            <Link
              href="/"
              className="inline-flex h-7 items-center gap-1 rounded-full border border-[#1C2B33]/15 bg-white px-3 text-xs font-semibold text-[#1C2B33]/80 shadow-2xs hover:bg-[#1C2B33]/5 transition-all"
            >
              ← 홈으로 돌아가기
            </Link>
          </div>
        </header>

        <main className="w-full max-w-lg px-4 pt-1.5 pb-4 sm:px-6">
          <div className="rounded-2xl border border-[#1C2B33]/10 bg-white p-6 shadow-[0_1px_2px_rgba(28,43,51,0.04)]">
            <div className="flex items-center gap-2 text-[#B5482F] font-bold text-base mb-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#B5482F]/10 text-xs">!</span>
              <span>현재 모집 기간이 아닙니다</span>
            </div>
            <p className="text-xs text-[#1C2B33]/65 leading-relaxed mb-6">
              {setting?.notice || '현재는 레슨 수강생 모집 기간이 아닙니다. 다음 모집 공지를 확인해 주세요.'}
            </p>
            <Link
              href="/"
              className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#1C2B33] text-xs font-bold text-white shadow-2xs hover:bg-[#253943] active:scale-95 transition-all"
            >
              홈으로 이동
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // 2. 제출 완료 상태
  if (submitted) {
    return (
      <div className="min-h-dvh bg-[#FAFAF7] pb-8 text-[#1C2B33] overscroll-y-none">
        <header className="w-full max-w-lg px-4 pt-4 pb-1 sm:px-6">
          <div className="mb-4">
            <Link
              href="/"
              className="inline-flex h-7 items-center gap-1 rounded-full border border-[#1C2B33]/15 bg-white px-3 text-xs font-semibold text-[#1C2B33]/80 shadow-2xs hover:bg-[#1C2B33]/5 transition-all"
            >
              ← 홈으로 돌아가기
            </Link>
          </div>
        </header>

        <main className="w-full max-w-lg px-4 pt-1.5 pb-4 sm:px-6">
          <div className="rounded-2xl border border-[#1F6F63]/30 bg-white p-6 shadow-[0_1px_2px_rgba(28,43,51,0.04)]">
            <div className="flex items-center gap-2 text-[#1F6F63] font-bold text-lg mb-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#E8F3EE] text-xs">✓</span>
              <span>수강 신청 완료</span>
            </div>
            <p className="text-sm font-semibold text-[#1F6F63] mb-1">
              [{setting.current_term} 레슨] 신청서가 정상 접수되었습니다.
            </p>
            <p className="text-xs text-[#1C2B33]/60 mb-6">
              레슨 배정이 완료 된 후 별도로 공지드리겠습니다.
            </p>
            <Link
              href="/"
              className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#1F6F63] text-xs font-bold text-white shadow-2xs hover:bg-[#1F6F63]/90 active:scale-95 transition-all"
            >
              확인
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const times = setting?.available_times || [];
  const notesByteLength = getUtf8BytesLength(notes);

  return (
    <div className="min-h-dvh bg-[#FAFAF7] pb-8 text-[#1C2B33] overscroll-y-none">
      {/* 🎯 상단 헤더: max-w-lg (512px) */}
      <header className="w-full max-w-lg px-4 pt-4 pb-1 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-7 items-center gap-1 rounded-full border border-[#1C2B33]/15 bg-white px-2.5 text-xs font-semibold text-[#1C2B33]/80 shadow-2xs hover:bg-[#1C2B33]/5 transition-all"
            >
              ← 홈
            </Link>
            <h1 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[#1C2B33]">
              레슨 수강 신청
            </h1>
          </div>

          <span className="inline-flex h-7 items-center rounded-full border border-[#C98A2B]/40 bg-[#FFF8E7] px-2.5 font-[family-name:var(--font-mono-club)] text-xs font-bold text-[#A06C18]">
            {setting.current_term} 레슨 모집
          </span>
        </div>
        <p className="mt-2 text-xs font-medium text-[#1C2B33]/50">
          사번을 입력하시면 기존 등록 정보를 확인하여 빠르게 신청하실 수 있습니다.
        </p>
      </header>

      {/* 🎯 본문 영역: max-w-lg (512px) */}
      <main className="w-full max-w-lg px-4 pt-2 pb-4 sm:px-6">
        <div className="rounded-2xl border border-[#1C2B33]/10 bg-white p-4 shadow-[0_1px_2px_rgba(28,43,51,0.04)] space-y-4">
          {errorMessage && (
            <div className="rounded-xl border border-[#B5482F]/30 bg-white p-2.5 text-xs font-semibold text-[#B5482F]">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. 사번 입력 및 확인 */}
            <div>
              <label className="block text-xs font-bold text-[#1C2B33] mb-1.5">
                사번 (숫자 8자리) <span className="text-[#B5482F]">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={employeeNo}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/[^0-9]/g, '');
                    setEmployeeNo(onlyNums);
                    setEmployeeChecked(false);
                  }}
                  placeholder="사번 8자리 (예: 20240123)"
                  className="flex-1 h-9 rounded-xl border border-[#1C2B33]/15 bg-[#FAFAF7]/60 px-3 font-[family-name:var(--font-mono-club)] text-sm font-semibold text-[#1C2B33] placeholder:text-[#1C2B33]/30 transition-all focus:border-[#1C2B33] focus:bg-white focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={handleCheckEmployee}
                  disabled={isCheckingEmployee || employeeNo.length !== 8}
                  className="h-9 px-3.5 rounded-xl border border-[#1C2B33]/15 bg-white text-xs font-semibold text-[#1C2B33] shadow-2xs hover:bg-[#1C2B33]/5 active:scale-95 disabled:opacity-40 transition-all whitespace-nowrap cursor-pointer"
                >
                  {isCheckingEmployee ? '확인 중...' : '사번 확인'}
                </button>
              </div>

              {employeeChecked && (
                <div className="mt-2 text-xs font-medium">
                  {isExistingMember ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#1F6F63]/30 bg-[#E8F3EE] px-2.5 py-0.5 text-[#1F6F63] font-semibold">
                      ✓ 등록 회원 확인 ({name} / {department})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#C98A2B]/40 bg-[#FFF8E7] px-2.5 py-0.5 text-[#A06C18] font-semibold">
                      ℹ 신규 신청자입니다. 상세 정보를 입력해 주세요.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 2. 추가 정보 입력 영역 */}
            {employeeChecked && (
              <div className="space-y-4 pt-3 border-t border-[#1C2B33]/10 animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-bold text-[#1C2B33] mb-1">
                    이름 <span className="text-[#B5482F]">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isExistingMember}
                    placeholder="홍길동"
                    className="w-full h-9 rounded-xl border border-[#1C2B33]/15 bg-[#FAFAF7]/60 px-3 text-sm text-[#1C2B33] disabled:text-[#1C2B33]/45 disabled:bg-[#FAFAF7] focus:border-[#1C2B33] focus:bg-white focus:outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1C2B33] mb-1">
                    부서 <span className="text-[#B5482F]">*</span>
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={isExistingMember}
                    placeholder="개발팀"
                    className="w-full h-9 rounded-xl border border-[#1C2B33]/15 bg-[#FAFAF7]/60 px-3 text-sm text-[#1C2B33] disabled:text-[#1C2B33]/45 disabled:bg-[#FAFAF7] focus:border-[#1C2B33] focus:bg-white focus:outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1C2B33] mb-1">
                    연락처 (숫자 11자리) <span className="text-[#B5482F]">*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    value={phone}
                    onChange={(e) => {
                      const onlyNums = e.target.value.replace(/[^0-9]/g, '');
                      setPhone(onlyNums);
                    }}
                    disabled={isExistingMember}
                    placeholder="01012345678"
                    className="w-full h-9 rounded-xl border border-[#1C2B33]/15 bg-[#FAFAF7]/60 px-3 font-[family-name:var(--font-mono-club)] text-sm text-[#1C2B33] disabled:text-[#1C2B33]/45 disabled:bg-[#FAFAF7] focus:border-[#1C2B33] focus:bg-white focus:outline-none transition-all"
                    required
                  />
                </div>

                {/* 3. 희망 요일 선택 */}
                <div className="pt-1">
                  <label className="block text-xs font-bold text-[#1C2B33] mb-1.5">
                    희망 요일 <span className="text-[#B5482F]">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreferredDay('TUE_ONLY')}
                      className={
                        'flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-semibold transition-all cursor-pointer ' +
                        (preferredDay === 'TUE_ONLY'
                          ? 'bg-[#1C2B33] text-white shadow-2xs'
                          : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
                      }
                    >
                      화요일
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreferredDay('THU_ONLY')}
                      className={
                        'flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-semibold transition-all cursor-pointer ' +
                        (preferredDay === 'THU_ONLY'
                          ? 'bg-[#1C2B33] text-white shadow-2xs'
                          : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
                      }
                    >
                      목요일
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreferredDay('ANY')}
                      className={
                        'flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-semibold transition-all cursor-pointer ' +
                        (preferredDay === 'ANY'
                          ? 'bg-[#1C2B33] text-white shadow-2xs'
                          : 'border border-[#1C2B33]/15 bg-white text-[#1C2B33]/70 hover:bg-[#1C2B33]/5')
                      }
                    >
                      상관없음
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#1C2B33]/45 leading-relaxed">
                    * 신청 현황을 고려해 실제 레슨은 차이가 있을 수 있습니다.
                  </p>
                </div>

                {/* 4. 선호 시작 시간 드롭다운 */}
                <div className="pt-1">
                  <label className="block text-xs font-bold text-[#1C2B33] mb-1.5">
                    선호 시작 시간 (선택 / 시간표 편성 참고용)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[11px] font-semibold text-[#1C2B33]/50 mb-1">1지망</span>
                      <div className="relative">
                        <select
                          value={preferredTime1}
                          onChange={(e) => setPreferredTime1(e.target.value)}
                          className="h-9 w-full appearance-none rounded-xl border border-[#1C2B33]/15 bg-[#FAFAF7]/60 pl-3 pr-6 text-xs font-semibold text-[#1C2B33] focus:border-[#1C2B33] focus:bg-white focus:outline-none transition-all"
                        >
                          <option value="">선택 안 함</option>
                          {times.map((t) => (
                            <option key={`t1-${t}`} value={t}>
                              {t} 시작
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px] text-[#1C2B33]/40">
                          ▼
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-[#1C2B33]/50 mb-1">2지망</span>
                      <div className="relative">
                        <select
                          value={preferredTime2}
                          onChange={(e) => setPreferredTime2(e.target.value)}
                          className="h-9 w-full appearance-none rounded-xl border border-[#1C2B33]/15 bg-[#FAFAF7]/60 pl-3 pr-6 text-xs font-semibold text-[#1C2B33] focus:border-[#1C2B33] focus:bg-white focus:outline-none transition-all"
                        >
                          <option value="">선택 안 함</option>
                          {times.map((t) => (
                            <option key={`t2-${t}`} value={t}>
                              {t} 시작
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px] text-[#1C2B33]/40">
                          ▼
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. 비고 (66바이트 제한 적용) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#1C2B33]">
                      기타 요청사항 (선택)
                    </label>
                    <span className="font-[family-name:var(--font-mono-club)] text-[10px] text-[#1C2B33]/50">
                      <strong>{notesByteLength}</strong> / 66 바이트
                    </span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={handleNotesChange}
                    rows={2}
                    placeholder="특이사항이나 문의사항이 있다면 남겨주세요."
                    className="w-full rounded-xl border border-[#1C2B33]/15 bg-[#FAFAF7]/60 p-2.5 text-xs text-[#1C2B33] placeholder:text-[#1C2B33]/30 focus:border-[#1C2B33] focus:bg-white focus:outline-none transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-10 rounded-xl bg-[#1C2B33] text-xs font-bold text-white shadow-2xs hover:bg-[#253943] active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmitting ? '신청서 제출 중...' : '수강 신청 제출하기'}
                </button>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}