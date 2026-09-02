'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Wallet, Target, CheckSquare, Calendar, GraduationCap } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', href: '/', icon: LayoutDashboard },
    { name: 'Keuangan', href: '/finance', icon: Wallet },
    { name: 'Tabungan', href: '/finance/goals', icon: Target },
    { name: 'Tugas', href: '/productivity/tasks', icon: CheckSquare },
    { name: 'Jadwal', href: '/productivity/agenda', icon: Calendar },
    { name: 'Kuliah', href: '/academic', icon: GraduationCap },
  ];

  // Sembunyikan bottom nav di halaman login
  if (pathname === '/login') return null;

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[400px] z-50 md:hidden">
      <div className="bg-surface/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(24,26,42,0.12)] border border-white/40 rounded-full px-2 py-3 flex items-center justify-between">
        {navItems.map((item) => {
          const Icon = item.icon;
          let isActive = false;
          if (item.href === '/') {
            isActive = pathname === '/';
          } else if (item.href === '/finance') {
            isActive = pathname === '/finance';
          } else if (item.href === '/finance/goals') {
            isActive = pathname === '/finance/goals' || pathname.startsWith('/finance/goals/');
          } else if (item.href === '/academic') {
            isActive = pathname === '/academic' || pathname.startsWith('/academic/');
          } else if (item.href === '/productivity/tasks') {
            isActive = pathname === '/productivity/tasks' || pathname.startsWith('/productivity/tasks/');
          } else if (item.href === '/productivity/agenda') {
            isActive = pathname === '/productivity/agenda' || pathname.startsWith('/productivity/agenda/');
          } else {
            isActive = pathname === item.href;
          }
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`relative flex flex-col items-center justify-center w-14 h-12 rounded-full transition-all duration-300 ${isActive ? 'text-primary' : 'text-outline hover:text-outline-variant hover:bg-surface-container'}`}
            >
              {isActive && (
                <div className="absolute inset-0 bg-primary/10 rounded-full scale-100 transition-transform duration-300"></div>
              )}
              <Icon className={`w-5 h-5 mb-1 ${isActive ? 'scale-110' : 'scale-100'} transition-transform duration-300`} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[9px] font-medium tracking-wide ${isActive ? 'opacity-100' : 'opacity-70'}`}>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
