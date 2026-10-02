"""
Facebook analytics report for the IFM Page.

Runs in GitHub Actions (the Page token only lives in repo secrets) and writes:
  content/fb-analytics.json  - raw numbers, for later comparisons
  content/fb-analytics.md    - the readable report

Read-only: it only GETs from the Graph API. Standard library only.

Meta renames and retires insight metrics often, so every metric is asked for
individually and a failure just leaves that column blank instead of killing
the whole report.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

API = "https://graph.facebook.com/v21.0"
TOKEN = os.environ["FB_TOKEN"]
PAGE = os.environ["FB_PAGE_ID"]
DAYS = int(os.environ.get("REPORT_DAYS", "30"))

SINCE = datetime.now(timezone.utc) - timedelta(days=DAYS)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "content")
notes = []  # metrics Meta refused, so the report can say what's missing


def get(path, **params):
    """GET one Graph API object. Returns (data, error_message)."""
    params["access_token"] = TOKEN
    url = path if path.startswith("http") else f"{API}/{path}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.load(r), None
    except urllib.error.HTTPError as e:
        try:
            msg = json.load(e)["error"]["message"]
        except Exception:
            msg = f"HTTP {e.code}"
        return None, msg
    except Exception as e:
        return None, str(e)


def get_all(path, **params):
    """Follow paging.next until the results are older than SINCE."""
    out, data, err = [], *get(path, **params)
    while data:
        out.extend(data.get("data", []))
        nxt = data.get("paging", {}).get("next")
        oldest = out[-1].get("created_time", "") if out else ""
        if not nxt or (oldest and oldest < SINCE.strftime("%Y-%m-%dT%H:%M:%S")):
            break
        data, err = get(nxt)
    if err:
        notes.append(f"{path}: {err}")
    return [x for x in out if x.get("created_time", "9") >= SINCE.strftime("%Y-%m-%dT%H:%M:%S")]


def insight(obj_id, edge, metric, **params):
    """One insight metric's lifetime/summed value, or None if Meta refuses it."""
    data, err = get(f"{obj_id}/{edge}", metric=metric, **params)
    if err or not data or not data.get("data"):
        if err and metric not in " ".join(notes):
            notes.append(f"{metric}: {err[:120]}")
        return None
    values = data["data"][0].get("values", [])
    total = 0
    for v in values:
        val = v.get("value")
        if isinstance(val, dict):          # e.g. reactions broken down by type
            val = sum(x for x in val.values() if isinstance(x, (int, float)))
        if isinstance(val, (int, float)):
            total += val
    return total


# ---------- 1. Page totals ----------
page, err = get(PAGE, fields="name,followers_count,fan_count")
if err:
    sys.exit(f"Cannot read the Page: {err}")

page_metrics = {}
for m in ["page_impressions_unique", "page_post_engagements", "page_video_views",
          "page_daily_follows_unique", "page_views_total"]:
    page_metrics[m] = insight(PAGE, "insights", m, period="day",
                              since=int(SINCE.timestamp()),
                              until=int(datetime.now(timezone.utc).timestamp()))

# ---------- 2. Every post in the window ----------
FIELDS = ("id,message,created_time,permalink_url,shares,"
          "reactions.summary(total_count).limit(0),comments.summary(true).limit(0),"
          "attachments{media_type,target{id}}")
posts = get_all(f"{PAGE}/posts", fields=FIELDS, limit=50)


def kind(p):
    """Sort a post into the four automated streams."""
    att = (p.get("attachments") or {}).get("data") or [{}]
    mt = (att[0].get("media_type") or "").lower()
    if mt == "video":
        return "Clip"
    if mt in ("photo", "album"):
        return "Website ad / image"
    if mt in ("link", "share"):
        return "Link"
    return "Daily text"


