"use client";

import { useState, useEffect, useRef, ChangeEvent, FormEvent } from "react";
import {
    Building2,
    User,
    Upload,
    Trash2,
    Check,
    Save,
    ImageIcon,
    Settings as SettingsIcon,
    KeyRound,
    Eye,
    EyeOff,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";

interface OrgDetails {
    businessName: string;
    panVatNumber: string;
    vatRegistered: boolean;
    address: string;
    phone: string;
    email: string;
}

const DEFAULT_ORG: OrgDetails = {
    businessName: "pharma",
    panVatNumber: "301234567",
    vatRegistered: true,
    address: "Kathmandu, Nepal",
    phone: "9800000000",
    email: "info@citypharmacy.com",
};

export default function SettingsPage() {
    const { user: authUser } = useAuth();
    const [activeTab, setActiveTab] = useState<"org" | "user" | "password">("org");

    // Organization details state
    const [orgForm, setOrgForm] = useState<OrgDetails>(DEFAULT_ORG);
    const [logoUrl, setLogoUrl] = useState<string>("");

    // User details state
    const [userForm, setUserForm] = useState({
        name: authUser?.name || "Sophan",
        email: authUser?.email || "owner@gmail.com",
    });

    // Password form state (frontend-only)
    const [passwordForm, setPasswordForm] = useState({
        current: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    // Toast message state
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load static values from localStorage on mount
    useEffect(() => {
        try {
            const savedOrg = localStorage.getItem("pharma_org_details");
            if (savedOrg) {
                setOrgForm(JSON.parse(savedOrg));
            }
            const savedLogo = localStorage.getItem("pharma_logo");
            if (savedLogo) {
                setLogoUrl(savedLogo);
            }
            const savedUserName = localStorage.getItem("pharma_user_name");
            const savedUserEmail = localStorage.getItem("pharma_user_email");
            if (savedUserName || savedUserEmail) {
                setUserForm({
                    name: savedUserName || authUser?.name || "Sophan",
                    email: savedUserEmail || authUser?.email || "owner@gmail.com",
                });
            }
        } catch (e) {
            console.error("Error loading settings:", e);
        }
    }, [authUser]);

    const triggerToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Save organization details
    const handleSaveOrg = (e: FormEvent) => {
        e.preventDefault();
        try {
            localStorage.setItem("pharma_org_details", JSON.stringify(orgForm));
            localStorage.setItem("pharma_business_name", orgForm.businessName);
            if (logoUrl) {
                localStorage.setItem("pharma_logo", logoUrl);
            } else {
                localStorage.removeItem("pharma_logo");
            }
            window.dispatchEvent(new Event("pharma_org_updated"));
            triggerToast("Organization details updated successfully!");
        } catch (e) {
            console.error("Failed to save org details:", e);
        }
    };

    // Handle logo upload
    const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Please choose a valid image file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            setLogoUrl(dataUrl);
            try {
                localStorage.setItem("pharma_logo", dataUrl);
                window.dispatchEvent(new Event("pharma_org_updated"));
                triggerToast("Logo uploaded and updated in sidebar!");
            } catch (err) {
                console.error("Error saving logo:", err);
            }
        };
        reader.readAsDataURL(file);
    };

    // Remove logo
    const handleRemoveLogo = () => {
        setLogoUrl("");
        try {
            localStorage.removeItem("pharma_logo");
            window.dispatchEvent(new Event("pharma_org_updated"));
            triggerToast("Logo removed from sidebar.");
        } catch (err) {
            console.error("Error removing logo:", err);
        }
    };

    // Save user details
    const handleSaveUser = (e: FormEvent) => {
        e.preventDefault();
        try {
            localStorage.setItem("pharma_user_name", userForm.name);
            localStorage.setItem("pharma_user_email", userForm.email);
            triggerToast("User details updated successfully!");
        } catch (e) {
            console.error("Failed to save user details:", e);
        }
    };

    // Handle password change (frontend only)
    const handleSavePassword = (e: FormEvent) => {
        e.preventDefault();
        setPasswordError(null);

        if (!passwordForm.current) {
            setPasswordError("Please enter your current password.");
            return;
        }
        if (passwordForm.newPassword.length < 6) {
            setPasswordError("New password must be at least 6 characters long.");
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError("New passwords do not match.");
            return;
        }

        setPasswordForm({ current: "", newPassword: "", confirmPassword: "" });
        triggerToast("Password changed successfully!");
    };

    return (
        <div className="flex flex-col gap-8 pb-12">
            {/* Toast notification */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <span className="text-sm font-medium">{toastMessage}</span>
                </div>
            )}

            {/* Header */}
            <div className="rounded-xl bg-[#044d73] px-6 py-6 text-white shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">

                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab("org")}
                    className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${activeTab === "org"
                            ? "border-[#044d73] text-[#044d73]"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                >
                    <Building2 className="h-4 w-4" />
                    Organization Details
                </button>
                <button
                    onClick={() => setActiveTab("user")}
                    className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${activeTab === "user"
                            ? "border-[#044d73] text-[#044d73]"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                >
                    <User className="h-4 w-4" />
                    User Details
                </button>
                <button
                    onClick={() => setActiveTab("password")}
                    className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${activeTab === "password"
                            ? "border-[#044d73] text-[#044d73]"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                >
                    <KeyRound className="h-4 w-4" />
                    Change Password
                </button>
            </div>

            {/* Organization Details Tab */}
            {activeTab === "org" && (
                <form onSubmit={handleSaveOrg} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                    {/* Logo Section */}
                    <div className="border-b border-slate-100 pb-6">
                        <h3 className="text-sm font-bold text-slate-900 mb-1">Organization Logo</h3>

                        <div className="flex items-center gap-5 mt-3">
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-50 shadow-sm">
                                {logoUrl ? (
                                    <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
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
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleLogoUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 rounded-lg bg-[#044d73] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#033f60] transition-colors"
                                >
                                    <Upload className="h-4 w-4" />
                                    Upload Logo
                                </button>

                                {logoUrl && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveLogo}
                                        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Remove Logo
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Specific 5 Fields (businessName, panVatNumber, phone, email, address) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                        {/* Business Name */}
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">
                                Business Name
                            </label>
                            <input
                                type="text"
                                required
                                value={orgForm.businessName}
                                onChange={(e) => setOrgForm({ ...orgForm, businessName: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>

                        {/* PAN / VAT Number */}
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">
                                PAN / VAT Number
                            </label>
                            <input
                                type="text"
                                value={orgForm.panVatNumber}
                                onChange={(e) => setOrgForm({ ...orgForm, panVatNumber: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">
                                Phone
                            </label>
                            <input
                                type="text"
                                value={orgForm.phone}
                                onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                value={orgForm.email}
                                onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>

                        {/* Address */}
                        <div className="sm:col-span-2">
                            <label className="block font-semibold text-slate-700 mb-1.5">
                                Address
                            </label>
                            <input
                                type="text"
                                value={orgForm.address}
                                onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            className="flex items-center gap-2 rounded-lg bg-[#044d73] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#033f60] transition-colors"
                        >
                            <Save className="h-4 w-4" />
                            Save Organization Details
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
                        <p className="text-xs text-slate-500 mt-0.5">
                            Update personal account name and contact email
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">
                                Name
                            </label>
                            <input
                                type="text"
                                required
                                value={userForm.name}
                                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>

                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                value={userForm.email}
                                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            className="flex items-center gap-2 rounded-lg bg-[#044d73] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#033f60] transition-colors"
                        >
                            <Save className="h-4 w-4" />
                            Save User Details
                        </button>
                    </div>
                </form>
            )}

            {/* Change Password Tab (Frontend-only) */}
            {activeTab === "password" && (
                <form onSubmit={handleSavePassword} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                    <div className="border-b border-slate-100 pb-3">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-[#044d73]" />
                            Change Password
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Update your login password to secure your account
                        </p>
                    </div>

                    {passwordError && (
                        <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-600 font-medium">
                            {passwordError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                        {/* Current Password */}
                        <div className="sm:col-span-2">
                            <label className="block font-semibold text-slate-700 mb-1.5">
                                Current Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showCurrent ? "text" : "password"}
                                    required
                                    value={passwordForm.current}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                                    placeholder="Enter current password"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrent(!showCurrent)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* New Password */}
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showNew ? "text" : "password"}
                                    required
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    placeholder="At least 6 characters"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(!showNew)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block font-semibold text-slate-700 mb-1.5">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? "text" : "password"}
                                    required
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    placeholder="Re-enter new password"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#044d73] focus:outline-none focus:ring-1 focus:ring-[#044d73]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            className="flex items-center gap-2 rounded-lg bg-[#044d73] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#033f60] transition-colors"
                        >
                            <Save className="h-4 w-4" />
                            Update Password
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
