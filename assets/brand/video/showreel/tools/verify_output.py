"""Check the delivered file, including a complete audio/video decode."""
from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
VIDEO = ROOT / 'renders/vetor-urbano-showreel-15s.mp4'
if not VIDEO.is_file() or VIDEO.stat().st_size == 0:
    raise SystemExit(f'Arquivo ausente/vazio: {VIDEO.name}')
probe = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-count_frames', '-show_format', '-show_streams',
    '-of', 'json', str(VIDEO),
], text=True))
video = next(s for s in probe['streams'] if s['codec_type'] == 'video')
audio = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
checks = {
    'duration_15_seconds': abs(float(probe['format']['duration']) - 15) <= .001,
    'canvas_1920_1080': (video['width'], video['height']) == (1920, 1080),
    'fps_60': video['avg_frame_rate'] == '60/1',
    'frames_900': int(video['nb_read_frames']) == 900,
    'video_h264': video['codec_name'] == 'h264',
    'audio_aac_stereo_48k': audio['codec_name'] == 'aac'
        and audio['channels'] == 2 and int(audio['sample_rate']) == 48000,
}
decode = subprocess.run([
    'ffmpeg', '-nostdin', '-hide_banner', '-v', 'error', '-xerror',
    '-i', str(VIDEO), '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-',
], capture_output=True, text=True)
checks['full_decode_without_errors'] = decode.returncode == 0 and not decode.stderr.strip()
if not checks['full_decode_without_errors']:
    print(decode.stderr)
report = {
    'file': str(VIDEO.relative_to(ROOT)), 'bytes': VIDEO.stat().st_size,
    'sha256': hashlib.sha256(VIDEO.read_bytes()).hexdigest(),
    'checks': checks, 'all_passed': all(checks.values()),
    'duration_s': float(probe['format']['duration']),
    'frames': int(video['nb_read_frames']), 'fps': video['avg_frame_rate'],
    'width': video['width'], 'height': video['height'],
    'audio_channels': audio['channels'], 'audio_sample_rate': audio['sample_rate'],
}
(ROOT / 'renders/ffprobe.json').write_text(json.dumps(probe, indent=2) + '\n')
(ROOT / 'renders/verification.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
if not report['all_passed']:
    raise SystemExit(1)
