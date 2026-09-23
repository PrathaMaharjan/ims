"use client";

import { useState, useMemo } from "react";
import {
    UserPlus,
    Search,
    Mail,
    Phone,
    MapPin,
    Building2,
    X,
    Pencil,
    Trash2,
    Users,
    CheckCircle,
    XCircle,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Supplier {
    id: string;
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    panNo: string;
    isActive: boolean;
}

const ITEMS_PER_PAGE = 8;

const EMPTY_FORM = {
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    panNo: "",
};

const SEED_SUPPLIERS: Supplier[] = [
    { id: "1", name: "Arrow Pharmaceuticals Ltd", contactPerson: "Rajan Shrestha", phone: "9801234567", email: "sales@arrowpharma.com.np", address: "Balaju, Kathmandu", panNo: "301234567", isActive: true },
    { id: "2", name: "All Nepal Pharmaceuticals Pvt Ltd", contactPerson: "Sita Gurung", phone: "9812345678", email: "orders@anp.com.np", address: "Teku, Kathmandu", panNo: "302345678", isActive: true },
    { id: "3", name: "Bluestar Surgical House Pvt Ltd", contactPerson: "Milan Thapa", phone: "9823456789", email: "info@bluestarsurgical.com", address: "Putalisadak, Kathmandu", panNo: "303456789", isActive: false },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>(SEED_SUPPLIERS);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
    const [currentPage, setCurrentPage] = useState(1);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

    const activeCount = suppliers.filter(s => s.isActive).length;
    const inactiveCount = suppliers.filter(s => !s.isActive).length;

    const filtered = useMemo(() => suppliers.filter(s => {
        const q = search.toLowerCase();
        const matchesSearch =
            s.name.toLowerCase().includes(q) ||
            s.contactPerson.toLowerCase().includes(q) ||
            s.phone.includes(q);
        const matchesStatus =
            statusFilter === "All" ||
            (statusFilter === "Active" ? s.isActive : !s.isActive);
        return matchesSearch && matchesStatus;
    }), [suppliers, search, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    function resetForm() {
        setForm(EMPTY_FORM);
        setEditingSupplier(null);
        setErrorMsg(null);
    }

    function handleOpenAdd() {
        resetForm();
        setIsModalOpen(true);
    }

    function handleOpenEdit(supplier: Supplier) {
        setEditingSupplier(supplier);
        setForm({
            name: supplier.name,
            contactPerson: supplier.contactPerson,
            phone: supplier.phone,
            email: supplier.email,
            address: supplier.address,
            panNo: supplier.panNo,
        });
        setIsModalOpen(true);
    }

    function handleSaveSupplier() {
        if (!form.name.trim()) {
            setErrorMsg("Supplier name is required.");
            return;
        }

        if (editingSupplier) {
            setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? {
                ...s,
                name: form.name.trim(),
                contactPerson: form.contactPerson.trim(),
                phone: form.phone.trim(),
                email: form.email.trim(),
                address: form.address.trim(),
                panNo: form.panNo.trim(),
            } : s));
        } else {
            setSuppliers(prev => [...prev, {
                id: crypto.randomUUID(),
                name: form.name.trim(),
                contactPerson: form.contactPerson.trim(),
                phone: form.phone.trim(),
                email: form.email.trim(),
                address: form.address.trim(),
                panNo: form.panNo.trim(),
                isActive: true,
            }]);
            setCurrentPage(1);
        }
        resetForm();
        setIsModalOpen(false);
    }

    function confirmDeleteSupplier() {
        if (!deleteTarget) return;
        setSuppliers(prev => prev.filter(s => s.id !== deleteTarget.id));
        setDeleteTarget(null);
    }

    function toggleStatus(id: string) {
        setSuppliers(prev => prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
    }

    return (
        <div className="flex flex-col gap-8">
            {/* Banner Title */}
            <div className="rounded-xl bg-[#044d73] px-4 py-4 text-white shadow-sm sm:px-6 sm:py-5">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Suppliers</h1>
            </div>

            {/* Top Status Dashboards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 border-l-4 border-l-slate-400 bg-white p-4 shadow-sm flex items-center justify-between sm:p-5">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Suppliers</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1 sm:text-3xl">{suppliers.length}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 sm:h-12 sm:w-12">
                        <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white p-4 shadow-sm flex items-center justify-between sm:p-5">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1 sm:text-3xl">{activeCount}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:h-12 sm:w-12">
                        <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-4 shadow-sm flex items-center justify-between sm:p-5">
                    <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Inactive</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1 sm:text-3xl">{inactiveCount}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 sm:h-12 sm:w-12">
                        <XCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                </div>
            </div>

            {/* Control Actions Panel */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full md:w-auto">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                            placeholder="Search suppliers..."
                            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setCurrentPage(1); }}
                        className="w-full sm:w-auto rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm text-slate-700 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                    >
                        <option value="All">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>

                <button
                    onClick={handleOpenAdd}
                    className="flex items-center justify-center gap-2 rounded-lg bg-[#044d73] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#033f60] w-full md:w-auto"
                >
                    <UserPlus className="h-4 w-4" />
                    Add Supplier
                </button>
            </div>

            {/* Data Section Container */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                <th className="py-3 px-4">Supplier</th>
                                <th className="py-3 px-4">Contact Person</th>
                                <th className="py-3 px-4">Contact</th>
                                <th className="py-3 px-4">PAN No.</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginated.length === 0 ? (
                                <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-400">No suppliers match your search.</td></tr>
                            ) : paginated.map((supplier) => (
                                <tr key={supplier.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#044d73]/10 text-sm font-semibold text-[#044d73] border border-[#044d73]/20">
                                                <Building2 className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <span className="font-medium text-slate-900">{supplier.name}</span>
                                                {supplier.address && <p className="text-xs text-slate-400 mt-0.5">{supplier.address}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-slate-600 font-medium">{supplier.contactPerson || "—"}</td>
                                    <td className="py-4 px-4 text-slate-500">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-700">{supplier.email || "—"}</span>
                                            <span className="text-xs text-slate-400 mt-0.5 font-mono">{supplier.phone || "—"}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-slate-500 font-mono text-xs">{supplier.panNo || "—"}</td>
                                    <td className="py-4 px-4">
                                        <button
                                            type="button"
                                            onClick={() => toggleStatus(supplier.id)}
                                            title="Click to toggle status"
                                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-all hover:scale-105 active:scale-95 select-none ${supplier.isActive
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                                                : "bg-slate-100 text-slate-500 border border-slate-200"
                                                }`}
                                        >
                                            <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${supplier.isActive ? "bg-emerald-600" : "bg-slate-400"}`} />
                                            {supplier.isActive ? "Active" : "Inactive"}
                                        </button>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenEdit(supplier)}
                                                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#044d73] transition-colors"
                                                title="Edit Supplier"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteTarget(supplier)}
                                                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                title="Remove Supplier"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="block md:hidden divide-y divide-slate-100">
                    {paginated.length === 0 ? (
                        <div className="py-12 text-center text-sm text-slate-400 px-4">No suppliers match your search.</div>
                    ) : paginated.map((supplier) => (
                        <div key={supplier.id} className="p-4 flex flex-col gap-4 bg-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#044d73]/10 text-sm font-semibold text-[#044d73] border border-[#044d73]/20">
                                        <Building2 className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 text-sm">{supplier.name}</h4>
                                        <span className="inline-block text-xs text-slate-500 font-medium mt-0.5">{supplier.contactPerson || "—"}</span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => toggleStatus(supplier.id)}
                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-all select-none ${supplier.isActive
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                                        : "bg-slate-100 text-slate-500 border border-slate-200"
                                        }`}
                                >
                                    <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${supplier.isActive ? "bg-emerald-600" : "bg-slate-400"}`} />
                                    {supplier.isActive ? "Active" : "Inactive"}
                                </button>
                            </div>

                            <div className="text-xs text-slate-500 bg-slate-50/50 rounded-lg p-3 space-y-1">
                                <div className="flex items-center gap-2">
                                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate text-slate-700 font-medium">{supplier.email || "—"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="font-mono text-slate-600">{supplier.phone || "—"}</span>
                                </div>
                                {supplier.address && (
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span className="text-slate-600">{supplier.address}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-slate-100/80 pt-3">
                                <button
                                    onClick={() => handleOpenEdit(supplier)}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                </button>
                                <button
                                    onClick={() => setDeleteTarget(supplier)}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-100 py-2 text-xs font-medium text-red-600 bg-red-50/30 hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Pagination Controls */}
                <div className="flex flex-col gap-4 items-center justify-between border-t border-slate-100 bg-white px-6 py-4 sm:flex-row">
                    <div className="text-sm text-slate-500 hidden sm:block"></div>

                    <div className="flex items-center justify-between w-full sm:w-auto gap-6">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                            Page {currentPage} of {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                                disabled={currentPage === 1}
                                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors touch-manipulation"
                                title="Previous Page"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-20 disabled:pointer-events-none transition-colors touch-manipulation"
                                title="Next Page"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm overflow-y-auto" onClick={() => setIsModalOpen(false)}>
                    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-xl bg-white shadow-xl border border-slate-100 overflow-hidden my-auto">
                        <div className="relative flex items-center justify-center bg-[#044d73] p-5 text-white sm:p-6">
                            <div className="hidden h-10 w-10 items-center justify-center text-white sm:flex">
                                <UserPlus className="h-6 w-6" />
                            </div>
                            <h2 className="text-lg font-semibold text-white text-center sm:text-2xl">
                                {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white transition-colors sm:right-6"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {errorMsg && (
                            <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6 sm:mt-6">
                                {errorMsg}
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-6">
                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">Supplier Name</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="e.g. Arrow Pharmaceuticals Ltd"
                                        className="w-full rounded-lg border border-slate-200/80 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400/80 bg-slate-50/30 focus:bg-white focus:border-[#044d73] focus:outline-none focus:ring-4 focus:ring-[#044d73]/10 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">Contact Person</label>
                                <input
                                    value={form.contactPerson}
                                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                                    placeholder="Enter contact name"
                                    className="w-full rounded-lg border border-slate-200/80 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400/80 bg-slate-50/30 focus:bg-white focus:border-[#044d73] focus:outline-none focus:ring-4 focus:ring-[#044d73]/10 transition-all"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        placeholder="9XXXXXXXXX"
                                        className="w-full rounded-lg border border-slate-200/80 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400/80 bg-slate-50/30 focus:bg-white focus:border-[#044d73] focus:outline-none focus:ring-4 focus:ring-[#044d73]/10 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        placeholder="Enter email"
                                        className="w-full rounded-lg border border-slate-200/80 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400/80 bg-slate-50/30 focus:bg-white focus:border-[#044d73] focus:outline-none focus:ring-4 focus:ring-[#044d73]/10 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">PAN No.</label>
                                <input
                                    value={form.panNo}
                                    onChange={(e) => setForm({ ...form, panNo: e.target.value })}
                                    placeholder="e.g. 301234567"
                                    className="w-full rounded-lg border border-slate-200/80 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400/80 bg-slate-50/30 focus:bg-white focus:border-[#044d73] focus:outline-none focus:ring-4 focus:ring-[#044d73]/10 transition-all"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-xs font-semibold text-slate-500 sm:text-sm sm:mb-2">Address</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={form.address}
                                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                                        placeholder="e.g. Balaju, Kathmandu"
                                        className="w-full rounded-lg border border-slate-200/80 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400/80 bg-slate-50/30 focus:bg-white focus:border-[#044d73] focus:outline-none focus:ring-4 focus:ring-[#044d73]/10 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-4 bg-slate-50/50 rounded-b-xl sm:flex-row sm:justify-end sm:gap-3 sm:p-6">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors w-full sm:w-auto"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveSupplier}
                                className="flex items-center justify-center gap-2 rounded-lg bg-[#044d73] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#033f60] w-full sm:w-auto"
                            >
                                {editingSupplier ? "Save Changes" : "Add Supplier"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
                    onClick={() => setDeleteTarget(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-100 overflow-hidden mx-auto"
                    >
                        <div className="flex flex-col items-center gap-3 p-6 text-center sm:gap-4 sm:p-8">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 sm:h-14 sm:w-14">
                                <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Remove Supplier</h2>
                                <p className="mt-2 text-sm text-slate-500 px-2">
                                    Are you sure you want to remove{" "}
                                    <span className="font-semibold text-slate-700">{deleteTarget.name}</span>{" "}
                                    from suppliers?
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-3 border-t border-slate-100 p-4 bg-slate-50/50 sm:p-6">
                            <button
                                type="button"
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteSupplier}
                                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}