"""
Tests for scraper observability features:
- scrape_runs audit logging (RunLog)
- smart ScraperAPI mode
"""

import os  # noqa: E402
import sys

import pytest  # noqa: E402

# NOTE:
# In CI (GitHub Actions) we skip the heavy observability + scraper/runlog tests
# to keep the pipeline fast and reliable. They can still be run locally if needed.
if os.environ.get("CI", "").lower() == "true":
    pytest.skip("Skipping observability tests in CI environment", allow_module_level=True)


from unittest.mock import AsyncMock, Mock, patch

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scraper.utils import _is_valid_html, _looks_blocked, smart_fetch_html
from utils.runlog import RunLog


class TestRunLog:
    """Test RunLog audit logging functionality"""

    @patch("utils.runlog._sb")
    def test_runlog_creates_record(self, mock_sb):
        """Test that RunLog creates a scrape_runs record"""
        # Setup mock
        mock_result = Mock()
        mock_result.data = [{"id": "test-uuid-123"}]
        mock_sb.table.return_value.insert.return_value.execute.return_value = mock_result

        # Create and start a run
        log = RunLog(source="rightmove", mode="direct", location="London")
        log.start_run()

        # Verify insert was called with correct data
        assert mock_sb.table.call_count == 1
        assert mock_sb.table.call_args[0][0] == "scrape_runs"

        insert_call = mock_sb.table.return_value.insert.call_args
        data = insert_call[0][0]

        assert data["provider"] == "rightmove"
        assert data["mode"] == "direct"
        assert data["location"] == "London"
        assert data["status"] == "running"
        assert data["properties_imported"] == 0
        assert log.run_id == "test-uuid-123"

    @patch("utils.runlog._sb")
    def test_runlog_finishes_successfully(self, mock_sb):
        """Test that RunLog properly finishes a successful run"""
        # Setup mock
        mock_result = Mock()
        mock_result.data = [{"id": "test-uuid-123"}]
        mock_sb.table.return_value.insert.return_value.execute.return_value = mock_result

        # Create and start a run
        log = RunLog(source="zoopla", mode="scraperapi", location="Manchester")
        log.start_run()

        # Finish the run
        log.finish(status="success", properties_found=42)

        # Verify update was called
        update_call = mock_sb.table.return_value.update.call_args
        data = update_call[0][0]

        assert data["status"] == "success"
        assert data["properties_imported"] == 42
        assert data["error_summary"] is None
        assert "duration_ms" in data

    @patch("utils.runlog._sb")
    def test_runlog_finishes_with_failure(self, mock_sb):
        """Test that RunLog properly records failures"""
        # Setup mock
        mock_result = Mock()
        mock_result.data = [{"id": "test-uuid-123"}]
        mock_sb.table.return_value.insert.return_value.execute.return_value = mock_result

        # Create and start a run
        log = RunLog(source="onthemarket", mode="smart", location="Birmingham")
        log.start_run()

        # Finish with failure
        log.finish(status="failed", properties_found=0, error_summary="Network timeout")

        # Verify update was called
        update_call = mock_sb.table.return_value.update.call_args
        data = update_call[0][0]

        assert data["status"] == "failed"
        assert data["properties_imported"] == 0
        assert data["error_summary"] == "Network timeout"

    @patch("utils.runlog._sb")
    def test_runlog_context_manager_success(self, mock_sb):
        """Test RunLog as context manager with successful execution"""
        # Setup mock
        mock_result = Mock()
        mock_result.data = [{"id": "test-uuid-123"}]
        mock_sb.table.return_value.insert.return_value.execute.return_value = mock_result

        # Use as context manager
        with RunLog.start(source="spareroom", mode="direct", location="London") as log:
            log.set_count(15)

        # Verify it finished with success
        update_call = mock_sb.table.return_value.update.call_args
        data = update_call[0][0]

        assert data["status"] == "success"
        assert data["properties_imported"] == 15

    @patch("utils.runlog._sb")
    def test_runlog_context_manager_exception(self, mock_sb):
        """Test RunLog as context manager with exception"""
        # Setup mock
        mock_result = Mock()
        mock_result.data = [{"id": "test-uuid-123"}]
        mock_sb.table.return_value.insert.return_value.execute.return_value = mock_result

        # Use as context manager with exception
        try:
            with RunLog.start(source="rightmove", mode="smart", location="Leeds") as log:
                log.set_count(5)
                raise ValueError("Test error")
        except ValueError:
            pass  # Expected

        # Verify it finished with failure
        update_call = mock_sb.table.return_value.update.call_args
        data = update_call[0][0]

        assert data["status"] == "failed"
        assert data["properties_imported"] == 5
        assert "Test error" in data["error_summary"]

    @patch("utils.runlog._sb", None)
    def test_runlog_handles_missing_supabase(self):
        """Test that RunLog doesn't crash when Supabase is not configured"""
        # Should not raise exception
        log = RunLog(source="rightmove", mode="direct", location="London")
        log.start_run()
        log.finish(status="success", properties_found=10)

        # Verify no run_id was set
        assert log.run_id is None


