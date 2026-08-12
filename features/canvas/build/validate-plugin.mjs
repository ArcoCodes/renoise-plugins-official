import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
const validator = join(codexHome, "skills", ".system", "plugin-creator", "scripts", "validate_plugin.py");
if (!existsSync(validator)) {
  throw new Error(`Official plugin-creator validator not found at ${validator}. Run this command from a Codex development environment.`);
}

const environment = { ...process.env };
try {
  await execFileAsync("python3", ["-c", "import yaml"], { env: environment });
  const { stdout, stderr } = await execFileAsync("python3", [validator, "."], { env: environment, maxBuffer: 1024 * 1024 });
  process.stdout.write(stdout);
  process.stderr.write(stderr);
} catch (initialError) {
  const text = `${initialError instanceof Error ? initialError.message : initialError}`;
  if (!/yaml|PyYAML/i.test(text)) throw initialError;
  const temporary = await mkdtemp(join(tmpdir(), "renoise-plugin-validator-"));
  try {
    await execFileAsync("python3", ["-m", "venv", temporary], { maxBuffer: 1024 * 1024 });
    const python = process.platform === "win32" ? join(temporary, "Scripts", "python.exe") : join(temporary, "bin", "python");
    await execFileAsync(python, ["-m", "pip", "install", "--quiet", "PyYAML==6.0.2"], { maxBuffer: 4 * 1024 * 1024 });
    const { stdout, stderr } = await execFileAsync(python, [validator, "."], {
      env: { ...environment, PATH: `${join(temporary, process.platform === "win32" ? "Scripts" : "bin")}${delimiter}${environment.PATH ?? ""}` },
      maxBuffer: 1024 * 1024,
    });
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
