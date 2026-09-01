import BottomNav from "@/components/BottomNav";
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
    <div className="relative min-h-screen bg-background pb-20">
      {user && <RealtimeSubscriber userId={user.id} />}
      <main className="w-full h-full max-w-md mx-auto relative min-h-screen">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
