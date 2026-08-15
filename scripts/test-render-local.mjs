import { createServer } from "node:http";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

const workspace = await mkdtemp(join(tmpdir(), "nusgh-render-test-"));
await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=0x11110f:s=1080x1920:d=1", "-frames:v", "1", join(workspace, "scene.png")]);
await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=1", "-c:a", "libmp3lame", join(workspace, "narration.mp3")]);
await writeFile(join(workspace, "ar.srt"), "1\n00:00:00,000 --> 00:00:01,000\nاختبار نُسغ\n", "utf8");

const server = createServer(async (req, res) => {
  const allowed = new Map([["/scene.png", "image/png"], ["/narration.mp3", "audio/mpeg"], ["/ar.srt", "application/x-subrip"]]);
  const type = allowed.get(req.url ?? "");
  if (!type) return res.writeHead(404).end();
  const data = await readFile(join(workspace, req.url.slice(1)));
  res.writeHead(200, { "content-type": type });
  res.end(data);
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Local test server did not bind.");
const base = `http://127.0.0.1:${address.port}`;
const manifest = {
  version: 1,
  videoId: 999,
  jobId: 999,
  title: "NUSGH Local Render Test",
  width: 1080,
  height: 1920,
  music: "off",
  scenes: [{ sequence: 1, startTimeMs: 0, endTimeMs: 1_000, visual: { type: "test", assetUrl: `${base}/scene.png` }, caption: "اختبار نُسغ" }],
  narration: { durationMs: 1_000, segments: [{ index: 1, url: `${base}/narration.mp3` }], captionSrtUrl: `${base}/ar.srt` },
};
const manifestPath = join(workspace, "manifest.json");
const outputPath = join(workspace, "FINAL_VIDEO.mp4");
await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
try {
  await run("node", ["scripts/render-final-video.mjs", manifestPath, outputPath], { cwd: process.cwd() });
  const output = await stat(outputPath);
  if (output.size < 1_000) throw new Error("FINAL_VIDEO.mp4 is unexpectedly small.");
  console.log(`LOCAL_RENDER_TEST_OK bytes=${output.size} output=${outputPath}`);
} finally {
  await new Promise(resolve => server.close(resolve));
}
