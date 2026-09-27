"""Exercise the standalone park in Chrome, including real WebGL rendering.

Run: python tests/browser_smoke.py
Requires: python -m pip install --user playwright pillow
Uses an existing Chrome installation; a Playwright browser download is unnecessary.
Screenshots and machine-readable results go to tests/artifacts/ (gitignored).
"""

from __future__ import annotations

import argparse
import io
import json
import math
import os
from pathlib import Path
import time

from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright


PROJECT = Path(__file__).resolve().parents[1]
ARTIFACTS = PROJECT / "tests" / "artifacts"
CHROME = Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Google/Chrome/Application/chrome.exe"


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def number_in(value, *names):
    """Find a telemetry/validation scalar in nested, serializable diagnostics."""
    if isinstance(value, dict):
        for name in names:
            found = value.get(name)
            if isinstance(found, (int, float)) and not isinstance(found, bool):
                return found
        for nested in value.values():
            result = number_in(nested, *names)
            if result is not None:
                return result
    return None


def get_state(page):
    return page.evaluate("window.parkDebug.state()")


def get_diagnostics(page):
    return page.evaluate("""() => {
        const debug = window.parkDebug;
        const report = debug.diagnostics();
        for (const [key, getter, fallback] of [
            ['coaster', 'getCoaster', 'coaster'], ['ferris', 'getWheel', 'ferris']
        ]) {
            if (report[key]) continue;
            const ride = typeof debug[getter] === 'function' ? debug[getter]() : debug[fallback];
            if (ride) report[key] = {
                telemetry: typeof ride.getTelemetry === 'function' ? ride.getTelemetry() : {},
                validation: typeof ride.validate === 'function' ? ride.validate() : {}
            };
        }
        return report;
    }""")


