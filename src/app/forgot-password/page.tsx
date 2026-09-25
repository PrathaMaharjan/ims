'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  RotateCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import axios from 'axios';

type Step = 'EMAIL' | 'CODE' | 'NEW_PASSWORD' | 'SUCCESS';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('EMAIL');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [resetId, setResetId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-focus first OTP block when entering CODE step
  useEffect(() => {
    if (step === 'CODE') {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Helper to extract error message
  function getErrorMessage(err: unknown, fallback: string): string {
    if (axios.isAxiosError(err)) {
      return (
        err.response?.data?.error ||
        err.response?.data?.message ||
        fallback
      );
    }
    if (err instanceof Error) {
      return err.message;
    }
    return fallback;
  }

  // Step 1: Request 6-digit reset code
  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/forgetPassword', { email: trimmedEmail });
      setOtp(['', '', '', '', '', '']);
      setStep('CODE');
      setResendCooldown(60);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send reset code. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  // Resend code action
  async function handleResendCode() {
    if (resendCooldown > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/api/auth/forgetPassword', { email: email.trim() });
      setOtp(['', '', '', '', '', '']);
      setResendCooldown(60);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to resend code. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  // OTP handlers for 6 separate blocks
  function handleOtpChange(index: number, value: string) {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }

    // If multiple digits were pasted/typed into this box
    if (digits.length > 1) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        if (index + i < 6 && i < digits.length) {
          newOtp[index + i] = digits[i];
        }
      }
      setOtp(newOtp);
      const nextIdx = Math.min(index + digits.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    // Single digit
    const newOtp = [...otp];
    newOtp[index] = digits[digits.length - 1];
    setOtp(newOtp);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || '';
    }
    setOtp(newOtp);

    const targetIdx = Math.min(pasted.length, 5);
    inputRefs.current[targetIdx]?.focus();
  }

  // Step 2: Verify 6-digit code
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fullCode = otp.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the full 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/verifyResetCode', {
        email: email.trim(),
        code: fullCode,
      });

      if (res.data?.resetId) {
        setResetId(res.data.resetId);
        setStep('NEW_PASSWORD');
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid or expired verification code'));
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Set new password
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/resetPassword', {
        resetId,
        newPassword,
      });
      setStep('SUCCESS');
    } catch (err) {
      setError(getErrorMessage(err, 'Reset session expired. Please start again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f6f8] px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Brand / Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-black">
            {step === 'SUCCESS'
              ? 'SUCCESS'
              : step === 'NEW_PASSWORD'
              ? 'NEW PASSWORD'
              : 'FORGOT PASSWORD'}
          </h1>
          <p className="text-xs text-slate-500 mt-2">
            {step === 'EMAIL' && 'Enter your registered email to receive a reset code'}
            {step === 'CODE' && `Enter the 6-digit code sent to ${email}`}
            {step === 'NEW_PASSWORD' && 'Create a strong, new password for your account'}
            {step === 'SUCCESS' && 'Your account password has been updated'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-8 shadow-lg shadow-slate-200/50">
          {error && (
            <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          {/* STEP 1: Enter Email */}
          {step === 'EMAIL' && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-[#212529] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#044d73]/8 focus:border-[#044d73] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#044d73] text-white py-2.5 text-sm font-medium hover:bg-[#053f5e] active:scale-[0.99] disabled:opacity-50 transition-all shadow-sm mt-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending code…</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#044d73] transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Login
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Enter 6-Digit Code (6 Separate Blocks) */}
          {step === 'CODE' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-700">
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('EMAIL');
                      setError(null);
                    }}
                    className="text-[11px] text-[#044d73] font-medium hover:underline"
                  >
                    Change email
                  </button>
                </div>

                {/* 6 Individual Blocks */}
                <div
                  className="flex items-center justify-between gap-1.5 sm:gap-2 my-2"
                  onPaste={handleOtpPaste}
                >
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className={`h-12 w-10 sm:w-11 rounded-xl border text-center text-lg sm:text-xl font-bold transition-all focus:outline-none ${
                        digit
                          ? 'border-[#044d73] bg-white text-slate-900 shadow-sm'
                          : 'border-slate-200 bg-slate-50/60 text-slate-800 focus:bg-white'
                      } focus:border-[#044d73] focus:ring-4 focus:ring-[#044d73]/10`}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500 space-y-1 border border-slate-100">
                <p>• The code is valid for 10 minutes.</p>
                <p>• Check your spam folder if you haven&apos;t received it.</p>
              </div>

              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#044d73] text-white py-2.5 text-sm font-medium hover:bg-[#053f5e] active:scale-[0.99] disabled:opacity-50 transition-all shadow-sm mt-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying code…</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="space-y-2 pt-2 text-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || loading}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50 transition-all"
                >
                  <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : 'Resend Code'}
                </button>

                <div>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#044d73] transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Cancel & Return to Login
                  </Link>
                </div>
              </div>
            </form>
          )}

          {/* STEP 3: Enter New Password */}
          {step === 'NEW_PASSWORD' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 py-2.5 text-sm text-[#212529] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#044d73]/8 focus:border-[#044d73] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#044d73] transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 py-2.5 text-sm text-[#212529] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#044d73]/8 focus:border-[#044d73] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#044d73] transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#044d73] text-white py-2.5 text-sm font-medium hover:bg-[#053f5e] active:scale-[0.99] disabled:opacity-50 transition-all shadow-sm mt-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating password…</span>
                  </>
                ) : (
                  <>
                    <span>Reset Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 4: Success */}
          {step === 'SUCCESS' && (
            <div className="text-center space-y-5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/80">
                <CheckCircle2 className="h-7 w-7" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">Password Changed!</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your password has been successfully reset. You can now sign in using your new credentials.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#044d73] text-white py-2.5 text-sm font-medium hover:bg-[#053f5e] active:scale-[0.99] transition-all shadow-sm"
              >
                <span>Go to Login</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
