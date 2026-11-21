"""Regression tests for idle enrichment-worker backoff.

All tests are synthetic and make no network or database calls.
"""

from backend.workers.enrichment_worker import idle_poll_delay


def test_idle_worker_backs_off_to_one_poll_per_minute():
    assert idle_poll_delay(2, 0) == 15
    assert idle_poll_delay(2, 1) == 30
    assert idle_poll_delay(2, 2) == 60
    assert idle_poll_delay(2, 500) == 60


def test_longer_configured_poll_interval_is_respected():
    assert idle_poll_delay(45, 0) == 45
    assert idle_poll_delay(45, 1) == 60


def test_negative_poll_count_does_not_accelerate_idle_poll():
    assert idle_poll_delay(2, -2) == 15
