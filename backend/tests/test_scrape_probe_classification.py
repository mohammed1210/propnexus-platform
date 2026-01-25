from backend.routes import debug_scrape_probe


def test_final_block_status_overrides_when_cards_found():
    blocked, classification = debug_scrape_probe._final_block_status(
        blocked_by_heuristic=True, cards_found=11
    )
    assert blocked is False
    assert classification == "ok"


def test_final_block_status_blocked_when_no_cards_and_heuristic_blocked():
    blocked, classification = debug_scrape_probe._final_block_status(
        blocked_by_heuristic=True, cards_found=0
    )
    assert blocked is True
    assert classification == "blocked"


def test_final_block_status_ok_when_no_cards_and_heuristic_not_blocked():
    blocked, classification = debug_scrape_probe._final_block_status(
        blocked_by_heuristic=False, cards_found=0
    )
    assert blocked is False
    assert classification == "ok"
