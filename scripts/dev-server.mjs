import { rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commandShell = process.env.ComSpec || "cmd.exe";

try {
  rmSync(path.join(rootDir, ".next"), { recursive: true, force: true });
} catch {
  // Best-effort cleanup so local dev starts from a clean Next build cache.
}

const child = spawn(commandShell, ["/d", "/s", "/c", "npm.cmd exec next dev"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
