import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import RealtimeSubscriber from "@/components/RealtimeSubscriber";
import { createClient } from '@/lib/supabase/server';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="layout-grid">
      {user && <RealtimeSubscriber userId={user.id} />}
      <Sidebar />
      <main className="main-content">
        <header className="flex justify-between items-center" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 className="text-xl font-semibold" style={{ margin: 0 }}>Dashboard</h2>
          <ThemeToggle />
        </header>
        <div style={{ padding: '1.5rem', maxWidth: '100%', overflowX: 'hidden' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
