# Vercel Deployment Guide

Based on the provided images and the MIMS codebase (`package.json`, `.env.example`), here is exactly what you need to fill into the Vercel deployment fields.

## 1. Project Configuration

*   **Project Name:** `b-trust-microbanking-and-interest-management` (or whatever you prefer)
*   **Root Directory:** `./`
*   **Application Preset:** `Next.js`
*   **Build Command:** `npm run build` *(The project uses npm as indicated by `package-lock.json`)*
*   **Output Directory:** Leave as the Next.js default (which is `.next`)
*   **Install Command:** `npm install` *(Default npm behavior will work)*

**Important Prerequisite (Node.js version):** 
Before deploying, make sure you pin the Node.js version in your `package.json` to `22.x` since the `.nvmrc` specifies version 22, but your `engines` in `package.json` currently says `>=20.0.0` which might default to Node 24 on Vercel. 
Update `package.json` like this:
```json
  "engines": {
    "node": "22.x"
  }
```

## 2. Environment Variables

You need to add the following Environment Variables into the Vercel Settings. Based on the notes provided and the codebase (`.env.example`), here are the required values:

| Key | Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://mims_app:DB%40kollos%402026@ep-curly-glade-az4p2cw0.c-3.ap-southeast-1.aws.neon.tech/mims_production?sslmode=require&channel_binding=require` | Your Neon pooled connection string with TLS |
| `SESSION_SECRET` | `bf262d7006de1178065fa6fbcefcf32977dc1f682fd4a0d57843e6225cf02017` | The application secret provided for sessions |
| `CSRF_SECRET` | *(Generate a strong secret, e.g., using `openssl rand -base64 32`)* | Strong application secret for CSRF protection |
| `INTEREST_WORKER_TOKEN` | *(Generate a strong secret)* | Shared secret for the scheduled worker (POST `/api/interest-runs`) |
| `APP_BASE_URL` | *(Your Vercel deployed HTTPS URL)* | e.g., `https://your-app-name.vercel.app` |
| `BANK_TIMEZONE` | `Asia/Colombo` | Timezone configured for MIMS operations |

*(Note: Ensure you deploy migrations using `DATABASE_MIGRATION_URL` via GitHub Actions as noted in the screenshots, keep this secret out of Vercel for security purposes.)*

## Codebase Analysis & Commands

I have analyzed the `package.json` and the structure of the codebase:
- **Package Manager:** The project uses `npm` (verified via `package-lock.json`). Therefore, `npm install` and `npm run build` are the correct commands to use in Vercel.
- **Architecture matching:** The project does have a `Dockerfile` and `compose.yaml`. While Docker is very useful for local testing and isolated environments, the screenshots correctly suggest that for Vercel, the Next.js app will be hosted directly by Vercel serverless functions, Neon will host the PostgreSQL database, and GitHub Actions will handle migrations. The `MIMS_STANDALONE` environment variable should be left unset as indicated in the notes.
- **Interest Scheduling:** As per the deployment notes in the image, the Vercel Cron will send a GET request, but the interest worker requires a POST request with JSON. This means you will need an adapter function or an alternative scheduling service (like GitHub Actions cron or a custom adapter route) to trigger `/api/interest-runs`.
