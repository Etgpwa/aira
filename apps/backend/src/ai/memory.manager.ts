export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export class MemoryManager {
    // Kunci Map adalah nomor WhatsApp (sessionId)
    private memories: Map<string, ChatMessage[]> = new Map();
    // Batas memori pendek per user (4 pesan terakhir / 2 turn) agar hemat token
    private readonly MAX_HISTORY = 4;

    /**
     * Tambahkan pesan baru ke dalam memori
     */
    addMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
        if (!this.memories.has(sessionId)) {
            this.memories.set(sessionId, []);
        }
        
        const history = this.memories.get(sessionId)!;
        history.push({ role, content, timestamp: new Date() });
        
        // Hapus pesan paling lama jika melebihi batas (Sliding Window)
        if (history.length > this.MAX_HISTORY) {
            history.shift();
        }
    }

    /**
     * Ambil riwayat percakapan yang diformat sebagai string teks
     */
    getFormattedHistory(sessionId: string): string {
        const history = this.memories.get(sessionId) || [];
        if (history.length === 0) return '';
        
        return history.map(msg => 
            `[${msg.role === 'user' ? 'User' : 'Aira'}]: ${msg.content}`
        ).join('\n');
    }
    
    /**
     * Hapus memori (misal ketika user minta "lupakan konteks" atau reset)
     */
    clearMemory(sessionId: string) {
        this.memories.delete(sessionId);
    }
}

// Export singleton instance
export const memoryManager = new MemoryManager();
