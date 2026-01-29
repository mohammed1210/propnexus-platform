from unittest.mock import AsyncMock, patch

import pytest

from backend.utils import postcode


@pytest.mark.asyncio
async def test_postcode_lookup_is_cached_in_memory():
    with patch.object(postcode, "_fetch_postcodes_io", new=AsyncMock()) as fetch:
        fetch.return_value = {"latitude": 51.501, "longitude": -0.141}

        a = await postcode.get_lat_lng_from_postcode("SW1A 1AA")
        b = await postcode.get_lat_lng_from_postcode("SW1A1AA")

        assert a == {"latitude": 51.501, "longitude": -0.141}
        assert b == {"latitude": 51.501, "longitude": -0.141}
        assert fetch.call_count == 1
