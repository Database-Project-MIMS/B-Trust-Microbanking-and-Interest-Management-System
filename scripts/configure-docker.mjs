import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--neon")) {
  console.error("Use configure-docker.mjs with no arguments or --neon.");
  process.exit(1);
}
const neon = args[0] === "--neon";
const file = neon ? ".env.neon" : ".env.docker";
const names = [...(neon ? [] : ["MIMS_POSTGRES_PASSWORD", "MIMS_OWNER_PASSWORD", "MIMS_APP_PASSWORD"]),
  "SESSION_SECRET", "CSRF_SECRET", "INTEREST_WORKER_TOKEN"];
const contents = (neon ? "NEON_DATABASE_URL=\n" : "")
  + names.map(name => `${name}=${randomBytes(32).toString("hex")}`).join("\n")
  + (neon ? "\nMIMS_NEON_HTTP_PORT=3001\nAPP_BASE_URL=http://localhost:3001\nPGPOOL_MAX=10\n"
    : "\nMIMS_HTTP_PORT=3000\nAPP_BASE_URL=http://localhost:3000\nPGPOOL_MAX=10\n");
try {
  writeFileSync(file, contents, { flag: "wx", mode: 0o600 });
  console.log(neon ? "Created .env.neon with runtime secrets. Fill NEON_DATABASE_URL with the Neon mims_app connection."
    : "Created .env.docker with local synthetic-stack secrets. Existing files are never overwritten.");
} catch (error) {
  console.error(error.code === "EEXIST" ? `${file} already exists; edit it locally if needed.`
    : `Could not create ${file}.`);
  process.exitCode = 1;
}