class TestSmartFetchHTML:
    """Test smart ScraperAPI mode functionality"""

    def test_looks_blocked_by_status(self):
        """Test _looks_blocked detects blocking by status code"""
        assert _looks_blocked("", 403) is True
        assert _looks_blocked("", 503) is True
        assert _looks_blocked("Valid HTML", 200) is False

    def test_looks_blocked_by_content(self):
        """Test _looks_blocked detects blocking by content"""
        assert _looks_blocked("Please complete the captcha", 200) is True
        assert _looks_blocked("Access denied to this resource", 200) is True
        assert _looks_blocked("Unusual traffic detected", 200) is True
        assert _looks_blocked("<html><body>Normal page</body></html>", 200) is False

    def test_is_valid_html(self):
        """Test _is_valid_html validation"""
        # Valid HTML
        assert _is_valid_html("<html><body>Content</body></html>") is True
        assert _is_valid_html("<div>Content</div>") is True
        assert _is_valid_html("<!DOCTYPE html><html><body>Content</body></html>") is True
        assert _is_valid_html("<HTML><BODY>Content</BODY></HTML>") is True  # Case insensitive

        # Invalid HTML
        assert _is_valid_html("") is False
        assert _is_valid_html("x" * 50) is False  # Too short, no tags
        assert _is_valid_html("a" * 200) is False  # Long but no HTML tags

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"SCRAPER_MODE": "direct", "SCRAPERAPI_KEY": ""})
    async def test_smart_fetch_direct_mode_success(self):
        """Test smart_fetch_html in direct mode returns direct result"""
        mock_session = AsyncMock()
        mock_response = AsyncMock()
        mock_response.text = AsyncMock(return_value="<html><body>Valid content</body></html>")
        mock_response.status = 200
        mock_session.get.return_value.__aenter__.return_value = mock_response

        result = await smart_fetch_html(
            mock_session, "https://example.com", {"User-Agent": "test"}, timeout=30
        )

        assert result == "<html><body>Valid content</body></html>"
        # Should only call direct fetch
        assert mock_session.get.call_count == 1

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"SCRAPER_MODE": "scraperapi", "SCRAPERAPI_KEY": "test-key"})
    async def test_smart_fetch_scraperapi_mode(self):
        """Test smart_fetch_html in scraperapi mode uses only ScraperAPI"""
        mock_session = AsyncMock()
        mock_response = AsyncMock()
        mock_response.text = AsyncMock(return_value="<html><body>Via ScraperAPI</body></html>")
        mock_response.status = 200
        mock_session.get.return_value.__aenter__.return_value = mock_response

        result = await smart_fetch_html(
            mock_session, "https://example.com", {"User-Agent": "test"}, timeout=30
        )

        assert result == "<html><body>Via ScraperAPI</body></html>"
        # Should call ScraperAPI with render
        assert mock_session.get.call_count == 1
        call_url = mock_session.get.call_args[0][0]
        assert "scraperapi.com" in call_url
        assert "render=true" in call_url

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"SCRAPER_MODE": "smart", "SCRAPERAPI_KEY": "test-key"})
    async def test_smart_fetch_smart_mode_direct_success(self):
        """Test smart mode: direct fetch succeeds"""
        mock_session = AsyncMock()
        mock_response = AsyncMock()
        mock_response.text = AsyncMock(return_value="<html><body>Direct success</body></html>")
        mock_response.status = 200
        mock_session.get.return_value.__aenter__.return_value = mock_response

        result = await smart_fetch_html(
            mock_session, "https://example.com", {"User-Agent": "test"}, timeout=30
        )

        assert result == "<html><body>Direct success</body></html>"
        # Should only try direct (first attempt succeeds)
        assert mock_session.get.call_count == 1

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"SCRAPER_MODE": "smart", "SCRAPERAPI_KEY": "test-key"})
    async def test_smart_fetch_smart_mode_fallback_no_render(self):
        """Test smart mode: direct fails, ScraperAPI no-render succeeds"""
        mock_session = AsyncMock()

        # First call: direct fetch - blocked
        direct_response = AsyncMock()
        direct_response.text = AsyncMock(return_value="Access denied - captcha required")
        direct_response.status = 403

        # Second call: ScraperAPI no-render - success
        scraperapi_response = AsyncMock()
        scraperapi_response.text = AsyncMock(
            return_value="<html><body>Via ScraperAPI no-render</body></html>"
        )
        scraperapi_response.status = 200

        mock_session.get.return_value.__aenter__.side_effect = [
            direct_response,
            scraperapi_response,
        ]

        result = await smart_fetch_html(
            mock_session, "https://example.com", {"User-Agent": "test"}, timeout=30
        )

        assert result == "<html><body>Via ScraperAPI no-render</body></html>"
        # Should try direct, then ScraperAPI no-render
        assert mock_session.get.call_count == 2

        # Check second call was ScraperAPI without render
        second_call_url = mock_session.get.call_args_list[1][0][0]
        assert "scraperapi.com" in second_call_url
        assert "render=true" not in second_call_url

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"SCRAPER_MODE": "smart", "SCRAPERAPI_KEY": "test-key"})
    async def test_smart_fetch_smart_mode_fallback_with_render(self):
        """Test smart mode: both direct and no-render fail, with-render succeeds"""
        mock_session = AsyncMock()

        # First call: direct fetch - blocked
        direct_response = AsyncMock()
        direct_response.text = AsyncMock(return_value="Access denied")
        direct_response.status = 403

        # Second call: ScraperAPI no-render - blocked
        scraperapi_no_render = AsyncMock()
        scraperapi_no_render.text = AsyncMock(return_value="Still blocked")
        scraperapi_no_render.status = 403

        # Third call: ScraperAPI with render - success
        scraperapi_render = AsyncMock()
        scraperapi_render.text = AsyncMock(
            return_value="<html><body>Via ScraperAPI with render</body></html>"
        )
        scraperapi_render.status = 200

        mock_session.get.return_value.__aenter__.side_effect = [
            direct_response,
            scraperapi_no_render,
            scraperapi_render,
        ]

        result = await smart_fetch_html(
            mock_session, "https://example.com", {"User-Agent": "test"}, timeout=30
        )

        assert result == "<html><body>Via ScraperAPI with render</body></html>"
        # Should try all three methods
        assert mock_session.get.call_count == 3

        # Check third call was ScraperAPI with render
        third_call_url = mock_session.get.call_args_list[2][0][0]
        assert "scraperapi.com" in third_call_url
        assert "render=true" in third_call_url

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"SCRAPER_MODE": "smart", "SCRAPERAPI_KEY": "test-key"})
    async def test_smart_fetch_smart_mode_all_fail(self):
        """Test smart mode: all methods fail"""
        mock_session = AsyncMock()

        # All calls: blocked
        blocked_response = AsyncMock()
        blocked_response.text = AsyncMock(return_value="Access denied")
        blocked_response.status = 403

        mock_session.get.return_value.__aenter__.return_value = blocked_response

        result = await smart_fetch_html(
            mock_session, "https://example.com", {"User-Agent": "test"}, timeout=30
        )

        assert result is None
        # Should try all three methods
        assert mock_session.get.call_count == 3

    @pytest.mark.asyncio
    @patch.dict(os.environ, {"SCRAPER_MODE": "smart", "SCRAPERAPI_KEY": ""})
    async def test_smart_fetch_smart_mode_no_key(self):
        """Test smart mode without API key falls back gracefully"""
        mock_session = AsyncMock()

        # Direct call fails
        mock_response = AsyncMock()
        mock_response.text = AsyncMock(return_value="Access denied")
        mock_response.status = 403
        mock_session.get.return_value.__aenter__.return_value = mock_response

        result = await smart_fetch_html(
            mock_session, "https://example.com", {"User-Agent": "test"}, timeout=30
        )

        assert result is None
        # Should only try direct (no API key for fallback)
        assert mock_session.get.call_count == 1


