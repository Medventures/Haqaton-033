"""Offline Edge/Playwright export and checks for the MedHub interactive pitch.

Run: python v2/render.py (or python render.py from this directory).
All output and browser temporary files stay in v2. No server is required.
The PDF contains the final frames A3, B5, C; steps contains all nine frames.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import sys
import tempfile

ROOT = Path(__file__).resolve().parent
QA = ROOT / "qa"
STEPS = ROOT / "steps"
TEMP = QA / "browser-temp"
for directory in (QA, STEPS, TEMP):
    directory.mkdir(parents=True, exist_ok=True)
for variable in ("TMP", "TEMP", "TMPDIR"):
    os.environ[variable] = str(TEMP)
tempfile.tempdir = str(TEMP)
sys.dont_write_bytecode = True
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8")

from playwright.sync_api import sync_playwright
from pypdf import PdfReader
from PIL import Image
import fitz

EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
IDS = ["A1", "A2", "A3", "B1", "B2", "B3", "B4", "B5", "C"]
FINALS = {"A": "A3", "B": "B5", "C": "C"}


def source_notes():
    """Used during initial authoring, and for optional source comparison."""
    storyboard = ROOT.parent / "STORYBOARD_V2.md"
    if not storyboard.exists():
        return None
    result, current = {}, None
    for line in storyboard.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^### (A[1-3]|B[1-5]) — (.*)", line)
        if match:
            current = match[1]
            result[current] = {
                "title": current + " — " + match[2].split(" (")[0],
                "speech": "",
            }
        elif line.startswith("## C."):
            current = "C"
            result[current] = {"title": "C — Демо", "speech": ""}
        elif current and line.startswith("> Речь: "):
            result[current]["speech"] = line[len("> Речь: ") :]
        elif current and line.startswith("> ") and result[current]["speech"]:
            result[current]["speech"] += "\n" + line[2:]
    assert list(result) == IDS and all(item["speech"] for item in result.values())
    return result


LAYOUT_CHECK = r"""frame => {
    const bounds = frame.getBoundingClientRect();
    const overflow = [], smallText = [], textBounds = [];
    for (const el of frame.querySelectorAll('*')) {
        if (el.closest('svg,.gantt,.rolling-strip')) continue;
        const box = el.getBoundingClientRect(), style = getComputedStyle(el);
        if (!box.width || !box.height || style.display === 'none') continue;
        const directText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (directText) {
            const size = parseFloat(style.fontSize);
            if (size < 28) smallText.push({text: el.textContent, size});
            const range = document.createRange();range.selectNodeContents(el);
            const textBox = range.getBoundingClientRect();
            textBounds.push({text: el.textContent.trim(),fontSize:size,x:textBox.x,y:textBox.y,w:textBox.width,h:textBox.height});
            if (textBox.left < bounds.left - 1 || textBox.right > bounds.right + 1 ||
                textBox.top < bounds.top - 1 || textBox.bottom > bounds.bottom - 1) {
                overflow.push({kind:'text',text:el.textContent,box:textBox.toJSON()});
            }
        }
        // Short line-height and intentional connector pseudo-elements may extend
        // past their own line box. That is not clipping when overflow is visible.
        // Check slide boundaries, text bounds and genuinely clipped containers.
        const clipsX = ['hidden','clip','auto','scroll'].includes(style.overflowX);
        const clipsY = ['hidden','clip','auto','scroll'].includes(style.overflowY);
        const intentionalClip = el.matches('.rolling-window,.screen-frame');
        if (box.left < bounds.left - 1 || box.right > bounds.right + 1 ||
            box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1 ||
            (!intentionalClip && clipsX && el.clientWidth && el.scrollWidth > el.clientWidth + 2) ||
            (!intentionalClip && clipsY && el.clientHeight && el.scrollHeight > el.clientHeight + 2)) {
            overflow.push({kind:'element',element:el.className,text:el.innerText?.slice(0,80),
                width:box.width,height:box.height,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight});
        }
    }
    return {id:frame.id,width:bounds.width,height:bounds.height,overflow,smallText,textBounds};
}"""


def main():
    if not EDGE.exists():
        raise SystemExit(f"Microsoft Edge не найден: {EDGE}")
    html_path = ROOT / "index.html"
    html = html_path.read_text(encoding="utf-8")
    original_notes = source_notes()
    if "__SPEAKER_DATA__" in html:
        if original_notes is None:
            raise SystemExit("Не найдены заметки для первоначальной сборки HTML.")
        html_path.write_text(
            html.replace("__SPEAKER_DATA__", json.dumps(original_notes, ensure_ascii=False, indent=2)),
            encoding="utf-8",
        )

    report = {"steps": [], "interaction": [], "page_errors": [], "network_requests": [], "failed_requests": []}

    def record(name, ok, **details):
        report["interaction"].append({"check": name, "passed": bool(ok), **details})
        if not ok:
            raise AssertionError(name + ": " + str(details))

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=str(EDGE), args=["--no-sandbox"], headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 810}, device_scale_factor=1,
                                      locale="ru-RU", offline=True, reduced_motion="no-preference")

        def local_only(route):
            if route.request.url.startswith(("file:", "data:", "about:")):
                route.continue_()
            else:
                report["network_requests"].append(route.request.url)
                route.abort()

        context.route("**/*", local_only)
        page = context.new_page()
        page.on("pageerror", lambda error: report["page_errors"].append(str(error)))
        page.on("requestfailed", lambda request: report["failed_requests"].append(request.url))
        page.goto(html_path.as_uri(), wait_until="load")
        page.evaluate("window.pitchReady")
        record("Initial frame", page.evaluate("pitch.step") == "A1")
        record("Initial timer", page.locator("#timer").inner_text() == "2:00")
        record("Nine frames", page.evaluate("pitch.ids") == IDS)
        if original_notes:
            record("Verbatim storyboard notes", page.evaluate("pitch.notes") == original_notes)
        record("Local Geologica loaded", page.evaluate("document.fonts.check('28px Geologica')"))

        # Real keyboard events, rather than calling the public rendering helper.
        for target in IDS[1:]:
            page.keyboard.press("ArrowRight")
            record("ArrowRight → " + target, page.evaluate("pitch.step") == target)
        page.keyboard.press("ArrowRight")
        record("End boundary", page.evaluate("pitch.step") == "C")
        page.keyboard.press("ArrowLeft")
        record("ArrowLeft", page.evaluate("pitch.step") == "B5")
        for key, target in [("1", "A1"), ("2", "B1"), ("3", "C"), ("1", "A1")]:
            page.keyboard.press(key)
            record("Section key " + key, page.evaluate("pitch.step") == target)
        page.keyboard.press("ArrowLeft")
        record("Start boundary", page.evaluate("pitch.step") == "A1")
        page.keyboard.press("Space")
        record("Space", page.evaluate("pitch.step") == "A2")
        page.locator("#A2 h1").click()
        record("Stage click", page.evaluate("pitch.step") == "A3")
        page.locator("#progress button").nth(3).click()
        record("Progress dot", page.evaluate("pitch.step") == "B1")

        # Every flow/gallery button opens the supplied file and never advances.
        for section in ("B1", "C"):
            page.evaluate("id=>pitch.show(id)", section)
            for index in range(6):
                button = page.locator(f"#{section} [data-shot]").nth(index)
                expected = button.get_attribute("data-shot")
                button.click()
                page.locator("#lightbox-image").evaluate("image=>image.decode()")
                record(f"{section} lightbox {index + 1}",
                       page.locator("#lightbox").is_visible() and page.evaluate("pitch.step") == section
                       and page.locator("#lightbox-image").get_attribute("src") == "screens/" + expected)
                if section == "B1" and index == 3:
                    page.screenshot(path=str(QA / "lightbox.png"), animations="disabled")
                if index % 2:
                    page.locator("#lightbox-image").click()
                else:
                    page.keyboard.press("Escape")
                record(f"{section} close {index + 1}", page.locator("#lightbox").is_hidden()
                       and page.evaluate("pitch.step") == section)

        page.keyboard.press("2")
        page.keyboard.press("s")
        record("S notes", page.locator("#notes").is_visible())
        record("Current speech", page.locator("#speech").text_content() == page.evaluate("pitch.notes.B1.speech"))
        record("Next frame", "B2" in page.locator("#next-frame").inner_text())
        for frame_id in IDS:
            page.evaluate("id=>pitch.show(id)", frame_id)
            fit = page.locator("#notes").evaluate("el=>el.scrollHeight<=el.clientHeight+1")
            record("Notes fit " + frame_id, fit)
        page.evaluate("pitch.show('B3')")
        page.screenshot(path=str(QA / "speaker-notes.png"), animations="disabled")
        timer_before = page.locator("#timer").inner_text()
        page.wait_for_timeout(1100)
        record("Timer counts down", page.locator("#timer").inner_text() != timer_before)
        page.keyboard.press("s")
        record("S closes notes", page.locator("#notes").is_hidden())

        page.keyboard.press("f")
        page.wait_for_timeout(100)
        record("F fullscreen", page.evaluate("!!document.fullscreenElement"))
        page.keyboard.press("f")
        page.wait_for_timeout(100)
        record("F leaves fullscreen", page.evaluate("!document.fullscreenElement"))

        for width, height in [(1920, 1080), (1280, 1024), (960, 540), (390, 844)]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(60)
            box = page.locator("#stage").bounding_box()
            ok = box and box["x"] >= -1 and box["y"] >= -1 and box["x"] + box["width"] <= width + 1 and box["y"] + box["height"] <= height + 1
            ok = ok and abs(box["width"] / box["height"] - 16 / 9) < 0.001
            record(f"Letterbox {width}x{height}", ok, box=box)
        page.set_viewport_size({"width": 1440, "height": 810})
        page.emulate_media(reduced_motion="reduce")
        page.evaluate("pitch.show('B4')")
        record("Reduced motion", page.evaluate("document.getAnimations().length") == 0)
        record("Reduced motion final counter", page.locator(".rolling-strip").evaluate("el=>getComputedStyle(el).transform") == "matrix(1, 0, 0, 1, 0, -162)")

        # Capture fully revealed, stable frames at the exact base resolution.
        page.goto(html_path.as_uri() + "?export=1", wait_until="load")
        page.evaluate("window.pitchReady")
        for index, frame_id in enumerate(IDS, 1):
            page.evaluate("id=>pitch.show(id)", frame_id)
            page.evaluate("pitch.finishAnimations()")
            frame = page.locator("#" + frame_id)
            result = frame.evaluate(LAYOUT_CHECK)
            report["steps"].append(result)
            page.locator("#stage").screenshot(path=str(STEPS / f"{index:02d}_{frame_id}.png"), animations="disabled")
            if frame_id in FINALS.values():
                letter = next(key for key, value in FINALS.items() if value == frame_id)
                page.locator("#stage").screenshot(path=str(ROOT / f"slide_{letter}.png"), animations="disabled")

        # 1440 × 810 PDF points, matching the source deck's physical page box.
        page.add_style_tag(content="@page { size:1440pt 810pt; margin:0 }")
        page.pdf(path=str(ROOT / "pitch_v2.pdf"), width="20in", height="11.25in", scale=4 / 3,
                 prefer_css_page_size=True, print_background=True, display_header_footer=False,
                 margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        browser.close()

    pdf = PdfReader(ROOT / "pitch_v2.pdf")
    record("PDF has three pages", len(pdf.pages) == 3)
    report["pdf"] = []
    for index, (letter, page_pdf) in enumerate(zip(FINALS, pdf.pages)):
        size = [float(page_pdf.mediabox.width), float(page_pdf.mediabox.height)]
        record("PDF page dimensions " + letter, all(abs(actual - expected) < 1 for actual, expected in zip(size, [1440, 810])))
        text = page_pdf.extract_text()
        record("PDF Cyrillic text " + letter, bool(re.search("[А-Яа-я]", text)) and "\ufffd" not in text)
        report["pdf"].append({"page": letter, "size_points": size, "text": text})
    # Render the actual PDF too, rather than relying only on browser screenshots.
    document = fitz.open(ROOT / "pitch_v2.pdf")
    for index, letter in enumerate(FINALS):
        document[index].get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False).save(QA / f"pdf_{letter}.png")
    document.close()

    # Contact sheet uses existing rendered pixels only, no authored slide visuals.
    sheet = Image.new("RGB", (1440, 810), "#dbe3dc")
    for index, image_path in enumerate(sorted(STEPS.glob("*.png"))):
        with Image.open(image_path) as image:
            thumb = image.resize((480, 270), Image.Resampling.LANCZOS)
            sheet.paste(thumb, ((index % 3) * 480, (index // 3) * 270))
    sheet.save(QA / "contact-sheet.png")
    (QA / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    bad_layout = [step for step in report["steps"] if step["overflow"] or step["smallText"]]
    if bad_layout or report["page_errors"] or report["network_requests"] or report["failed_requests"]:
        print(json.dumps({"layout": bad_layout, "errors": report["page_errors"], "network": report["network_requests"], "failed": report["failed_requests"]}, ensure_ascii=False, indent=2))
        raise SystemExit("Проверка не пройдена; подробности: v2/qa/verification.json")
    print(f"Готово: PDF (3 страницы), 3 финальных PNG, 9 PNG шагов. Проверок управления: {len(report['interaction'])}. Переполнений и сетевых запросов нет.")


if __name__ == "__main__":
    main()
