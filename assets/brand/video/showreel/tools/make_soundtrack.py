"""Original 15 s / 128 BPM instrumental score. Python standard library only.

Run from this project: python3 tools/make_soundtrack.py
No audio from the inspiration video is sampled. Seeded noise is reproducible.
"""
from array import array
from pathlib import Path
import json
import math
import random
import wave

RATE = 48000
DURATION = 15
BEAT = 60 / 128
N = RATE * DURATION
TAU = 2 * math.pi
ROOT = Path(__file__).resolve().parents[1]
left, right = array('d', [0]) * N, array('d', [0]) * N
rng = random.Random(1282026)


def add(start, length, fn, gain=1, pan=0, echo=0):
    first = int(start * RATE)
    count = min(int(length * RATE), N - first)
    gl = math.sqrt((1 - pan) / 2) * gain
    gr = math.sqrt((1 + pan) / 2) * gain
    for k in range(max(0, count)):
        t = k / RATE
        value = fn(t, k)
        idx = first + k
        left[idx] += value * gl
        right[idx] += value * gr
        if echo:
            for offset, factor in ((int(BEAT * .75 * RATE), .26),
                                   (int(BEAT * 1.5 * RATE), .10)):
                if idx + offset < N:
                    left[idx + offset] += value * gr * factor
                    right[idx + offset] += value * gl * factor


def frequency(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def pluck(midi, duration=.62):
    f = frequency(midi)
    def signal(t, k):
        attack = min(1, t / .007)
        env = attack * math.exp(-t * 8) * min(1, max(0, (duration - t) / .09))
        return env * (math.sin(TAU * f * t) + .23 * math.sin(TAU * 2 * f * t)
                      + .08 * math.sin(TAU * 3 * f * t))
    return signal


# Warm extended harmony, C minor -> Abmaj7 -> Ebmaj9 -> Bb(add9).
chords = ((48, 55, 58, 62, 67), (44, 51, 55, 60, 67),
          (51, 58, 62, 65, 70), (46, 53, 60, 62, 65))
for bar in range(8):
    chord = chords[bar // 2]
    length = 4 * BEAT + .25
    start = bar * 4 * BEAT
    def pad(t, k, chord=chord, length=length):
        env = min(1, t / .26) * min(1, max(0, (length - t) / .55))
        value = sum(math.sin(TAU * frequency(m) * t)
                    + .15 * math.sin(TAU * frequency(m) * 1.002 * t)
                    for m in chord)
        return value * env / len(chord)
    add(start, length, pad, .10, -.22 if bar % 2 else .22)

for beat in range(28):
    at = beat * BEAT
    weight = .22 if beat < 20 else .27
    if beat < 5:
        weight *= .65
    # Compact kick, rounded low end, no warning or alarm sound.
    def kick(t, k):
        phase = TAU * (48 * t + (115 - 48) * .018 * (1 - math.exp(-t / .018)))
        return math.sin(phase) * math.exp(-t * 18) * min(1, t / .0015)
    add(at, .27, kick, weight)
    if beat % 2 == 1 and beat >= 5:
        # Dry, light brushed snare/clap.
        def snare(t, k):
            env = min(1, t / .002) * math.exp(-t * 31)
            return (rng.uniform(-1, 1) * .65 + math.sin(TAU * 178 * t) * .35) * env
        add(at, .17, snare, .115, .07)
    if beat >= 5:
        root = chords[(beat // 8) % 4][0] - 12
        f = frequency(root)
        def bass(t, k, f=f):
            env = min(1, t / .012) * math.exp(-t * 7) * min(1, max(0, (.34 - t) / .06))
            return (math.sin(TAU * f * t) + .15 * math.sin(TAU * f * 2 * t)) * env
        add(at + .025, .34, bass, .12)

# Syncopated, restrained glass plucks with stereo dotted-eighth delays.
melody = (72, 79, 74, 70, 72, 79, 77, 74,
          72, 79, 84, 79, 74, 77, 79, 70)
for i, midi in enumerate(melody):
    at = (i * 1.5 + .5) * BEAT
    add(at, .62, pluck(midi), .072, (-.40, .40, -.16, .24)[i % 4], echo=1)

for i in range(12, 56):
    at = i * BEAT / 2
    def hat(t, k):
        return rng.uniform(-1, 1) * math.exp(-t * 110) * min(1, t / .001)
    add(at, .07, hat, .025 if i % 2 else .039, -.28 if i % 2 else .28)

transitions = (2.34375, 4.6875, 7.03125, 9.375, 12.1875)
for at in transitions:
    length = .34
    def whoosh(t, k):
        x = t / .34
        env = math.sin(math.pi * x) ** 2
        # Soft noise accent plus a tiny tonal lift; no repeated siren glide.
        return env * (rng.uniform(-1, 1) * .22 + math.sin(TAU * (240 * t + 850 * t * t)) * .13)
    add(at - length + .04, length, whoosh, .12, -.12)
    add(at, .62, pluck(84), .065, .18, echo=1)

# Resolve to a warm major colour under the logo, then a natural tail.
for i, midi in enumerate((60, 67, 70, 74, 79)):
    add(12.1875 + i * .038, 2.7, pluck(midi, 2.7), .095, (i - 2) * .18, echo=1)

peak = max(max(abs(v) for v in left), max(abs(v) for v in right))
scale = .74 / max(peak, .0001)
pcm = array('h')
sum_square = 0
for i in range(N):
    t = i / RATE
    fade = min(1, t / .055) * min(1, max(0, (DURATION - t) / .68))
    l, r = left[i] * scale * fade, right[i] * scale * fade
    sum_square += l * l + r * r
    pcm.extend((round(l * 32767), round(r * 32767)))

path = ROOT / 'assets/audio/vetor-urbano-original.wav'
path.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(path), 'wb') as wav:
    wav.setnchannels(2)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes(pcm.tobytes())
metadata = {
    'title': 'A cidade, em perspectiva', 'origin': 'original-local-code-synthesis',
    'generator': 'tools/make_soundtrack.py', 'duration_s': DURATION,
    'bpm': 128, 'beat_s': BEAT, 'sample_rate': RATE, 'channels': 2,
    'seed': 1282026, 'transition_accents_s': transitions,
    'peak_dbfs': round(20 * math.log10(.74), 2),
    'rms_dbfs': round(20 * math.log10(math.sqrt(sum_square / (2 * N))), 2),
    'source_audio_sampled': False,
}
(ROOT / 'assets/audio/metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata))