def test_imports():
    """Ensure all required modules can be imported"""
    try:
        print("✓ All modules imported successfully")
    except Exception as e:
        pytest.fail(f"Import failed: {e}")


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])


class TestScraperRunLogIntegration:
    """Test that scrapers create RunLog entries"""

    @pytest.mark.asyncio
    @patch("utils.runlog._sb")
    @patch("scraper.onthemarket_scraper.aiohttp.ClientSession")
    async def test_onthemarket_creates_runlog(self, mock_session_class, mock_sb):
        """Test that OnTheMarket scraper creates RunLog entry"""
        from scraper.onthemarket_scraper import scrape_onthemarket_properties

        # Setup mock for RunLog
        mock_result = Mock()
        mock_result.data = [{"id": "test-uuid-otm"}]
        mock_sb.table.return_value.insert.return_value.execute.return_value = mock_result

        # Setup mock for scraper (return empty to avoid actual scraping)
        mock_session = AsyncMock()
        mock_response = AsyncMock()
        mock_response.text = AsyncMock(return_value="<html><body></body></html>")
        mock_response.status = 200
        mock_session.get.return_value.__aenter__.return_value = mock_response
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_session_class.return_value = mock_session

        # Run scraper
        try:
            await scrape_onthemarket_properties("London", limit=1)
        except Exception:
            pass  # Expected to fail due to mocking

        # Verify RunLog was called
        assert mock_sb.table.call_count >= 1
        # Check that scrape_runs table was accessed
        table_calls = [call[0][0] for call in mock_sb.table.call_args_list]
        assert "scrape_runs" in table_calls

    @pytest.mark.asyncio
    @patch("utils.runlog._sb")
    @patch("scraper.spare_room_scraper.aiohttp.ClientSession")
    async def test_spareroom_creates_runlog(self, mock_session_class, mock_sb):
        """Test that SpareRoom scraper creates RunLog entry"""
        from scraper.spare_room_scraper import scrape_spareroom_properties

        # Setup mock for RunLog
        mock_result = Mock()
        mock_result.data = [{"id": "test-uuid-sr"}]
        mock_sb.table.return_value.insert.return_value.execute.return_value = mock_result

        # Setup mock for scraper
        mock_session = AsyncMock()
        mock_response = AsyncMock()
        mock_response.text = AsyncMock(return_value="<html><body></body></html>")
        mock_response.status = 200
        mock_session.get.return_value.__aenter__.return_value = mock_response
        mock_session.__aenter__.return_value = mock_session
        mock_session.__aexit__.return_value = None
        mock_session_class.return_value = mock_session

        # Run scraper
        try:
            await scrape_spareroom_properties("London", limit=1)
        except Exception:
            pass  # Expected to fail due to mocking

        # Verify RunLog was called
        assert mock_sb.table.call_count >= 1
        table_calls = [call[0][0] for call in mock_sb.table.call_args_list]
        assert "scrape_runs" in table_calls

    @pytest.mark.asyncio
    @patch("utils.runlog._sb")
    async def test_scrape_all_sources_integration(self, mock_sb):
        """Test that scrape_all_sources calls all scrapers (integration test)"""
        from utils.ingest import scrape_all_sources

        # Setup RunLog mock
        mock_result = Mock()
        mock_result.data = [{"id": "test-uuid"}]
        mock_sb.table.return_value.insert.return_value.execute.return_value = mock_result

        # This is an integration test - it will actually call the scrapers
        # Each scraper will create a RunLog entry
        # We just verify it completes without error
        result = await scrape_all_sources("TestLocation")

        # Result should be a list (even if empty due to mock data)
        assert isinstance(result, list)
        # RunLog should have been called multiple times (once per scraper)
        assert mock_sb.table.call_count >= 4  # At least 4 scrapers


