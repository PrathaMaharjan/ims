"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UserPlus,
  Users,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  Search,
  Trash2,
  Calendar,
  AlertCircle,
  AlertTriangle,
  X,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api-client";


const PAGE_SIZE = 10;
const MIN_PASSWORD = 8;

interface AccountItem {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}


function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: any } })?.response?.data;
  if (!data) return fallback;
  if (typeof data.error === "string") {
    const fieldErrors = data.details?.fieldErrors as Record<string, string[]> | undefined;
    const first = fieldErrors ? Object.values(fieldErrors).flat()[0] : undefined;
    return first ?? data.error;
  }
  return fallback;
}

export default function AddAccountPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Modal State for Add User
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Debounce search, and go back to page 1 when it changes
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await api.get("/api/staff", {
        params: {
          page,
          limit: PAGE_SIZE,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        },
      });
      setAccounts(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Failed to load accounts."));
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Close modal on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteTarget) {
          setDeleteTarget(null);
        } else if (isModalOpen) {
          handleCloseModal();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, deleteTarget]);

  function triggerToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFormError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function handleOpenModal() {
    resetForm();
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    resetForm();
    setIsModalOpen(false);
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setFormError("Full name is required.");
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setFormError("Password is required.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setFormError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post("/api/staff", {
        name: trimmedName,
        email: trimmedEmail,
        password,
      });

      resetForm();
      setIsModalOpen(false);

      if (data.emailSent === false) {
        triggerToast(
          `Account created for ${data.name}, but the welcome email could not be sent.`
        );
      } else {
        triggerToast(`Account created. Login details emailed to ${data.email}.`);
      }

      // New account is newest-first, so go to page 1 and reload
      if (page === 1) await fetchAccounts();
      else setPage(1);
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to create account."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmDeleteAccount() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/staff/${deleteTarget.id}`);
      triggerToast(`Account for ${deleteTarget.name} removed.`);

      // If that was the last row on this page, step back one page
      if (accounts.length === 1 && page > 1) setPage(page - 1);
      else await fetchAccounts();
      setDeleteTarget(null);
    } catch (err) {
      triggerToast(getErrorMessage(err, "Failed to delete account."));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
            <Check className="h-3.5 w-3.5 stroke-[3]" />
          </div>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-xl bg-[#044d73] p-5 sm:px-6 sm:py-5 text-white shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Account Management</h1>
        </div>
      </div>

      {/* Main Section Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Top Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-sky-50 text-[#044d73] flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">Existing Accounts</h2>

              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 pl-8 pr-8 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#044d73] focus:border-transparent transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Add User Modal Trigger Button */}
            <button
              type="button"
              onClick={handleOpenModal}
              className="inline-flex items-center gap-2 rounded-lg bg-[#044d73] hover:bg-[#033b59] px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-all shrink-0 shadow-sm active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* Accounts Table */}
        {isLoading && accounts.length === 0 ? (
          <div className="py-16 flex items-center justify-center gap-2 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading accounts...
          </div>
        ) : loadError ? (
          <div className="py-16 text-center">
            <AlertCircle className="h-10 w-10 text-rose-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">{loadError}</p>
            <button
              type="button"
              onClick={fetchAccounts}
              className="mt-3 text-xs font-semibold text-[#044d73] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-700">No accounts found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {debouncedSearch
                ? `No accounts matched "${debouncedSearch}".`
                : "No accounts have been created yet."}
            </p>
            {debouncedSearch ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-3 text-xs font-semibold text-[#044d73] hover:underline"
              >
                Clear search filter
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenModal}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#044d73] hover:underline"
              >

              </button>
            )}
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isLoading ? "opacity-60" : ""}`}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Name</th>
                  <th className="py-3.5 px-6">Email Address</th>
                  <th className="py-3.5 px-6">Date Added</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {accounts.map((account) => {
                  const initials = account.name
                    .split(" ")
                    .filter(Boolean)
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <tr
                      key={account.id}
                      className="hover:bg-sky-50/30 transition-colors group"
                    >
                      {/* Name with Avatar */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-sky-100 text-[#044d73] flex items-center justify-center font-bold text-xs shrink-0 border border-sky-200/60 shadow-xs">
                            {initials || "U"}
                          </div>
                          <span className="font-semibold text-slate-800 text-sm">
                            {account.name}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-6 text-slate-600">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="text-xs sm:text-sm font-normal">
                            {account.email}
                          </span>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-4 px-6 whitespace-nowrap text-slate-500">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {String(account.createdAt).slice(0, 10)}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(account)}
                          title="Delete account"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />

                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages || isLoading}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add New User Modal Dialog */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#044d73] text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/20 shrink-0">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add New User</h3>
                  <p className="text-xs text-sky-100/90 mt-0.5">
                    Create login credentials for a new account
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateAccount}>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-600 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="e.g. Ramesh Thapa"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#044d73] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. ramesh@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#044d73] focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Password Fields in 2 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder={`Min ${MIN_PASSWORD} characters`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 pl-9 pr-9 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#044d73] focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Confirm Password <span className="text-rose-500">*</span>
                      </label>
                      {passwordsMatch && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Match
                        </span>
                      )}
                      {passwordsMismatch && (
                        <span className="text-[11px] font-medium text-rose-500">
                          No match
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full rounded-lg border pl-9 pr-9 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${passwordsMismatch
                          ? "border-rose-300 focus:ring-rose-500"
                          : "border-slate-200 focus:ring-[#044d73] focus:border-transparent"
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Password should be at least {MIN_PASSWORD} characters long. The login
                  details are emailed to the user, who is asked to change the password.
                </p>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-slate-50 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#044d73] hover:bg-[#033b59] px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {isSubmitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-100 overflow-hidden mx-auto animate-in zoom-in-95 duration-150"
          >
            <div className="flex flex-col items-center gap-3 p-5 text-center sm:gap-4 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 sm:h-14 sm:w-14">
                <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Delete Account</h2>
                <p className="mt-2 text-sm text-slate-500 px-2">
                  Are you sure you want to delete the account for{" "}
                  <span className="font-semibold text-slate-700">{deleteTarget.name}</span>? This action cannot be undone.
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
                onClick={confirmDeleteAccount}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}