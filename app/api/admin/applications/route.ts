import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 신청 목록 조회 (term_members의 확정 요일 우선 결합)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const term = searchParams.get('term');

    let query = supabaseAdmin
      .from('lesson_applications')
      .select('*')
      .order('id', { ascending: false });

    if (term && term !== 'ALL') {
      query = query.eq('term_month', term);
    }

    const { data: applications, error } = await query;
    if (error) {
      console.error('[Applications Fetch Error]:', error);
      throw error;
    }

    if (!applications || applications.length === 0) {
      return NextResponse.json({ applications: [] });
    }

    // 🎯 각 신청 건에 대해 term_members 테이블에 저장된 실제 확정 요일 매핑
    const enrichedApplications = await Promise.all(
      applications.map(async (app) => {
        // 만약 lesson_applications 자체에 lesson_day가 없거나 비어있다면 term_members에서 조회
        if (!app.lesson_day && app.term_month && app.employee_no) {
          const { data: termMember } = await supabaseAdmin
            .from('term_members')
            .select('lesson_day')
            .eq('term_month', app.term_month)
            .eq('employee_no', app.employee_no)
            .maybeSingle();

          if (termMember?.lesson_day) {
            app.lesson_day = termMember.lesson_day;
          }
        }
        return app;
      })
    );

    return NextResponse.json({ applications: enrichedApplications });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '조회 실패' }, { status: 500 });
  }
}

// 상태 토글 (ON / OFF)
export async function PATCH(req: Request) {
  try {
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('lesson_applications')
      .update({ status })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '상태 변경 실패' }, { status: 500 });
  }
}

// 신청서 삭제
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '삭제할 ID가 없습니다.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('lesson_applications')
      .delete()
      .eq('id', Number(id));

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '삭제 실패' }, { status: 500 });
  }
}