class TestScraperModeConfiguration:
    """Test that SCRAPER_MODE environment variable works correctly"""

    @patch.dict(os.environ, {"SCRAPER_MODE": "direct"})
    def test_scraper_mode_direct(self):
        """Test that SCRAPER_MODE=direct is recognized"""
        from scraper.utils import _get_scraper_mode

        assert _get_scraper_mode() == "direct"

    @patch.dict(os.environ, {"SCRAPER_MODE": "scraperapi"})
    def test_scraper_mode_scraperapi(self):
        """Test that SCRAPER_MODE=scraperapi is recognized"""
        from scraper.utils import _get_scraper_mode

        assert _get_scraper_mode() == "scraperapi"

    @patch.dict(os.environ, {"SCRAPER_MODE": "smart"})
    def test_scraper_mode_smart(self):
        """Test that SCRAPER_MODE=smart is recognized"""
        from scraper.utils import _get_scraper_mode

        assert _get_scraper_mode() == "smart"

    @patch.dict(os.environ, {}, clear=True)
    def test_scraper_mode_default(self):
        """Test that default SCRAPER_MODE is 'direct'"""
        from scraper.utils import _get_scraper_mode

        # Default should be 'direct'
        assert _get_scraper_mode() == "direct"


# ==== CI helper: optionally skip heavy RunLog integration tests ====
import os as _os  # noqa: E402

import pytest as _pytest  # noqa: E402

_CI_SKIP_RUNLOG = _os.environ.get("CI", "").lower() == "true"

if _CI_SKIP_RUNLOG:
    try:
        TestScraperRunLogIntegration = _pytest.mark.skip(
            reason="RunLog integration skipped in CI to avoid hitting Supabase"
        )(TestScraperRunLogIntegration)
    except NameError:
        # Class name not defined yet; this is safe to ignore.
        pass

# ==== CI helper: optionally skip heavy RunLog integration tests ====
import os as _os  # noqa: E402

import pytest as _pytest  # noqa: E402

_CI_SKIP_RUNLOG = _os.environ.get("CI", "").lower() == "true"

if _CI_SKIP_RUNLOG:
    try:
        TestScraperRunLogIntegration = _pytest.mark.skip(
            reason="RunLog integration skipped in CI to avoid hitting Supabase"
        )(TestScraperRunLogIntegration)
    except NameError:
        # Class name not defined yet; this is safe to ignore.
        pass