def require_finite(value, path="diagnostics"):
    if isinstance(value, dict):
        for key, child in value.items():
            require_finite(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            require_finite(child, f"{path}[{index}]")
    elif isinstance(value, (int, float)):
        require(math.isfinite(value), f"Nonfinite value at {path}: {value}")


def physics_checks(diagnostics):
    require_finite(diagnostics)
    for name, ceiling in [
        ("maxGaugeError", 0.001),
        ("maxCouplerError", 0.001),
        ("maxCarWheelbaseError", 0.001),
        ("maxFrameStepDeg", 2),
        ("maxObservedSwingDeg", 25),
        ("maxSwingDeg", 20),
    ]:
        value = number_in(diagnostics, name)
        require(value is not None, f"Missing physics metric {name}")
        require(0 <= value <= ceiling, f"{name}={value}, expected <= {ceiling}")
    clearance = number_in(diagnostics, "minGroundClearance")
    require(clearance is not None and clearance > 0, f"Ferris cabin ground clearance: {clearance}")
    upright = number_in(diagnostics, "minWorldUpDot")
    require(upright is not None and upright > 0.5, f"Coaster car frame inverted or excessively banked: {upright}")
    route_clearance = number_in(diagnostics, "minRouteClearance")
    require(route_clearance is not None and route_clearance > 3, f"Coaster route clearance: {route_clearance}")


def camera_mode(state):
    return state.get("cameraMode", state.get("camera", state.get("view")))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, default=PROJECT / "index.html")
    parser.add_argument("--chrome", type=Path, default=CHROME)
    parser.add_argument("--software", action="store_true", help="Force SwiftShader when no hardware WebGL is available")
    args = parser.parse_args()
    require(args.html.exists(), f"Build HTML first: {args.html}")
    require(args.chrome.exists(), f"Chrome executable missing: {args.chrome}")
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    errors, console_errors, network, checks = [], [], [], []
    started = time.perf_counter()
    result = {"passed": False, "checks": checks}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=str(args.chrome),
            headless=True,
            args=["--enable-unsafe-swiftshader", "--disable-dev-shm-usage"] + (["--use-angle=swiftshader"] if args.software else []),
        )
        page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("request", lambda request: network.append(request.url) if request.url.startswith(("https:", "http:")) else None)
        try:
            page.goto(args.html.resolve().as_uri(), wait_until="load", timeout=30000)
            page.wait_for_function("window.parkDebug && typeof window.parkDebug.diagnostics === 'function'", timeout=30000)
            page.wait_for_timeout(1600)
            page.screenshot(path=str(ARTIFACTS / "initial-desktop.png"))
            print(f"Initial screenshot: {ARTIFACTS / 'initial-desktop.png'}", flush=True)
            canvas = page.locator("canvas").first
            require(canvas.is_visible(), "3D canvas is not visible")
            webgl = canvas.evaluate("""canvas => {
                const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                if (!gl) return null;
                const ext = gl.getExtension('WEBGL_debug_renderer_info');
                return {lost: gl.isContextLost(), width: gl.drawingBufferWidth,
                    height: gl.drawingBufferHeight,
                    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)};
            }""")
            require(webgl and not webgl["lost"] and webgl["width"] > 0 and webgl["height"] > 0, "WebGL context is unavailable")
            image = Image.open(io.BytesIO(canvas.screenshot())).convert("RGB").resize((160, 100))
            pixel_variance = sum(ImageStat.Stat(image).stddev) / 3
            require(pixel_variance > 15, f"3D render appears blank (pixel deviation {pixel_variance:.2f})")
            checks.append("Standalone HTML renders a nonblank, live WebGL scene")
            result["webgl"] = webgl
            result["pixel_deviation"] = round(pixel_variance, 2)

            initial = get_diagnostics(page)
            result["initial_diagnostics"] = initial
            frame_before = get_state(page)["frames"]
            render_started = time.perf_counter()
            physics_checks(initial)
            require(number_in(initial, "distance") is not None, "Coaster distance telemetry missing")
            require(number_in(initial, "angle") is not None, "Ferris rotation telemetry missing")
            page.wait_for_timeout(850)
            advanced = get_diagnostics(page)
            result["approximate_fps"] = round((get_state(page)["frames"] - frame_before) / (time.perf_counter() - render_started), 1)
            require(number_in(advanced, "distance") > number_in(initial, "distance"), "Train did not move along its route")
            require(abs(number_in(advanced, "angle") - number_in(initial, "angle")) > 0.00001, "Ferris wheel did not turn")
            checks.append("Train advances and Ferris wheel turns with finite, stable ride geometry")

            for mode in ("night", "festival", "day"):
                page.locator(f'button[data-mode="{mode}"]').click(no_wait_after=True)
                page.wait_for_timeout(1700)
                require(get_state(page).get("mode") == mode, f"Mode button did not select {mode}")
                active = number_in(get_diagnostics(page), "confettiCount", "activeConfetti")
                if mode == "festival":
                    require(active is not None and active > 0, "Festival confetti is not active")
                else:
                    require(active in (0, None), f"Confetti remains active in {mode} mode")
                page.screenshot(path=str(ARTIFACTS / f"{mode}-desktop.png"))
            checks.append("Day, night and festival controls work; confetti is active during festival")

            for camera in ("wheel", "coaster", "ride", "overview"):
                page.locator(f'button[data-camera="{camera}"]').click(no_wait_after=True)
                page.wait_for_timeout(300)
                require(camera_mode(get_state(page)) == camera, f"Camera button did not select {camera}")
                if camera == "ride":
                    position_before = get_state(page).get("cameraPosition")
                    page.wait_for_timeout(450)
                    position_after = get_state(page).get("cameraPosition")
                    if isinstance(position_before, dict):
                        position_before = [position_before[axis] for axis in ("x", "y", "z")]
                        position_after = [position_after[axis] for axis in ("x", "y", "z")]
                    require(position_before and position_after, "Ride camera position is missing")
                    travel = math.dist(position_before, position_after)
                    require(travel > 0.05, f"Onboard camera did not follow the moving train ({travel})")
                    page.screenshot(path=str(ARTIFACTS / "ride-desktop.png"))
            page.locator('button[data-camera="wheel"]').click(no_wait_after=True)
            page.locator("#reset-camera").click(no_wait_after=True)
            page.wait_for_timeout(250)
            require(camera_mode(get_state(page)) == "overview", "Reset camera does not return to overview")
            checks.append("Overview, wheel, coaster, onboard ride and camera reset controls respond")

            position_before = get_state(page)["cameraPosition"]
            page.mouse.move(1000, 460)
            page.mouse.down()
            page.mouse.move(1120, 500, steps=8)
            page.mouse.up()
            page.wait_for_timeout(350)
            require(math.dist(position_before, get_state(page)["cameraPosition"]) > 1, "Dragging did not orbit the camera")
            position_before = get_state(page)["cameraPosition"]
            page.mouse.wheel(0, 400)
            page.wait_for_timeout(350)
            require(math.dist(position_before, get_state(page)["cameraPosition"]) > 1, "Scrolling did not zoom the camera")
            page.locator("#reset-camera").click(no_wait_after=True)
            checks.append("Pointer drag rotates the scene and mouse wheel changes camera distance")

            page.locator("#pause-btn").click(no_wait_after=True)
            page.wait_for_timeout(100)
            require(get_state(page).get("paused") is True, "Pause state was not enabled")
            frozen = get_diagnostics(page)
            page.wait_for_timeout(650)
            frozen_later = get_diagnostics(page)
            for metric in ("distance", "angle"):
                require(abs(number_in(frozen_later, metric) - number_in(frozen, metric)) < 1e-8, f"{metric} changed while paused")
            page.locator("#pause-btn").click(no_wait_after=True)
            require(get_state(page).get("paused") is False, "Simulation did not resume")
            page.locator("#speed-range").evaluate("el => { el.value = '1.5'; el.dispatchEvent(new Event('input', {bubbles:true})); }")
            require(abs(get_state(page).get("speed", 0) - 1.5) < 0.001, "Speed slider did not update simulation speed")
            page.locator("#speed-range").evaluate("el => { el.value = '1'; el.dispatchEvent(new Event('input', {bubbles:true})); }")
            checks.append("Pause freezes both rides exactly; resume and speed slider work")

            time_before = get_state(page)["elapsed"]
            page.wait_for_timeout(900)
            normal_delta = get_state(page)["elapsed"] - time_before
            page.locator("#speed-range").evaluate("el => { el.value = '2'; el.dispatchEvent(new Event('input', {bubbles:true})); }")
            time_before = get_state(page)["elapsed"]
            page.wait_for_timeout(900)
            fast_delta = get_state(page)["elapsed"] - time_before
            require(normal_delta > 0 and 1.4 < fast_delta / normal_delta < 2.6,
                    f"2x tempo did not approximately double simulated time: {normal_delta}, {fast_delta}")
            physics_checks(get_diagnostics(page))
            page.locator("#speed-range").evaluate("el => { el.value = '1'; el.dispatchEvent(new Event('input', {bubbles:true})); }")
            checks.append("2x tempo advances simulation time at twice the rate while keeping ride geometry stable")

            stepped = page.evaluate("""() => {
                if (typeof window.parkDebug.step !== 'function') return false;
                window.parkDebug.step(20);
                return true;
            }""")
            require(stepped, "Deterministic simulation step helper is missing")
            physics_checks(get_diagnostics(page))
            checks.append("Physics remains stable after advancing the simulation by 20 seconds")

            page.set_viewport_size({"width": 390, "height": 844})
            page.wait_for_timeout(1700)
            overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
            require(not overflow, "Mobile page overflows horizontally")
            page.screenshot(path=str(ARTIFACTS / "mobile-overview.png"), full_page=True)
            for selector in ('button[data-mode="festival"]', 'button[data-camera="ride"]', "#pause-btn"):
                element = page.locator(selector)
                require(element.is_visible(), f"Mobile control is hidden: {selector}")
                element.click(no_wait_after=True)
            require(get_state(page).get("mode") == "festival", "Mobile festival button failed")
            require(camera_mode(get_state(page)) == "ride", "Mobile ride button failed")
            require(get_state(page).get("paused") is True, "Mobile pause button failed")
            page.wait_for_timeout(1700)
            page.screenshot(path=str(ARTIFACTS / "mobile.png"), full_page=True)
            checks.append("390px viewport fits the page and primary controls remain usable")

            require(not errors, f"JavaScript errors: {errors}")
            require(not console_errors, f"Console errors: {console_errors}")
            require(not network, f"Standalone file unexpectedly makes network requests: {network}")
            checks.append("No JavaScript errors, console errors or external network requests")
            result["diagnostics"] = get_diagnostics(page)
            result["passed"] = True
        except Exception as exception:
            result["error"] = str(exception)
            try:
                page.screenshot(path=str(ARTIFACTS / "failure.png"), full_page=True)
                result["state_at_failure"] = get_state(page)
                result["diagnostics_at_failure"] = get_diagnostics(page)
            except Exception:
                pass
        finally:
            result["page_errors"] = errors
            result["console_errors"] = console_errors
            result["network_requests"] = network
            result["seconds"] = round(time.perf_counter() - started, 2)
            (ARTIFACTS / "smoke-results.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
            browser.close()
    print(json.dumps(result, indent=2, ensure_ascii=True))
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
