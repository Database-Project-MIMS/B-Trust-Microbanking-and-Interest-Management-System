import { randomUUID } from "node:crypto";
import { z } from "zod";
import { smtpMailer, verifySmtpConnection } from "../lib/email/mailer";

// Explicit recipient only; never drains the database queue or changes bank data.
async function main(): Promise<void> {
  try {
    const to = z.string().email().parse(process.argv[2]);
    await verifySmtpConnection();
    console.log("Gmail SMTP authentication succeeded.");
    await smtpMailer.send({
      to,
      subject: "B-Trust Gmail SMTP test",
      text: "This is an authorized B-Trust email service delivery test. No bank transaction was performed and no customer information is included.",
      html: "<p>This is an authorized B-Trust email service delivery test.</p><p>No bank transaction was performed and no customer information is included.</p>",
      messageId: randomUUID(),
    });
    console.log(`Gmail accepted the test email for ${to}. Check the inbox or spam folder.`);
  } catch (error) {
    const knownCodes = ["EAUTH", "ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ERECIPIENT", "EENVELOPE", "EMESSAGE"];
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "CONFIGURATION";
    console.error(`Email test failed (${knownCodes.includes(code) ? code : "CONFIGURATION"}). Provider details are redacted.`);
    process.exitCode = 1;
  }
}

void main();
