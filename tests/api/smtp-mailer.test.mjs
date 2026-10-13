import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { notificationsEnabled, smtpMailer, verifySmtpConnection } from '../../lib/email/mailer.ts';

// TypeScript is loaded as CommonJS here; mock that same conditional export.
const nodemailer = createRequire(import.meta.url)('nodemailer');

test('Gmail mailer normalizes app passwords, requires TLS, falls back from blank MAIL_FROM, and rejects undelivered mail', async () => {
  const keys = ['SMTP_USER', 'SMTP_APP_PASSWORD', 'SMTP_HOST', 'SMTP_PORT', 'MAIL_FROM', 'NOTIFICATIONS_ENABLED'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  let configuration, message, verified = false, rejected = false;
  const transportMock = mock.method(nodemailer, 'createTransport', options => {
    configuration = options;
    return {
      verify: async () => { verified = true; },
      sendMail: async value => {
        message = value;
        return rejected ? { accepted: [], rejected: [value.to] } : { accepted: [value.to], rejected: [] };
      },
    };
  });
  try {
    process.env.NOTIFICATIONS_ENABLED = 'true';
    process.env.SMTP_USER = 'sender@example.invalid ';
    process.env.SMTP_APP_PASSWORD = '    ';
    assert.equal(notificationsEnabled(), false);
    process.env.SMTP_APP_PASSWORD = 'abcd efgh ijkl mnop'; // Synthetic credential.
    process.env.SMTP_PORT = '25';
    await assert.rejects(verifySmtpConnection(), /465 or 587/);
    process.env.SMTP_PORT = ' 587 ';
    process.env.SMTP_HOST = '';
    process.env.MAIL_FROM = '';
    assert.equal(notificationsEnabled(), true);
    await verifySmtpConnection();
    assert.equal(verified, true);
    assert.equal(configuration.host, 'smtp.gmail.com');
    assert.equal(configuration.port, 587);
    assert.equal(configuration.secure, false);
    assert.equal(configuration.requireTLS, true);
    assert.equal(configuration.tls.minVersion, 'TLSv1.2');
    assert.equal(configuration.auth.pass, 'abcdefghijklmnop');
    const email = { to: 'recipient@example.invalid', subject: 'Test', text: 'Test', html: '<p>Test</p>', messageId: 'stable-test-id' };
    await smtpMailer.send(email);
    assert.deepEqual(message.from, { name: 'B-Trust Microfinance', address: 'sender@example.invalid' });
    assert.equal(message.messageId, '<stable-test-id@btrust.mims>');
    rejected = true;
    await assert.rejects(smtpMailer.send(email), error => error.code === 'ERECIPIENT');
  } finally {
    transportMock.mock.restore();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
