"""Trivial harness-proving test (#372) — no real coverage yet, just confirms
the live server + Playwright wiring actually works end to end before any of
the real suites (#373-#375) are built on top of it."""


def test_landing_page_loads(live_server, page):
    page.goto(live_server.url)
    assert page.title() == "Hey Famly — One Place for Everything Your Family Runs On"
    assert page.get_by_text("Start Free").first.is_visible()
