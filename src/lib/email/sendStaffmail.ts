import nodemailer from "nodemailer";
import { transporter } from "./send";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function sendStaffWelcomeEmail(params: {
  to: string;
  name: string;
  temporaryPassword: string;
  appName?: string;
}) {
  const appUrl = process.env.BASE_URL ?? "";
  const loginUrl = `${appUrl}/login`;
  const appName = params.appName ?? process.env.APP_NAME ?? "Our Platform";

  const rawName = params.name.trim();
  const rawEmail = params.to.trim();
  const rawPassword = params.temporaryPassword;

  const safeName = esc(rawName);
  const safeEmail = esc(rawEmail);
  const safePassword = esc(rawPassword);
  const safeAppName = esc(appName);

  const plainText = [
    `Welcome to ${appName || "IMS"}!`,
    "",
    `Hello ${rawName},`,
    "",
    `An account has been created for you. You can log in using the details below:`,
    "",
    `  • Sign In URL: ${loginUrl}`,
    `  • Email: ${rawEmail}`,
    `  • Temporary Password: ${rawPassword}`,
    "",
    "SECURITY NOTICE:",
    "For security reasons, please log in and update your password immediately.",
    "",
    `If you have any questions, please contact your administrator.`,
    "",
    `Best regards,`,
    `The ${appName} Team`,
  ].join("\n");

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${safeAppName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; border-spacing: 0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #044d73; padding: 28px 32px; text-align: left;">
              <span style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #93c5fd; display: block; margin-bottom: 4px;">Welcome Aboard</span>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.3;">Your account is ready</h1>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hello <strong>${safeName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                An account has been provisioned for you on <strong>${safeAppName}</strong>. Below are your temporary credentials to access the workspace:
              </p>

              <!-- Credentials Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; border-radius: 8px; margin-bottom: 24px; border: 1px solid #cbd5e1;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom: 8px; font-size: 13px; color: #64748b; width: 120px;">Email Address</td>
                        <td style="padding-bottom: 8px; font-size: 14px; font-weight: 600; color: #0f172a;">${safeEmail}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #64748b;">Temp Password</td>
                        <td style="font-size: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: #044d73; background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px; display: inline-block;">${safePassword}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Call to Action -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                 <a href="${loginUrl}" target="_blank" style="background-color: #044d73; ...">
  Sign In to Your Account &rarr;
</a>
                  </td>
                </tr>
              </table>

              <!-- Security Callout -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 6px 6px 0; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #991b1b;">
                      <strong>Action Required:</strong> Please change your temporary password immediately after logging in for the first time.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                If you were not expecting this email or have any questions, please reach out to your system administrator.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} ${safeAppName}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    to: params.to,
    subject: `Welcome to ${appName} – Account Created`,
    text: plainText,
    html: htmlContent,
  });
}
