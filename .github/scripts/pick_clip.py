"""Pick the next clip to post, skipping any whose video is missing.

Used by clip-poster.yml. Kept as a file (not inline python) so it can be tested.

Why skipping matters: the poster used to take the FIRST unposted clip. If
that clip's asset was gone from the clip-queue release, the run failed, and
every later run picked the same clip and failed the same way. The queue
stalled permanently, and the low-queue alarm stayed quiet because the queue
still looked full.

The realistic way in: after a successful post, the workflow deletes the asset
and THEN pushes queue.json. If that push loses a race (social, newsletter and
this workflow all push to main), the clip is posted and its asset is gone, but
the queue still says unposted. So a missing asset almost always means "already
posted". Skipping it is correct, and it can never cause a duplicate post.

Usage:
  python pick_clip.py QUEUE_JSON ASSET_NAMES_FILE
Prints three lines: next clip (or empty), clips remaining (excluding
missing), and the missing clips (comma-separated, or empty).
"""
import json
import sys


def pick(queue, assets):
    """Return (next_clip, remaining, missing) for a queue dict and asset-name set."""
    unposted = [c["file"] for c in queue["clips"]
                if not c.get("posted") and not c.get("missing_asset")]
    missing = [f for f in unposted if f not in assets]
    available = [f for f in unposted if f in assets]
    return (available[0] if available else ""), len(available), missing


def main():
    with open(sys.argv[1]) as f:
        queue = json.load(f)
    with open(sys.argv[2]) as f:
        assets = set(f.read().split())
    next_clip, remaining, missing = pick(queue, assets)
    print(next_clip)
    print(remaining)
    print(",".join(missing))


if __name__ == "__main__":
    main()
