import { supabase } from '../supabase/supabase.client';
import { normalizeIsoDate } from '../utils/date.utils';

export class TaskService {
    async addTask(params: {
        userId: string;
        title: string;
        dueDate?: string | null;
        priority?: 'HIGH' | 'MEDIUM' | 'LOW';
    }) {
        const { error } = await supabase
            .from('tasks')
            .insert({
                user_id: params.userId,
                title: params.title,
                due_date: normalizeIsoDate(params.dueDate),
                priority: params.priority || 'MEDIUM',
                status: 'TODO'
            });

        if (error) {
            console.error("Gagal menambah task:", error);
            throw error;
        }
        return true;
    }

    async completeTask(params: {
        userId: string;
        title: string;
    }) {
        const { data: task } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', params.userId)
            .ilike('title', `%${params.title}%`)
            .in('status', ['TODO', 'IN_PROGRESS'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!task) {
            return null;
        }

        const { error } = await supabase
            .from('tasks')
            .update({ status: 'DONE', updated_at: new Date().toISOString() })
            .eq('id', task.id);

        if (error) {
            console.error("Gagal menyelesaikan task:", error);
            throw error;
        }

        return task;
    }

    async deleteTask(params: {
        userId: string;
        title: string;
    }) {
        const { data: task } = await supabase
            .from('tasks')
            .select('id, title')
            .eq('user_id', params.userId)
            .ilike('title', `%${params.title}%`)
            .limit(1);

        if (!task || task.length === 0) return null;

        const { error } = await supabase.from('tasks').delete().eq('id', task[0].id);
        if (error) {
            console.error("Gagal menghapus task:", error);
            throw error;
        }

        return task[0].title;
    }
}

export const taskService = new TaskService();
