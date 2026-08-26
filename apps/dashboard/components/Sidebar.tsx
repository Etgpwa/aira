'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Wallet, Target, CheckSquare, CalendarDays, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import './Sidebar.css';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/finance', label: 'Keuangan', icon: Wallet },
  { href: '/goals', label: 'Tabungan', icon: Target },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/schedule', label: 'Jadwal', icon: CalendarDays },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">Aira</h1>
      </div>
      
      <nav className="sidebar-nav">
        <ul>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <li key={item.href}>
                <Link 
                  href={item.href}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto p-4 border-t border-[var(--border-color)]">
        <button 
          onClick={handleLogout}
          className="nav-link w-full flex items-center gap-3 text-[var(--danger)] hover:bg-[var(--danger)] hover:bg-opacity-10"
        >
          <LogOut size={20} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
