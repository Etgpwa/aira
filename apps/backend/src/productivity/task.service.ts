import { supabase } from '../supabase/supabase.client';
import { normalizeIsoDate } from '../utils/date.utils';

function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

export function calculateSimilarity(query: string, target: string): number {
    const q = query.trim().toLowerCase();
    const t = target.trim().toLowerCase();

    if (q === t) return 1.0;
    if (t.includes(q)) return 0.85 + (q.length / t.length) * 0.15;
    if (q.includes(t)) return 0.8 + (t.length / q.length) * 0.15;

    // Token-based matching (e.g. "tugas web" vs "Pemrograman Web 2")
    const qTokens = q.split(/\s+/).filter(w => w.length > 1);
    const tTokens = t.split(/\s+/).filter(w => w.length > 1);
    let matchedTokens = 0;
    for (const qt of qTokens) {
        if (tTokens.some(tt => tt.includes(qt) || qt.includes(tt) || levenshteinDistance(qt, tt) <= 1)) {
            matchedTokens++;
        }
    }
    const tokenScore = qTokens.length > 0 ? (matchedTokens / qTokens.length) : 0;

    // Levenshtein similarity
    const maxLen = Math.max(q.length, t.length);
    const levDist = levenshteinDistance(q, t);
    const levScore = maxLen > 0 ? (1 - levDist / maxLen) : 0;

    return Math.max(tokenScore * 0.85, levScore);
}

export interface TaskCandidate {
    task: any;
    score: number;
}

export class TaskService {
    async addTask(params: {
        userId: string;
        title: string;
        dueDate?: string | null;
        priority?: 'HIGH' | 'MEDIUM' | 'LOW';
        description?: string | null;
    }) {
        const { error } = await supabase
            .from('tasks')
            .insert({
                user_id: params.userId,
                title: params.title,
                description: params.description || null,
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

    async findSimilarTasks(params: {
        userId: string;
        queryTitle: string;
        statuses?: string[];
    }): Promise<{ exactMatch?: any; candidates: TaskCandidate[] }> {
        const statuses = params.statuses || ['TODO', 'IN_PROGRESS'];
        const cleanQuery = params.queryTitle.trim().toLowerCase();

        const { data: allTasks, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', params.userId)
            .in('status', statuses)
            .order('created_at', { ascending: false });

        if (error || !allTasks || allTasks.length === 0) {
            return { candidates: [] };
        }

        // 1. Cek Exact Match 100%
        const exact = allTasks.find(t => t.title.trim().toLowerCase() === cleanQuery);
        if (exact) {
            return { exactMatch: exact, candidates: [{ task: exact, score: 1.0 }] };
        }

        // 2. Hitung skor kemiripan (fuzzy scoring)
        const scored: TaskCandidate[] = allTasks
            .map(task => ({
                task,
                score: calculateSimilarity(cleanQuery, task.title)
            }))
            .filter(item => item.score >= 0.42)
            .sort((a, b) => b.score - a.score);

        return { candidates: scored };
    }

    async completeTask(params: {
        userId: string;
        title: string;
    }) {
        const { exactMatch, candidates } = await this.findSimilarTasks({
            userId: params.userId,
            queryTitle: params.title
        });

        if (exactMatch) {
            await this.completeTaskById({ userId: params.userId, taskId: exactMatch.id });
            return exactMatch;
        }

        if (candidates.length === 1 && candidates[0].score >= 0.75) {
            const task = candidates[0].task;
            await this.completeTaskById({ userId: params.userId, taskId: task.id });
            return task;
        }

        return null;
    }

    async completeTaskById(params: {
        userId: string;
        taskId: string;
    }) {
        const { data, error } = await supabase
            .from('tasks')
            .update({ status: 'DONE', updated_at: new Date().toISOString() })
            .eq('id', params.taskId)
            .eq('user_id', params.userId)
            .select()
            .single();

        if (error) {
            console.error("Gagal menyelesaikan task by ID:", error);
            throw error;
        }

        return data;
    }

    async updateTaskProgress(params: {
        userId: string;
        taskId: string;
        progressDescription: string;
        status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
    }) {
        const targetStatus = params.status || 'IN_PROGRESS';
        const { data, error } = await supabase
            .from('tasks')
            .update({
                description: params.progressDescription,
                status: targetStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', params.taskId)
            .eq('user_id', params.userId)
            .select()
            .single();

        if (error) {
            console.error("Gagal update progres task:", error);
            throw error;
        }

        return data;
    }

    async deleteTask(params: {
        userId: string;
        title: string;
    }) {
        const { exactMatch, candidates } = await this.findSimilarTasks({
            userId: params.userId,
            queryTitle: params.title,
            statuses: ['TODO', 'IN_PROGRESS', 'DONE']
        });

        const targetTask = exactMatch || (candidates.length > 0 ? candidates[0].task : null);
        if (!targetTask) return null;

        const { error } = await supabase.from('tasks').delete().eq('id', targetTask.id);
        if (error) {
            console.error("Gagal menghapus task:", error);
            throw error;
        }

        return targetTask.title;
    }
}

export const taskService = new TaskService();