rows = []
for p in posts:
    k = kind(p)
    att = (p.get("attachments") or {}).get("data") or [{}]
    video_id = (att[0].get("target") or {}).get("id") if k == "Clip" else None
    row = {
        "id": p["id"], "type": k, "created": p["created_time"][:10],
        "text": (p.get("message") or "").split("\n")[0][:70],
        "url": p.get("permalink_url"),
        "reactions": p.get("reactions", {}).get("summary", {}).get("total_count", 0),
        "comments": p.get("comments", {}).get("summary", {}).get("total_count", 0),
        "shares": (p.get("shares") or {}).get("count", 0),
        "views": None, "reach": None, "avg_watch_s": None,
    }
    if video_id:
        row["views"] = insight(video_id, "video_insights", "total_video_views")
        row["reach"] = insight(video_id, "video_insights", "total_video_impressions_unique")
        avg = insight(video_id, "video_insights", "total_video_avg_time_watched")
        row["avg_watch_s"] = round(avg / 1000, 1) if avg else None   # Meta reports ms
    else:
        row["reach"] = insight(p["id"], "insights", "post_impressions_unique")
    row["engagement"] = row["reactions"] + row["comments"] + row["shares"]
    rows.append(row)

# ---------- 3. Write the report ----------
os.makedirs(OUT_DIR, exist_ok=True)
generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
with open(os.path.join(OUT_DIR, "fb-analytics.json"), "w") as f:
    json.dump({"generated": generated, "days": DAYS, "page": page,
               "page_metrics": page_metrics, "posts": rows, "notes": notes}, f, indent=2)


def n(v):
    return "–" if v is None else f"{v:,}" if isinstance(v, int) else str(v)


L = [f"# IFM Facebook Report: last {DAYS} days",
     f"_Generated {generated}_", "",
     f"**{page.get('name')}**: {n(page.get('followers_count'))} followers · "
     f"{n(page.get('fan_count'))} likes", "",
     "| Page metric (30-day total) | Value |", "|---|---|"]
labels = {"page_impressions_unique": "People reached (daily unique, summed)",
          "page_post_engagements": "Post engagements",
          "page_video_views": "Video views",
          "page_daily_follows_unique": "New follows",
          "page_views_total": "Page visits"}
for m, v in page_metrics.items():
    L.append(f"| {labels[m]} | {n(v)} |")

L += ["", "## By post type", "",
      "| Type | Posts | Avg reach | Avg reactions+comments+shares |", "|---|---|---|---|"]
for k in ["Clip", "Daily text", "Website ad / image", "Link"]:
    g = [r for r in rows if r["type"] == k]
    if not g:
        continue
    reach = [r["reach"] for r in g if r["reach"] is not None]
    L.append(f"| {k} | {len(g)} | {n(round(sum(reach)/len(reach))) if reach else '–'} | "
             f"{sum(r['engagement'] for r in g)/len(g):.1f} |")

clips = sorted([r for r in rows if r["type"] == "Clip"],
               key=lambda r: (r["views"] or 0, r["engagement"]), reverse=True)
if clips:
    L += ["", "## Top 10 clips", "",
          "| Date | Clip | Views | Avg watch | Engagement |", "|---|---|---|---|---|"]
    for r in clips[:10]:
        L.append(f"| {r['created']} | [{r['text'] or 'clip'}]({r['url']}) | {n(r['views'])} | "
                 f"{n(r['avg_watch_s'])}s | {r['engagement']} |")

text_posts = sorted([r for r in rows if r["type"] != "Clip"],
                    key=lambda r: (r["engagement"], r["reach"] or 0), reverse=True)
if text_posts:
    L += ["", "## Top 5 other posts", "",
          "| Date | Type | Post | Reach | Engagement |", "|---|---|---|---|---|"]
    for r in text_posts[:5]:
        L.append(f"| {r['created']} | {r['type']} | [{r['text'] or 'post'}]({r['url']}) | "
                 f"{n(r['reach'])} | {r['engagement']} |")

if notes:
    L += ["", "## Metrics Meta did not return", ""] + [f"- {x}" for x in notes]

with open(os.path.join(OUT_DIR, "fb-analytics.md"), "w") as f:
    f.write("\n".join(L) + "\n")
print("\n".join(L))
