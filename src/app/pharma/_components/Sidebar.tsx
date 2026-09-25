'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    ChevronLeft, ChevronRight, ChevronDown, LogOut, Menu, X,
    LayoutDashboard, Boxes, Receipt, ShoppingCart, Users, Wallet, BarChart3, Settings, Contact,
    type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';

type IconKey = 'dashboard' | 'inventory' | 'purchase' | 'sales' | 'customers' | 'suppliers' | 'expense' | 'analytics' | 'settings';

const iconMap: Record<IconKey, LucideIcon> = {
    dashboard: LayoutDashboard,
    inventory: Boxes,
    purchase: Receipt,
    sales: ShoppingCart,
    customers: Contact,
    suppliers: Users,
    expense: Wallet,
    analytics: BarChart3,
    settings: Settings,
};

/* A single navigable link. */
type NavItem = {
    match: string;
    href: string;
    label: string;
    icon: IconKey;
};

/* A collapsible section grouping several links under one header. */
type NavGroup = {
    id: string;
    label: string;
    icon: IconKey;
    items: NavItem[];
};

type NavEntry = { type: 'item'; item: NavItem } | { type: 'group'; group: NavGroup };

const defaultEntries: NavEntry[] = [
    { type: 'item', item: { match: '/pharma', href: '/pharma', label: 'Dashboard', icon: 'dashboard' } },
    {
        type: 'group',
        group: {
            id: 'operations',
            label: 'Operations',
            icon: 'inventory',
            items: [
                { match: '/pharma/inventory', href: '/pharma/inventory', label: 'Inventory', icon: 'inventory' },
                { match: '/pharma/purchase', href: '/pharma/purchase', label: 'Purchase', icon: 'purchase' },
                { match: '/pharma/sales', href: '/pharma/sales', label: 'Sales', icon: 'sales' },
            ],
        },
    },
    {
        type: 'group',
        group: {
            id: 'contacts',
            label: 'Contacts',
            icon: 'suppliers',
            items: [
                { match: '/pharma/customers', href: '/pharma/customers', label: 'Customers', icon: 'customers' },
                { match: '/pharma/suppliers', href: '/pharma/suppliers', label: 'Suppliers', icon: 'suppliers' },
            ],
        },
    },
    {
        type: 'group',
        group: {
            id: 'finance',
            label: 'Finance',
            icon: 'expense',
            items: [
                { match: '/pharma/expense', href: '/pharma/expense', label: 'Expense', icon: 'expense' },
                { match: '/pharma/analytics', href: '/pharma/analytics', label: 'Analytics', icon: 'analytics' },
            ],
        },
    },
    { type: 'item', item: { match: '/pharma/settings', href: '/pharma/settings', label: 'Settings', icon: 'settings' } },
];

type SidebarUser = { name: string; email?: string };

type SidebarProps = {
    entries?: NavEntry[];
    brandName: string;
    logoUrl?: string;
    user: SidebarUser;
};

/* ----------------------------- pieces ----------------------------- */

function Brand({
    brandName,
    logoUrl,
    collapsed,
    onToggleCollapse,
}: {
    brandName: string;
    logoUrl?: string;
    collapsed: boolean;
    onToggleCollapse: () => void;
}) {
    return (
        <div className={`flex items-center pt-6 pb-5 ${collapsed ? 'flex-col gap-2 px-3' : 'gap-3 px-4'}`}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
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
                <span className="flex-1 truncate text-base font-bold text-white">{brandName}</span>
            )}
            <button
                onClick={onToggleCollapse}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
                {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
        </div>
    );
}

function NavLink({
    item,
    collapsed,
    indent,
    onNavigate,
    isActive,
}: {
    item: NavItem;
    collapsed: boolean;
    indent?: boolean;
    onNavigate?: () => void;
    isActive: boolean;
}) {
    const Icon = iconMap[item.icon];
    return (
        <Link
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-full py-3 text-sm font-semibold transition-all ${collapsed ? 'justify-center px-0' : indent ? 'pl-10 pr-4' : 'px-4'
                } ${isActive
                    ? 'bg-white text-[#044d73] shadow-md'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
        >
            <Icon size={19} className="shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
        </Link>
    );
}

function GroupHeader({
    group,
    open,
    onToggle,
    active,
}: {
    group: NavGroup;
    open: boolean;
    onToggle: () => void;
    active: boolean;
}) {
    const Icon = iconMap[group.icon];
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold transition-all ${active && !open ? 'text-white' : 'text-white/70'
                } hover:bg-white/10 hover:text-white`}
        >
            <Icon size={19} className="shrink-0" />
            <span className="flex-1 truncate text-left">{group.label}</span>
            <ChevronDown size={15} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
    );
}

function NavList({
    entries,
    collapsed,
    onNavigate,
}: {
    entries: NavEntry[];
    collapsed: boolean;
    onNavigate?: () => void;
}) {
    const pathname = usePathname();
    const isActive = (path: string) => pathname === path;
    const groupContainsActive = (group: NavGroup) => group.items.some((i) => isActive(i.match));

    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        entries.forEach((e) => {
            if (e.type === 'group') initial[e.group.id] = groupContainsActive(e.group);
        });
        return initial;
    });

    function toggleGroup(id: string) {
        setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
    }

    // Collapsed sidebar: no room for group headers/labels, so show every
    // link flattened as a plain icon column.
    if (collapsed) {
        return (
            <nav aria-label="Main" className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
                {entries.flatMap((e) => (e.type === 'item' ? [e.item] : e.group.items)).map((item) => (
                    <NavLink key={item.match} item={item} collapsed onNavigate={onNavigate} isActive={isActive(item.match)} />
                ))}
            </nav>
        );
    }

    return (
        <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
            {entries.map((entry) => {
                if (entry.type === 'item') {
                    return (
                        <NavLink
                            key={entry.item.match}
                            item={entry.item}
                            collapsed={false}
                            onNavigate={onNavigate}
                            isActive={isActive(entry.item.match)}
                        />
                    );
                }

                const { group } = entry;
                const open = !!openGroups[group.id];
                return (
                    <div key={group.id}>
                        <GroupHeader group={group} open={open} onToggle={() => toggleGroup(group.id)} active={groupContainsActive(group)} />
                        {open && (
                            <div className="mt-1 space-y-1">
                                {group.items.map((item) => (
                                    <NavLink
                                        key={item.match}
                                        item={item}
                                        collapsed={false}
                                        indent
                                        onNavigate={onNavigate}
                                        isActive={isActive(item.match)}
                                    />
                                ))}
                            </div>
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

export function Sidebar({ entries = defaultEntries, brandName, logoUrl, user }: SidebarProps) {
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
                <Brand brandName={brandName} logoUrl={logoUrl} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
                <NavList entries={entries} collapsed={collapsed} />
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
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
                    {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt={brandName} className="h-full w-full object-cover" />
                    ) : (
                        <span className="text-xs font-bold text-[#044d73]">
                            {brandName.charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>
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
                        <div className="flex items-center gap-3 pt-6 pb-5 px-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
                                {logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={logoUrl} alt={brandName} className="h-full w-full object-cover" />
                                ) : (
                                    <span className="text-lg font-bold text-[#044d73]">{brandName.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <span className="truncate text-base font-bold text-white">{brandName}</span>
                        </div>
                        <NavList entries={entries} collapsed={false} onNavigate={() => setMobileOpen(false)} />
                        <UserFooter user={user} collapsed={false} onLogout={handleLogout} />
                    </aside>
                </div>
            )}
        </>
    );
}