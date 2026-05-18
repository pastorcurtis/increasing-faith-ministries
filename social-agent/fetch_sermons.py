"""
Pulls auto-captions from the most recent sermons on the IFM YouTube channel
and saves cleaned plaintext to ./sermons/ for voice-training the social agent.

Re-runnable: already-fetched sermons are skipped.

Usage:
    python fetch_sermons.py            # default: 8 most recent streams
    python fetch_sermons.py 15         # pull 15 instead
"""

import re
import subprocess
import sys
from pathlib import Path

CHANNEL_STREAMS_URL = "https://www.youtube.com/@thehourofpowerextra2883/streams"
SERMONS_DIR = Path(__file__).parent / "sermons"
DEFAULT_COUNT = 8


def slugify(title: str) -> str:
    """Reduce a video title to safe filename characters."""
    s = re.sub(r"[^\w\s-]", "", title)
    s = re.sub(r"\s+", "_", s).strip("_")
    return s[:60]


def list_recent_streams(max_count: int) -> list[tuple[str, str]]:
    """Return [(video_id, title), ...] for the N most recent streams."""
    result = subprocess.run(
        [
            sys.executable, "-m", "yt_dlp",
            "--flat-playlist",
            "--print", "%(id)s|%(title)s",
            "--playlist-end", str(max_count),
            CHANNEL_STREAMS_URL,
        ],
        capture_output=True, text=True, check=True,
    )
    streams = []
    for line in result.stdout.strip().splitlines():
        if "|" in line:
            vid_id, title = line.split("|", 1)
            streams.append((vid_id.strip(), title.strip()))
    return streams


def download_captions(video_id: str, slug: str) -> Path | None:
    """Download English auto-captions as VTT. Returns path or None if missing."""
    out_template = str(SERMONS_DIR / f"{slug}_{video_id}.%(ext)s")
    subprocess.run(
        [
            sys.executable, "-m", "yt_dlp",
            "--write-auto-sub",
            "--sub-lang", "en",
            "--sub-format", "vtt",
            "--skip-download",
            "-o", out_template,
            f"https://www.youtube.com/watch?v={video_id}",
        ],
        capture_output=True, text=True,
    )
    # yt-dlp writes to {slug}_{video_id}.en.vtt
    vtt = SERMONS_DIR / f"{slug}_{video_id}.en.vtt"
    return vtt if vtt.exists() else None


def clean_vtt(vtt_path: Path) -> str:
    """
    Strip VTT timing/cue markup and dedupe repeated lines.

    YouTube auto-captions ship in rolling windows — each cue often repeats
    the previous line for smooth video display. Without dedup, the transcript
    contains the same sentence 2-3 times in a row.
    """
    text = vtt_path.read_text(encoding="utf-8")
    cleaned: list[str] = []
    seen: set[str] = set()

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        # Skip the WEBVTT header and metadata lines
        if line.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")):
            continue
        # Skip timing cues like "00:00:01.000 --> 00:00:05.000"
        if "-->" in line:
            continue
        # Skip standalone cue numbers
        if line.isdigit():
            continue
        # Strip inline cue tags like <c>, <00:00:01.000>, </c>
        line = re.sub(r"<[^>]+>", "", line).strip()
        if not line or line in seen:
            continue
        seen.add(line)
        cleaned.append(line)

    return " ".join(cleaned)


def main() -> None:
    count = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_COUNT
    SERMONS_DIR.mkdir(exist_ok=True)

    print(f"Listing {count} most recent streams from IFM channel...")
    streams = list_recent_streams(count)
    print(f"Found {len(streams)} streams.\n")

    for vid_id, title in streams:
        slug = slugify(title)
        txt_path = SERMONS_DIR / f"{slug}_{vid_id}.txt"

        if txt_path.exists():
            print(f"  [SKIP] {title}")
            continue

        print(f"  [GET]  {title}")
        try:
            vtt = download_captions(vid_id, slug)
            if not vtt:
                print(f"         (no English auto-captions available)")
                continue
            text = clean_vtt(vtt)
            txt_path.write_text(text, encoding="utf-8")
            vtt.unlink()  # We only keep the cleaned text
            print(f"         {len(text.split()):,} words")
        except subprocess.CalledProcessError as e:
            print(f"         ERROR: {e.stderr.strip() or e}")

    print(f"\nDone. Transcripts saved to {SERMONS_DIR}")


if __name__ == "__main__":
    main()
