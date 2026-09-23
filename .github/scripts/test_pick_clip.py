"""Tests for pick_clip.py. Usage: python .github/scripts/test_pick_clip.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pick_clip import pick  # noqa: E402

passed = failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        print(f"  PASS  {name}")
        passed += 1
    else:
        print(f"  FAIL  {name} -- {detail}")
        failed += 1


def q(*clips):
    return {"clips": list(clips)}


A = {"file": "a.mp4"}
B = {"file": "b.mp4"}
C = {"file": "c.mp4"}

# 1. Normal case: first unposted clip with an asset.
nxt, rem, miss = pick(q({"file": "old.mp4", "posted": True}, A, B), {"a.mp4", "b.mp4"})
check("picks first unposted", nxt == "a.mp4", nxt)
check("counts remaining", rem == 2, rem)
check("nothing missing", miss == [], miss)

# 2. The stall: head clip's asset is gone. It must be skipped, not retried forever.
nxt, rem, miss = pick(q(A, B, C), {"b.mp4", "c.mp4"})
check("skips clip with missing asset", nxt == "b.mp4", nxt)
check("reports the missing clip", miss == ["a.mp4"], miss)
check("missing clip not counted as remaining", rem == 2, rem)

# 3. Already-flagged clips stay out of both selection and the count.
nxt, rem, miss = pick(q({"file": "a.mp4", "missing_asset": True}, B), {"b.mp4"})
check("flagged clip ignored", nxt == "b.mp4" and rem == 1 and miss == [], (nxt, rem, miss))

# 4. Every unposted clip is missing: nothing to post, queue counts as empty,
#    so the existing EMPTY alarm fires instead of a silent stall.
nxt, rem, miss = pick(q(A, B), set())
check("all missing -> no clip", nxt == "", nxt)
check("all missing -> remaining 0", rem == 0, rem)

# 5. Truly empty queue.
nxt, rem, miss = pick(q({"file": "x.mp4", "posted": True}), {"x.mp4"})
check("empty queue", nxt == "" and rem == 0 and miss == [], (nxt, rem, miss))

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
