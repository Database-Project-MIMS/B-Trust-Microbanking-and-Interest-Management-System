import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const names = ["MIMS_POSTGRES_PASSWORD", "MIMS_OWNER_PASSWORD", "MIMS_APP_PASSWORD",
  "SESSION_SECRET", "CSRF_SECRET", "INTEREST_WORKER_TOKEN"];
const contents = names.map(name => `${name}=${randomBytes(32).toString("hex")}`).join("\n")
  + "\nMIMS_HTTP_PORT=3000\nAPP_BASE_URL=http://localhost:3000\nPGPOOL_MAX=10\n";
try {
  writeFileSync(".env.docker", contents, { flag: "wx", mode: 0o600 });
  console.log("Created .env.docker with local synthetic-stack secrets. Existing files are never overwritten.");
} catch (error) {
  console.error(error.code === "EEXIST" ? ".env.docker already exists; edit it locally if needed."
    : "Could not create .env.docker.");
  process.exitCode = 1;
}
