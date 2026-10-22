import { mkdir, readFile, writeFile, rename, chmod } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { supplierSchema } from "../shared/contracts";
export const storeDir = join(process.env.PASEO_HOME || join(homedir(), ".paseo"), "model-providers");
const file = join(storeDir, "suppliers.json");
const schema = z.array(supplierSchema.extend({ key: z.string() }));
export async function readStore() {
  let text: string;
  try { text = await readFile(file, "utf8"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("无法读取供应商配置");
    text = "[]";
  }
  return { suppliers: schema.parse(JSON.parse(text)), revision: createHash("sha256").update(text).digest("hex") };
}
export async function writeStore(suppliers: z.infer<typeof schema>) {
  await mkdir(storeDir, { recursive: true, mode: 0o700 });
  await chmod(storeDir, 0o700);
  const tmp = join(storeDir, `${randomUUID()}.tmp`);
  await writeFile(tmp, JSON.stringify(suppliers, null, 2), { mode: 0o600, flag: "wx" });
  await rename(tmp, file);
}
