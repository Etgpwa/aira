'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Tabel mana yang relevan untuk setiap halaman
const PAGE_TABLE_MAP: Record<string, string[]> = {
  '/': ['transactions', 'bank_accounts', 'debts'],
  '/finance': ['transactions', 'bank_accounts', 'debts', 'budgets'],
  '/tasks': ['tasks'],
  '/schedule': ['study_schedules'],
  '/goals': ['goals'],
};

export default function RealtimeSubscriber({ userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Hanya subscribe ke tabel yang relevan dengan halaman aktif
    const relevantTables = PAGE_TABLE_MAP[pathname] || [];
    if (relevantTables.length === 0) return;

    // Debounce refresh: jika ada beberapa perubahan dalam 2 detik, hanya 1 refresh
    const debouncedRefresh = (table: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        console.log(`🔄 Realtime: refresh karena perubahan di tabel '${table}'`);
        router.refresh();
      }, 2000);
    };

    const channel = supabase.channel(`db-changes-${pathname}`);

    // Daftarkan listener hanya untuk tabel yang relevan di halaman ini
    for (const table of relevantTables) {
      channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        () => debouncedRefresh(table)
      );
    }

    channel.subscribe((status) => {
      console.log(`📡 Realtime [${pathname}]: ${status} (tables: ${relevantTables.join(', ')})`);
    });

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, [userId, pathname]); // Re-subscribe ketika pindah halaman

  return null;
}
