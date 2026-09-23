'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    ChevronLeft, ChevronRight, LogOut, Menu, X,
    LayoutDashboard, Boxes, Receipt, ShoppingCart, Users, Wallet,
    type LucideIcon,
} from 'lucide-react';
type IconKey = 'dashboard' | 'inventory' | 'purchase' | 'sales' | 'suppliers' | 'expense';
import { useAuth } from '@/context/auth-context';


type NavItem = {
    match: string;
    href: string;
    label: string;
    icon: IconKey;
    children?: { href: string; label: string }[];
};

const iconMap: Record<IconKey, LucideIcon> = {
    dashboard: LayoutDashboard,
    inventory: Boxes,
    purchase: Receipt,
    sales: ShoppingCart,
    suppliers: Users,
    expense: Wallet,
};

const defaultItems: NavItem[] = [
    { match: '/pharma', href: '/pharma', label: 'Dashboard', icon: 'dashboard' },
    { match: '/pharma/inventory', href: '/pharma/inventory', label: 'Inventory', icon: 'inventory' },
    { match: '/pharma/purchase', href: '/pharma/purchase', label: 'Purchase', icon: 'purchase' },
    // { match: '/pharma/sales', href: '/pharma/sales', label: 'Sales', icon: 'sales' },
    { match: '/pharma/suppliers', href: '/pharma/suppliers', label: 'Suppliers', icon: 'suppliers' },
    { match: '/pharma/expense', href: '/pharma/expense', label: 'Expense', icon: 'expense' },
];

type SidebarUser = { name: string; email?: string };

type SidebarProps = {
    items?: NavItem[];
    brandName: string;
    logoUrl?: string;
    user: SidebarUser;
};

/* ----------------------------- pieces ----------------------------- */

function Brand({
    brandName,
    logoUrl,
    collapsed,
}: {
    brandName: string;
    logoUrl?: string;
    collapsed: boolean;
}) {
    return (
        <div className={`flex items-center pt-7 pb-5 ${collapsed ? 'justify-center' : 'gap-3.5 px-5'}`}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
                {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={brandName} className="h-full w-full object-cover" />
                ) : (
                    <span className="text-lg font-bold text-[#044d73]">
                        {brandName.charAt(0).toUpperCase()}
                    </span>
                )}
            </div>
            {!collapsed && (
                <span className="truncate text-base font-bold text-white">{brandName}</span>
            )}
        </div>
    );
}

function NavList({
    items,
    collapsed,
    onNavigate,
}: {
    items: NavItem[];
    collapsed: boolean;
    onNavigate?: () => void;
}) {
    const pathname = usePathname();
    const isUnder = (path: string, hasChildren?: boolean) =>
        pathname === path || (hasChildren && pathname.startsWith(path + '/'));

    return (
        <nav aria-label="Main" className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {items.map((item) => {
                const active = isUnder(item.match, !!item.children);
                const Icon = iconMap[item.icon];

                return (
                    <div key={item.match}>
                        <Link
                            href={item.href}
                            onClick={onNavigate}
                            title={collapsed ? item.label : undefined}
                            aria-current={active && !item.children ? 'page' : undefined}
                            className={`flex items-center gap-3.5 rounded-full py-3.5 text-sm font-semibold transition-all ${collapsed ? 'justify-center' : 'px-4'
                                } ${active
                                    ? 'bg-white text-[#044d73] shadow-md'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            <Icon size={20} className="shrink-0" />
                            {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>

                        {/* sub-pages, only while the parent section is open */}
                        {active && !collapsed && item.children && (
                            <ul className="ml-[1.65rem] mt-1.5 space-y-1 border-l border-white/15 pl-3">
                                {item.children.map((child) => {
                                    const childActive = isUnder(child.href);
                                    return (
                                        <li key={child.href}>
                                            <Link
                                                href={child.href}
                                                onClick={onNavigate}
                                                aria-current={childActive ? 'page' : undefined}
                                                className={`block rounded-full px-3 py-2 text-[13px] font-semibold transition-colors ${childActive
                                                    ? 'bg-white/15 text-white'
                                                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                                                    }`}
                                            >
                                                {child.label}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}

function UserFooter({
    user,
    collapsed,
    onLogout,
}: {
    user: SidebarUser;
    collapsed: boolean;
    onLogout: () => void;
}) {
    const initials = user.name
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div className="space-y-2 border-t border-white/10 px-3 py-4">
            <div
                className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'px-3'}`}
                title={collapsed ? user.name : undefined}
            >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
                    {initials}
                </div>
                {!collapsed && (
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                        {user.email && (
                            <p className="truncate text-[11px] font-medium text-white/60">{user.email}</p>
                        )}
                    </div>
                )}
            </div>

            <button
                onClick={onLogout}
                type="button"
                title={collapsed ? 'Log out' : undefined}
                className={`flex w-full items-center gap-3.5 rounded-full py-3.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-red-300 ${collapsed ? 'justify-center' : 'px-4'
                    }`}
            >
                <LogOut size={20} className="shrink-0" />
                {!collapsed && <span>Log out</span>}
            </button>
        </div>
    );
}

/* ----------------------------- sidebar ----------------------------- */

export function Sidebar({ items = defaultItems, brandName, logoUrl, user }: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { logout } = useAuth();

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Error occurred while logging out:', error);
        }
    };

    return (
        <>
            {/* Desktop */}
            <aside
                className={`sticky top-3 m-3 hidden h-[calc(100dvh-1.5rem)] shrink-0 self-start flex-col rounded-3xl bg-[#044d73] shadow-sm transition-[width] duration-300 md:flex ${collapsed ? 'w-20' : 'w-64'
                    }`}
            >
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="absolute -right-3.5 top-8 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#044d73] text-white shadow-sm transition-all hover:bg-white/10"
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                <Brand brandName={brandName} logoUrl={logoUrl} collapsed={collapsed} />
                <NavList items={items} collapsed={collapsed} />
                <UserFooter user={user} collapsed={collapsed} onLogout={handleLogout} />
            </aside>

            {/* Mobile top bar */}
            <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 bg-[#044d73] px-4 md:hidden">
                <button
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open menu"
                    className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
                >
                    <Menu size={20} />
                </button>
                <span className="truncate text-sm font-bold text-white">{brandName}</span>
            </div>

            {/* Mobile drawer */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
                    <div className="absolute inset-0 bg-zinc-900/40" onClick={() => setMobileOpen(false)} />
                    <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col rounded-r-3xl bg-[#044d73] shadow-xl">
                        <button
                            onClick={() => setMobileOpen(false)}
                            aria-label="Close menu"
                            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
                        >
                            <X size={18} />
                        </button>
                        <Brand brandName={brandName} logoUrl={logoUrl} collapsed={false} />
                        <NavList items={items} collapsed={false} onNavigate={() => setMobileOpen(false)} />
                        <UserFooter user={user} collapsed={false} onLogout={handleLogout} />
                    </aside>
                </div>
            )}
        </>
    );
}