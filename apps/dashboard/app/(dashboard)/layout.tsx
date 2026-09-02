import BottomNav from "@/components/BottomNav";
import SideNav from "@/components/SideNav";
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
    // Root: flex row natural layout
    <div className="flex min-h-screen bg-background">

      {/* Sidebar — hanya tampil di md+ */}
      <SideNav />

      {/* Main area: mengisi sisa ruang setelah sidebar */}
      <div className="
        flex-1 flex flex-col
        min-w-0
        md:ml-[72px] lg:ml-[240px]
      ">
        {user && <RealtimeSubscriber userId={user.id} />}

        {/*
          Content wrapper:
          - Mobile:  full width, px-4, pb-28 untuk BottomNav
          - Tablet:  px-6, max-w agar tidak sampingan penuh
          - Desktop: px-10, max-w-7xl
        */}
        <main className="
          flex-1 w-full
          px-4 pt-6 pb-28
          md:px-6 md:pt-8 md:pb-10
          lg:px-10 lg:pt-10
          max-w-7xl
          mx-auto
        ">
          {children}
        </main>
      </div>

      {/* BottomNav — hanya tampil di mobile */}
      <BottomNav />
    </div>
  );
}
