import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const [manifestPath, outputPath] = process.argv.slice(2);
if (!manifestPath || !outputPath) throw new Error("Usage: node scripts/render-final-video.mjs <manifest.json> <FINAL_VIDEO.mp4>");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.music !== "off") throw new Error("Music=OFF is mandatory; render rejected.");
if (manifest.width !== 1080 || manifest.height !== 1920 || !Array.isArray(manifest.scenes) || !manifest.scenes.length) throw new Error("Invalid vertical render manifest.");
if (!Array.isArray(manifest.narration?.segments) || !manifest.narration.segments.length || !manifest.narration.captionSrtUrl) throw new Error("Narration and synchronized SRT are required.");

const workspace = join(process.cwd(), ".render-workspace");
await mkdir(workspace, { recursive: true });

async function download(url, destination) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length) throw new Error(`Downloaded an empty file from ${url}`);
  await writeFile(destination, data);
}

function safeExtension(url, fallback) {
  try {
    const extension = extname(new URL(url).pathname).toLowerCase();
    return extension && extension.length <= 8 ? extension : fallback;
  } catch {
    return fallback;
  }
}

async function run(command, args) {
  await exec(command, args, { maxBuffer: 4 * 1024 * 1024 });
}

const sceneFiles = [];
for (const scene of manifest.scenes.sort((a, b) => a.sequence - b.sequence)) {
  const duration = Math.max(0.2, (Number(scene.endTimeMs) - Number(scene.startTimeMs)) / 1_000);
  const image = join(workspace, `scene-${String(scene.sequence).padStart(3, "0")}${safeExtension(scene.visual.assetUrl, ".png")}`);
  const clip = join(workspace, `scene-${String(scene.sequence).padStart(3, "0")}.mp4`);
  await download(scene.visual.assetUrl, image);
  await run("ffmpeg", ["-y", "-loop", "1", "-i", image, "-t", String(duration), "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p", "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", clip]);
  sceneFiles.push(clip);
}

const scenesList = join(workspace, "scenes.txt");
await writeFile(scenesList, sceneFiles.map(file => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"), "utf8");
const visuals = join(workspace, "visuals.mp4");
await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", scenesList, "-c", "copy", visuals]);

const audioFiles = [];
for (const segment of manifest.narration.segments.sort((a, b) => a.index - b.index)) {
  const file = join(workspace, `narration-${String(segment.index).padStart(2, "0")}${safeExtension(segment.url, ".mp3")}`);
  await download(segment.url, file);
  audioFiles.push(file);
}
const narration = join(workspace, "narration.mp3");
if (audioFiles.length === 1) await run("ffmpeg", ["-y", "-i", audioFiles[0], "-c", "copy", narration]);
else {
  const audioList = join(workspace, "audio.txt");
  await writeFile(audioList, audioFiles.map(file => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"), "utf8");
  await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", audioList, "-c", "copy", narration]);
}

const subtitles = join(workspace, "ar.srt");
await download(manifest.narration.captionSrtUrl, subtitles);
const subtitleFilter = `subtitles=${subtitles.replace(/\\/g, "\\\\").replace(/:/g, "\\:")}:charenc=UTF-8:force_style='FontName=Noto Naskh Arabic,Fontsize=20,Alignment=2,MarginV=120,Outline=2,Shadow=0,PrimaryColour=&H00F1EADC&,OutlineColour=&H0011110F&'`;
await run("ffmpeg", ["-y", "-i", visuals, "-i", narration, "-vf", subtitleFilter, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", outputPath]);

const fileStats = await stat(outputPath);
if (!fileStats.size) throw new Error("FINAL_VIDEO.mp4 was empty.");
const probe = JSON.parse((await exec("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height", "-show_entries", "format=duration", "-of", "json", outputPath])).stdout);
const video = probe.streams?.find(stream => stream.codec_type === "video");
const audio = probe.streams?.find(stream => stream.codec_type === "audio");
if (video?.width !== 1080 || video?.height !== 1920 || !audio || !Number(probe.format?.duration)) throw new Error("FINAL_VIDEO.mp4 did not pass dimensions, audio, or duration validation.");
await run("ffmpeg", ["-v", "error", "-i", outputPath, "-f", "null", "-"]);
console.log(JSON.stringify({ file: basename(outputPath), width: video.width, height: video.height, durationSeconds: Math.round(Number(probe.format.duration)), bytes: fileStats.size }));
