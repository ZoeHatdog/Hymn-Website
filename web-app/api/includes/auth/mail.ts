import nodemailer from "nodemailer";

export class MailConfigError extends Error {
  constructor() {
    super("Gmail is not configured.");
    this.name = "MailConfigError";
  }
}

export async function sendLoginCode(email: string, code: string) {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !pass) {
    throw new MailConfigError();
  }

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  const from = process.env.GMAIL_FROM?.trim() || user;
  await transport.sendMail({
    from,
    to: email,
    subject: "Your Hymn desk code",
    text: `Your Hymn desk sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not ask for it, you can ignore this message.`,
  });
}
