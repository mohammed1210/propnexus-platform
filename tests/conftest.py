import os


def pytest_configure():
    # Safe placeholders for tests (no real secrets)
    os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test_service_role_key_placeholder")
    os.environ.setdefault("SUPABASE_KEY", os.environ["SUPABASE_SERVICE_ROLE_KEY"])
