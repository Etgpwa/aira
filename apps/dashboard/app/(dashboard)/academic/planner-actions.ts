'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ────────────────────────────────────────────────────────────────
// 1. Simpan Tanggal Mulai Semester (setSemesterStartDate)
// ────────────────────────────────────────────────────────────────
export async function setSemesterStartDate(startDateStr: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const formattedDate = startDateStr?.trim() ? startDateStr.trim() : null;

    const { error } = await supabase
        .from('user_settings')
        .update({ semester_start_date: formattedDate })
        .eq('user_id', user.id);

    if (error) {
        console.error('Error updating semester_start_date:', error);
        throw new Error('Gagal menyimpan tanggal mulai semester');
    }

    revalidatePath('/academic');
    revalidatePath('/academic/schedule');
    revalidatePath('/productivity/agenda');
    return { success: true, semesterStartDate: formattedDate };
}

// ────────────────────────────────────────────────────────────────
// 2. Simpan / Update Target Mingguan (saveWeeklyTarget)
// ────────────────────────────────────────────────────────────────
export async function saveWeeklyTarget(payload: {
    id?: string;
    subjectName: string;
    weekNumber: number;
    topic: string;
    notes?: string | null;
    isCompleted?: boolean;
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    if (!payload.subjectName?.trim()) throw new Error('Nama mata kuliah harus diisi');
    if (!payload.weekNumber || payload.weekNumber < 1) throw new Error('Minggu/sesi perkuliahan tidak valid');
    if (!payload.topic?.trim()) throw new Error('Topik atau target KB harus diisi');

    if (payload.id) {
        // Update existing target
        const updateData: any = {
            subject_name: payload.subjectName.trim(),
            week_number: payload.weekNumber,
            topic: payload.topic.trim(),
            notes: payload.notes?.trim() || null
        };
        if (payload.isCompleted !== undefined) {
            updateData.is_completed = payload.isCompleted;
            updateData.completed_at = payload.isCompleted ? new Date().toISOString() : null;
        }

        const { data, error } = await supabase
            .from('course_weekly_targets')
            .update(updateData)
            .eq('id', payload.id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;
        revalidatePath('/academic');
        revalidatePath('/academic/schedule');
        return { success: true, data };
    } else {
        // Insert new target
        const insertData = {
            user_id: user.id,
            subject_name: payload.subjectName.trim(),
            week_number: payload.weekNumber,
            topic: payload.topic.trim(),
            notes: payload.notes?.trim() || null,
            is_completed: payload.isCompleted || false,
            completed_at: payload.isCompleted ? new Date().toISOString() : null
        };

        const { data, error } = await supabase
            .from('course_weekly_targets')
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;
        revalidatePath('/academic');
        revalidatePath('/academic/schedule');
        return { success: true, data };
    }
}

// ────────────────────────────────────────────────────────────────
// 3. Hapus Target Mingguan (deleteWeeklyTarget)
// ────────────────────────────────────────────────────────────────
export async function deleteWeeklyTarget(id: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase
        .from('course_weekly_targets')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/academic');
    revalidatePath('/academic/schedule');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 4. Toggle Status Selesai Target (toggleWeeklyTargetStatus)
// ────────────────────────────────────────────────────────────────
export async function toggleWeeklyTargetStatus(id: string, isCompleted: boolean) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase
        .from('course_weekly_targets')
        .update({
            is_completed: isCompleted,
            completed_at: isCompleted ? new Date().toISOString() : null
        })
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/academic');
    revalidatePath('/academic/schedule');
    return { success: true, isCompleted };
}

// ────────────────────────────────────────────────────────────────
// 5. Hubungkan Modul KB ke Minggu Tertentu (assignModuleToWeek)
// ────────────────────────────────────────────────────────────────
export async function assignModuleToWeek(moduleId: string, weekNumber: number | null) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase
        .from('course_modules')
        .update({ week_number: weekNumber })
        .eq('id', moduleId)
        .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/academic');
    revalidatePath('/academic/schedule');
    revalidatePath(`/academic/${moduleId}`);
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 6. Hapus Mata Kuliah & Target Terkait (deleteCoursePlan)
// ────────────────────────────────────────────────────────────────
export async function deleteCoursePlan(subjectName: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    if (!subjectName?.trim()) throw new Error('Nama mata kuliah tidak valid');

    const cleanSubject = subjectName.trim().toLowerCase();

    // 1. Ambil & hapus dari course_schedules
    const { data: scheds, error: fetchSchedErr } = await supabase
        .from('course_schedules')
        .select('id, subject_name')
        .eq('user_id', user.id);
    if (fetchSchedErr) throw fetchSchedErr;

    const schedIds = (scheds || [])
        .filter(s => s.subject_name?.trim().toLowerCase() === cleanSubject)
        .map(s => s.id);
    if (schedIds.length > 0) {
        const { error: delSchedErr } = await supabase
            .from('course_schedules')
            .delete()
            .eq('user_id', user.id)
            .in('id', schedIds);
        if (delSchedErr) throw delSchedErr;
    }

    // 2. Ambil & hapus target mingguan dari course_weekly_targets
    const { data: targets, error: fetchTargetsErr } = await supabase
        .from('course_weekly_targets')
        .select('id, subject_name')
        .eq('user_id', user.id);
    if (fetchTargetsErr) throw fetchTargetsErr;

    const targetIds = (targets || [])
        .filter(t => t.subject_name?.trim().toLowerCase() === cleanSubject)
        .map(t => t.id);
    if (targetIds.length > 0) {
        const { error: delTargetErr } = await supabase
            .from('course_weekly_targets')
            .delete()
            .eq('user_id', user.id)
            .in('id', targetIds);
        if (delTargetErr) throw delTargetErr;
    }

    // 3. Ambil modul-modul KB milik mata kuliah ini
    const { data: mods, error: fetchModsErr } = await supabase
        .from('course_modules')
        .select('id, subject_name')
        .eq('user_id', user.id);
    if (fetchModsErr) throw fetchModsErr;

    const modIds = (mods || [])
        .filter(m => m.subject_name?.trim().toLowerCase() === cleanSubject)
        .map(m => m.id);

    if (modIds.length > 0) {
        // Hapus soal kuis yang terikat ke modul-modul ini
        const { error: delQuizByModErr } = await supabase
            .from('course_quiz_questions')
            .delete()
            .eq('user_id', user.id)
            .in('module_id', modIds);
        if (delQuizByModErr) throw delQuizByModErr;

        // Hapus modul-modul KB
        const { error: delModErr } = await supabase
            .from('course_modules')
            .delete()
            .eq('user_id', user.id)
            .in('id', modIds);
        if (delModErr) throw delModErr;
    }

    // 4. Hapus soal kuis yang terikat langsung dengan subject_name ini jika ada sisa
    const { data: quizzes, error: fetchQuizErr } = await supabase
        .from('course_quiz_questions')
        .select('id, subject_name')
        .eq('user_id', user.id);
    if (!fetchQuizErr && quizzes) {
        const quizIds = quizzes
            .filter(q => q.subject_name?.trim().toLowerCase() === cleanSubject)
            .map(q => q.id);
        if (quizIds.length > 0) {
            await supabase
                .from('course_quiz_questions')
                .delete()
                .eq('user_id', user.id)
                .in('id', quizIds);
        }
    }

    revalidatePath('/academic');
    revalidatePath('/academic/schedule');
    revalidatePath('/academic/event');
    revalidatePath('/productivity/agenda');
    revalidatePath('/');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 7. Hapus Target & Unlink Modul di Minggu Tertentu (deleteWeekForSubject)
// ────────────────────────────────────────────────────────────────
export async function deleteWeekForSubject(subjectName: string, weekNumber: number) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    if (!subjectName?.trim()) throw new Error('Nama mata kuliah tidak valid');
    if (!weekNumber || weekNumber < 1) throw new Error('Nomor minggu tidak valid');

    const cleanSubject = subjectName.trim();

    // 1. Hapus target mingguan di minggu tersebut untuk mata kuliah ini
    await supabase
        .from('course_weekly_targets')
        .delete()
        .eq('user_id', user.id)
        .ilike('subject_name', cleanSubject)
        .eq('week_number', weekNumber);

    // 2. Lepas keterkaitan modul KB di minggu tersebut untuk mata kuliah ini
    await supabase
        .from('course_modules')
        .update({ week_number: null })
        .eq('user_id', user.id)
        .ilike('subject_name', cleanSubject)
        .eq('week_number', weekNumber);

    // 3. Shift target mingguan setelah minggu tersebut (week_number - 1)
    const { data: subsequentTargets } = await supabase
        .from('course_weekly_targets')
        .select('id, week_number')
        .eq('user_id', user.id)
        .ilike('subject_name', cleanSubject)
        .gt('week_number', weekNumber);

    if (subsequentTargets && subsequentTargets.length > 0) {
        for (const t of subsequentTargets) {
            await supabase
                .from('course_weekly_targets')
                .update({ week_number: t.week_number - 1 })
                .eq('id', t.id);
        }
    }

    // 4. Shift modul setelah minggu tersebut (week_number - 1)
    const { data: subsequentModules } = await supabase
        .from('course_modules')
        .select('id, week_number')
        .eq('user_id', user.id)
        .ilike('subject_name', cleanSubject)
        .gt('week_number', weekNumber);

    if (subsequentModules && subsequentModules.length > 0) {
        for (const m of subsequentModules) {
            await supabase
                .from('course_modules')
                .update({ week_number: m.week_number - 1 })
                .eq('id', m.id);
        }
    }

    revalidatePath('/academic');
    revalidatePath('/academic/schedule');
    return { success: true };
}
