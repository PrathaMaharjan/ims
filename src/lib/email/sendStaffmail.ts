import nodemailer from "nodemailer";
import { transporter } from "./send";



const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendStaffWelcomeEmail(params: {
  to: string;
  name: string;
  temporaryPassword: string;
}) {
  const loginUrl = `${process.env.APP_URL ?? ""}/login`;
  const name = esc(params.name);
  const email = esc(params.to);
  const password = esc(params.temporaryPassword);

  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    to: params.to,
    subject: "Your account has been created",
    text: [
      `Hi ${params.name},`,
      "",
      "An account has been created for you in IMS.",
      "",
      `Login: ${loginUrl}`,
      `Email: ${params.to}`,
      `Temporary password: ${params.temporaryPassword}`,
      "",
      "Please sign in and change your password right away.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#222">
        <h2 style="margin-bottom:8px">Welcome, ${name}</h2>
        <p>An account has been created for you.</p>
        <table style="border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td><b>${email}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Temporary password</td><td><b>${password}</b></td></tr>
        </table>
        <p><a href="${loginUrl}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Sign in</a></p>
        <p style="color:#b91c1c"><b>Please change your password right after your first sign-in.</b></p>
      </div>`,
  });
}