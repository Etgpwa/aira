'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ────────────────────────────────────────────────────────────────
// 1. Tambah Jadwal Kuliah Baru (createCourseSchedule)
// ────────────────────────────────────────────────────────────────
export async function createCourseSchedule(data: {
    subjectName: string;
    dayOfWeek: number; // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
    startTime: string; // "HH:mm" atau "HH:mm:ss"
    endTime: string;   // "HH:mm" atau "HH:mm:ss"
    room?: string | null;           // Metode Belajar UT (BMP Mandiri, Tuweb, Tuton, dll)
    lecturer?: string | null;       // Tutor / Dosen
    targetMaterial?: string | null; // Judul Modul / KB / Catatan Target Belajar Hari Ini
    moduleId?: string | null;       // UUID Modul di course_modules jika ada
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    if (!data.subjectName?.trim()) throw new Error('Nama mata kuliah harus diisi');
    if (!data.startTime || !data.endTime) throw new Error('Jam mulai dan jam selesai harus diisi');

    const formattedStartTime = data.startTime.length === 5 ? `${data.startTime}:00` : data.startTime;
    const formattedEndTime = data.endTime.length === 5 ? `${data.endTime}:00` : data.endTime;

    // Payload dasar
    const insertPayload: any = {
        user_id: user.id,
        subject_name: data.subjectName.trim(),
        day_of_week: data.dayOfWeek,
        start_time: formattedStartTime,
        end_time: formattedEndTime,
        room: data.room?.trim() || null,
        lecturer: data.lecturer?.trim() || null
    };

    // Coba insert dengan target_material & module_id jika kolom sudah ada
    if (data.targetMaterial) insertPayload.target_material = data.targetMaterial.trim();
    if (data.moduleId) insertPayload.module_id = data.moduleId;

    let { data: newCourseSchedule, error } = await supabase
        .from('course_schedules')
        .insert(insertPayload)
        .select()
        .single();

    // Fallback jika kolom target_material / module_id belum dibuat di schema
    if (error && error.message?.includes('column')) {
        delete insertPayload.target_material;
        delete insertPayload.module_id;
        // Simpan target material ke room atau lecturer jika kosong sebagai fallback
        if (data.targetMaterial && !insertPayload.room) {
            insertPayload.room = `Target: ${data.targetMaterial}`;
        }
        const retryRes = await supabase
            .from('course_schedules')
            .insert(insertPayload)
            .select()
            .single();

        newCourseSchedule = retryRes.data;
        error = retryRes.error;
    }

    if (error) throw error;

    revalidatePath('/academic');
    revalidatePath('/productivity/agenda');
    revalidatePath('/');
    return { success: true, schedule: newCourseSchedule };
}

// ────────────────────────────────────────────────────────────────
// 2. Edit Jadwal Kuliah (updateCourseSchedule)
// ────────────────────────────────────────────────────────────────
export async function updateCourseSchedule(data: {
    id: string;
    subjectName: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string | null;
    lecturer?: string | null;
    targetMaterial?: string | null;
    moduleId?: string | null;
}) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    if (!data.subjectName?.trim()) throw new Error('Nama mata kuliah harus diisi');
    if (!data.startTime || !data.endTime) throw new Error('Jam mulai dan jam selesai harus diisi');

    const formattedStartTime = data.startTime.length === 5 ? `${data.startTime}:00` : data.startTime;
    const formattedEndTime = data.endTime.length === 5 ? `${data.endTime}:00` : data.endTime;

    const updatePayload: any = {
        subject_name: data.subjectName.trim(),
        day_of_week: data.dayOfWeek,
        start_time: formattedStartTime,
        end_time: formattedEndTime,
        room: data.room?.trim() || null,
        lecturer: data.lecturer?.trim() || null
    };

    if (data.targetMaterial !== undefined) updatePayload.target_material = data.targetMaterial?.trim() || null;
    if (data.moduleId !== undefined) updatePayload.module_id = data.moduleId || null;

    let { error } = await supabase
        .from('course_schedules')
        .update(updatePayload)
        .eq('id', data.id)
        .eq('user_id', user.id);

    // Fallback jika kolom belum dibuat
    if (error && error.message?.includes('column')) {
        delete updatePayload.target_material;
        delete updatePayload.module_id;
        const retryRes = await supabase
            .from('course_schedules')
            .update(updatePayload)
            .eq('id', data.id)
            .eq('user_id', user.id);

        error = retryRes.error;
    }

    if (error) throw error;

    revalidatePath('/academic');
    revalidatePath('/productivity/agenda');
    revalidatePath('/');
    return { success: true };
}

// ────────────────────────────────────────────────────────────────
// 3. Hapus Jadwal Kuliah (deleteCourseSchedule)
// ────────────────────────────────────────────────────────────────
export async function deleteCourseSchedule(id: string) {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Tidak terautentikasi');

    const { error } = await supabase
        .from('course_schedules')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) throw error;

    revalidatePath('/academic');
    revalidatePath('/productivity/agenda');
    revalidatePath('/');
    return { success: true };
}
