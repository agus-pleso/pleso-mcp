"""Build the ChatGPT plugin ZIP from ./chatgpt (plugin.json, mcp.json, assets/). Usage: python -I scripts/build-chatgpt-zip.py"""
import json, pathlib, zipfile

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "chatgpt"
out = root / "dist" / "pleso-therapy-chatgpt.zip"
manifest = json.loads((src / "plugin.json").read_text(encoding="utf-8"))

ui = manifest["extensions"]["com.openai"]["interface"]
review = manifest["extensions"]["com.openai"]["review"]
problems = []
for field, limit in (("displayName", 30), ("shortDescription", 30), ("longDescription", 4000), ("developerName", 80)):
    if len(ui[field]) > limit:
        problems.append(f"{field} is {len(ui[field])} chars (max {limit})")
if any(len(p) > 128 for p in ui.get("defaultPrompt", [])):
    problems.append("a defaultPrompt is over 128 chars")
if len(review["test_cases"]["positive"]) != 5 or len(review["test_cases"]["negative"]) != 3:
    problems.append("need exactly 5 positive and 3 negative test cases")
if review["demo_recording_url"].startswith("TODO"):
    print("WARNING: review.demo_recording_url is still a TODO; set it before submitting.")
if problems:
    raise SystemExit("Not building:\n- " + "\n- ".join(problems))

out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for name in ("plugin.json", "mcp.json", "assets/logo.png"):
        z.write(src / name, name)
print(f"Built {out.relative_to(root)} ({out.stat().st_size // 1024} KB)")
