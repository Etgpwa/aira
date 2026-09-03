'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Wallet, Target, CheckSquare, Calendar, GraduationCap, Sparkles, Settings } from 'lucide-react';

const navItems = [
    { name: 'Home', href: '/', icon: LayoutDashboard },
    { name: 'Keuangan', href: '/finance', icon: Wallet },
    { name: 'Tabungan', href: '/finance/goals', icon: Target },
    { name: 'Tugas', href: '/productivity/tasks', icon: CheckSquare },
    { name: 'Jadwal', href: '/productivity/agenda', icon: Calendar },
    { name: 'Kuliah', href: '/academic', icon: GraduationCap },
    { name: 'AI Simulator', href: '/sandbox', icon: Sparkles },
    { name: 'Pengaturan', href: '/settings', icon: Settings },
];

export default function SideNav() {
    const pathname = usePathname();

    if (pathname === '/login') return null;

    return (
        <aside className="
            hidden md:flex
            fixed top-0 left-0 h-full z-40
            flex-col
            bg-surface/95 backdrop-blur-xl
            border-r border-surface-variant
            shadow-[4px_0_24px_rgba(24,26,42,0.06)]
            w-[72px] lg:w-[240px]
            transition-all duration-300
        ">
            {/* Logo / Brand */}
            <div className="flex items-center gap-3 px-4 py-6 border-b border-surface-variant">
                <div className="w-9 h-9 rounded-[12px] bg-accent-gradient flex items-center justify-center flex-shrink-0">
                    <LayoutDashboard className="w-5 h-5 text-white" />
                </div>
                <div className="hidden lg:block overflow-hidden">
                    <p className="font-extrabold text-on-surface text-sm leading-tight">Karen</p>
                    <p className="text-secondary text-[11px] leading-tight">Asisten Pribadi</p>
                </div>
            </div>

            {/* Nav Items */}
            <nav className="flex-1 flex flex-col gap-1 px-2 py-4 overflow-y-auto">
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
                    } else if (item.href === '/settings') {
                        isActive = pathname === '/settings' || pathname.startsWith('/settings/');
                    } else {
                        isActive = pathname === item.href;
                    }

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            prefetch={true}
                            title={item.name}
                            className={`
                                group relative flex items-center gap-3
                                rounded-[14px] transition-all duration-200
                                px-3 py-3
                                outline-none focus:outline-none
                                ${isActive
                                    ? 'bg-primary text-on-primary shadow-[0_4px_12px_rgba(56,74,216,0.3)]'
                                    : 'text-secondary hover:bg-surface-container hover:text-on-surface'
                                }
                            `}
                        >
                            <Icon
                                className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                                strokeWidth={isActive ? 2.5 : 2}
                            />
                            {/* Label — visible only on lg */}
                            <span className="hidden lg:block text-sm font-semibold truncate">
                                {item.name}
                            </span>

                            {/* Tooltip untuk tablet (md) — icon only mode */}
                            <span className="
                                lg:hidden
                                absolute left-full ml-3 px-2.5 py-1 rounded-lg
                                bg-on-surface text-inverse-on-surface text-xs font-medium
                                whitespace-nowrap pointer-events-none
                                opacity-0 group-hover:opacity-100
                                translate-x-1 group-hover:translate-x-0
                                transition-all duration-200 z-50
                            ">
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-2 py-4 border-t border-surface-variant">
                <div className={`
                    flex items-center gap-3 px-3 py-2 rounded-[14px]
                    bg-surface-container
                `}>
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <span className="hidden lg:block text-xs text-secondary font-medium truncate">
                        Tersambung ke Karen
                    </span>
                </div>
            </div>
        </aside>
    );
}
