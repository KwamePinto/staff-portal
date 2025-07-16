import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: `gmail`,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

export async function sendWelcomeEmail(staffEmail, staffName, tempPassword) {
  const emailTemplate = `
  <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .credentials { background-color: #e8f5e8; padding: 15px; }
      </style>
    </head>
    <body>
      <h1>Welcome to Kid's Haven International School, ${staffName}</h1>
      <div class="credentials">
        <p>Email: ${staffEmail}</p>
        <p>Password: ${tempPassword}</p>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL,
    to: staffEmail,
    subject: "Welcome to Kid's Haven International School",
    html: emailTemplate,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
