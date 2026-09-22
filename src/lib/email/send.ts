import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(to: string, code: string) {
  const companyName = "Pharma"; 
  
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
        
        <!-- Header -->
        <div style="background-color: #1a56db; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">${companyName}</h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 32px;">
          <h2 style="color: #111827; margin-top: 0; font-size: 20px; font-weight: 600;">Password Reset Request</h2>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
            Hello,
            <br><br>
            We received a request to reset the password for your account. Please use the verification code below to complete the process.
          </p>
          
          <!-- Code Container -->
          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: 700; color: #111827; letter-spacing: 6px;">${code}</span>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
            This code will expire in <strong>10 minutes</strong>. 
            <br><br>
            If you did not request a password reset, please ignore this email or contact support if you have concerns. Your account remains secure.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;

  const textTemplate = `Password Reset Request\n\nHello,\n\nWe received a request to reset your password. Your verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you did not request a password reset, please ignore this email.\n\nBest regards,\nThe ${companyName} Team`;

  try {
    await transporter.sendMail({
      from: `"${companyName} Support" <${process.env.SMTP_FROM}>`,
      to,
      subject: "Action Required: Reset Your Password",
      text: textTemplate,
      html: htmlTemplate,
    });
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    throw new Error("Could not send password reset email");
  }
}