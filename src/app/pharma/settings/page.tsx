"use client";

import { useState, useEffect, useRef, ChangeEvent, FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Building2,
    User,
    Upload,
    Trash2,
    Check,
    Save,
    ImageIcon,
    KeyRound,
    Eye,
    EyeOff,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api-client";

interface OrgDetails {
    businessName: string;
    logoUrl: string | null;
    panVatNumber: string;
    vatRegistered: boolean;
    address: string;
    phone: string;
    email: string;
}

export default function SettingsPage() {
    const { user: authUser, logout } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"org" | "user" | "password">("org");

    const [orgForm, setOrgForm] = useState<OrgDetails | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null); // local preview only, until saved
    const [pendingLogoDataUri, setPendingLogoDataUri] = useState<string | null>(null);

    const [userForm, setUserForm] = useState({ name: "", email: "" });

    const [passwordForm, setPasswordForm] = useState({
        current: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [savingOrg, setSavingOrg] = useState(false);
    const [savingUser, setSavingUser] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);

    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    function triggerToast(msg: string) {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    }

    // Organization data and user profile are independent — fetch in parallel.
    // (User profile isn't refetched here since AuthProvider already holds it
    // via /auth/me; we just seed the form from context once it's available.)
    useEffect(() => {
        async function loadSettings() {
            setLoading(true);
            setLoadError(null);
            try {
                const orgRes = await api.get("/api/organization");
                setOrgForm(orgRes.data.organization);
            } catch {
                setLoadError("Failed to load organization details.");
            } finally {
                setLoading(false);
            }
        }
        loadSettings();
    }, []);

    useEffect(() => {
        if (authUser) {
            setUserForm({ name: authUser.name, email: authUser.email });
        }
    }, [authUser]);

    async function handleSaveOrg(e: FormEvent) {
        e.preventDefault();
        if (!orgForm) return;

        setSavingOrg(true);
        try {
            const payload: Record<string, unknown> = {
                businessName: orgForm.businessName,
                panVatNumber: orgForm.panVatNumber || undefined,
                vatRegistered: orgForm.vatRegistered,
                address: orgForm.address || undefined,
                phone: orgForm.phone || undefined,
                email: orgForm.email || undefined,
            };
            // Logo is only sent when a new file was actually chosen this session —
            // avoids re-uploading to Cloudinary on every unrelated field save.
            if (pendingLogoDataUri) {
                payload.logoDataUri = pendingLogoDataUri;
            }

            const res = await api.patch("/api/organization", payload);
            setOrgForm(res.data.organization);
            setPendingLogoDataUri(null);
            setLogoPreview(null);
            triggerToast("Organization details updated successfully!");
        } catch {
            triggerToast("Failed to save organization details.");
        } finally {
            setSavingOrg(false);
        }
    }

    function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            triggerToast("Please choose a valid image file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            setLogoPreview(dataUrl);
            setPendingLogoDataUri(dataUrl);
        };
        reader.readAsDataURL(file);
    }

    function handleRemoveLogoPreview() {

        setLogoPreview(null);
        setPendingLogoDataUri(null);
    }

    async function handleSaveUser(e: FormEvent) {
        e.preventDefault();
        setSavingUser(true);
        try {
            await api.patch("/api/users/me", {
                name: userForm.name,
                email: userForm.email,
            });
            triggerToast("User details updated successfully!");
        } catch (err: any) {
            triggerToast(err?.response?.data?.error ?? "Failed to save user details.");
        } finally {
            setSavingUser(false);
        }
    }

    async function handleSavePassword(e: FormEvent) {
        e.preventDefault();
        setPasswordError(null);

        if (!passwordForm.current) {
            setPasswordError("Please enter your current password.");
            return;
        }
        if (passwordForm.newPassword.length < 8) {
            setPasswordError("New password must be at least 8 characters long.");
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError("New passwords do not match.");
            return;
        }

        setSavingPassword(true);
        try {
            await api.patch("/api/users/password", {
                currentPassword: passwordForm.current,
                newPassword: passwordForm.newPassword,
            });
            setPasswordForm({ current: "", newPassword: "", confirmPassword: "" });
            // The server just invalidated every session for this user, including
            // this one's refresh token — log out immediately so the next API
            // call doesn't 401 unexpectedly, and send them to log back in.
            triggerToast("Password changed. Please log in again.");
            await logout();
            router.push("/login");
        } catch (err: any) {
            setPasswordError(err?.response?.data?.error ?? "Failed to change password.");
        } finally {
            setSavingPassword(false);
        }
    }

    if (loading) {
        return <div className="py-16 text-center text-sm text-slate-400">Loading settings...</div>;
    }

    if (loadError || !orgForm) {
        return (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {loadError ?? "Failed to load settings."}
            </div>
        );
    }

    const displayedLogo = logoPreview ?? orgForm.logoUrl;

    return (
        <div className="flex flex-col gap-8 pb-12">
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-2xl">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <span className="text-sm font-medium">{toastMessage}</span>
                </div>
            )}

            <div className="rounded-xl bg-[#044d73] px-6 py-6 text-white shadow-sm flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                </div>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab("org")}
                    className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${activeTab === "org" ? "border-[#044d73] text-[#044d73]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                >
                    <Building2 className="h-4 w-4" />
                    Organization Details
                </button>
                <button
                    onClick={() => setActiveTab("user")}
                    className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${activeTab === "user" ? "border-[#044d73] text-[#044d73]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                >
                    <User className="h-4 w-4" />
                    User Details
                </button>
                <button
                    onClick={() => setActiveTab("password")}
                    className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${activeTab === "password" ? "border-[#044d73] text-[#044d73]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                >
                    <KeyRound className="h-4 w-4" />
                    Change Password
                </button>
            </div>

            {/* Organization Details Tab */}
            {activeTab === "org" && (
                <form onSubmit={handleSaveOrg} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                    <div className="border-b border-slate-100 pb-6">
                        <h3 className="text-sm font-bold text-slate-900 mb-1">Organization Logo</h3>

                        <div className="flex items-center gap-5 mt-3">
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-50 shadow-sm">
                                {displayedLogo ? (
                                    <img src={displayedLogo} alt="Logo" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <ImageIcon className="h-6 w-6 mb-0.5 stroke-1" />
                                        <span className="text-xs font-bold text-[#044d73]">
                                            {orgForm.businessName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <input type="file" ref={fileInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 rounded-lg bg-[#044d73] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#033f60] transition-colors"
                                >
                                    <Upload className="h-4 w-4" />
                                    Upload Logo
                                </button>

                                {pendingLogoDataUri && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveLogoPreview}
                                        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Cancel New Logo
                                    </button>
                                )}
                            </div>
                        </div>
                        {pendingLogoDataUri && (
                            <p className="text-[11px] text-amber-600 mt-2">New logo selected — click "Save" below to upload it.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">Business Name</label>
                            <input
                                type="text" required value={orgForm.businessName}
                                onChange={(e) => setOrgForm({ ...orgForm, businessName: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>

                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">PAN / VAT Number</label>
                            <input
                                type="text" value={orgForm.panVatNumber ?? ""}
                                onChange={(e) => setOrgForm({ ...orgForm, panVatNumber: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>

                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">Phone</label>
                            <input
                                type="text" value={orgForm.phone ?? ""}
                                onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>

                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">Email</label>
                            <input
                                type="email" value={orgForm.email ?? ""}
                                onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block font-semibold text-slate-700 mb-1.5">Address</label>
                            <input
                                type="text" value={orgForm.address ?? ""}
                                onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={savingOrg}
                            className="flex items-center gap-2 rounded-lg bg-[#044d73] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#033f60] transition-colors disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {savingOrg ? "Saving..." : "Save Organization Details"}
                        </button>
                    </div>
                </form>
            )}

            {/* User Details Tab */}
            {activeTab === "user" && (
                <form onSubmit={handleSaveUser} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                    <div className="border-b border-slate-100 pb-3">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <User className="h-4 w-4 text-[#044d73]" />
                            User Details
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Update personal account name and contact email</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">Name</label>
                            <input
                                type="text" required value={userForm.name}
                                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>

                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">Email</label>
                            <input
                                type="email" required value={userForm.email}
                                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={savingUser}
                            className="flex items-center gap-2 rounded-lg bg-[#044d73] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#033f60] transition-colors disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {savingUser ? "Saving..." : "Save User Details"}
                        </button>
                    </div>
                </form>
            )}

            {/* Change Password Tab */}
            {activeTab === "password" && (
                <form onSubmit={handleSavePassword} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                    <div className="border-b border-slate-100 pb-3">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-[#044d73]" />
                            Change Password
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Update your login password to secure your account. You'll be logged out of every device afterward.
                        </p>
                    </div>

                    {passwordError && (
                        <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-600 font-medium">
                            {passwordError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                        <div className="sm:col-span-2">
                            <label className="block font-semibold text-slate-700 mb-1.5">Current Password</label>
                            <div className="relative">
                                <input
                                    type={showCurrent ? "text" : "password"} required
                                    value={passwordForm.current}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                                    placeholder="Enter current password"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                />
                                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">New Password</label>
                            <div className="relative">
                                <input
                                    type={showNew ? "text" : "password"} required
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    placeholder="At least 8 characters"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                />
                                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? "text" : "password"} required
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    placeholder="Re-enter new password"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={savingPassword}
                            className="flex items-center gap-2 rounded-lg bg-[#044d73] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#033f60] transition-colors disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {savingPassword ? "Updating..." : "Update Password"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}