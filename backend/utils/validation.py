"""Data validation utilities for scraped properties."""

from typing import Dict, Any, Optional, List
from urllib.parse import urlparse


def is_valid_url(url: Optional[str]) -> bool:
    """Check if a string is a valid URL.
    
    Args:
        url: URL string to validate
        
    Returns:
        True if valid URL, False otherwise
    """
    if not url or not isinstance(url, str):
        return False

    try:
        result = urlparse(url.strip())
        return all([result.scheme, result.netloc])
    except Exception:
        return False


def is_valid_image_url(url: Optional[str]) -> bool:
    """Check if a URL is likely a valid image URL.
    
    Args:
        url: Image URL to validate
        
    Returns:
        True if likely valid image URL, False otherwise
    """
    if not is_valid_url(url):
        return False

    # Check for common image URL patterns
    url_lower = url.lower()

    # Check for common image extensions
    image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
    has_extension = any(url_lower.endswith(ext) for ext in image_extensions)

    # Check for common image URL patterns (e.g., /images/, /photos/, etc.)
    image_patterns = ['/image', '/photo', '/picture', '/media', '/upload']
    has_pattern = any(pattern in url_lower for pattern in image_patterns)

    # Data URLs are valid for images
    is_data_url = url.startswith('data:image/')

    return has_extension or has_pattern or is_data_url


def validate_property_data(data: Dict[str, Any]) -> Dict[str, List[str]]:
    """Validate property data and return validation issues.
    
    Args:
        data: Property data dictionary to validate
        
    Returns:
        Dictionary mapping field names to lists of validation error messages
        Empty dict if no validation issues
    """
    issues: Dict[str, List[str]] = {}

    # Validate external_id
    external_id = data.get('external_id')
    if not external_id or not str(external_id).strip():
        issues.setdefault('external_id', []).append("Missing or empty external_id")

    # Validate title
    title = data.get('title')
    if not title or not str(title).strip() or str(title).strip().lower() in ['untitled', 'property']:
        issues.setdefault('title', []).append("Missing or generic title")

    # Validate price
    price = data.get('price')
    if price is not None:
        try:
            price_int = int(price)
            if price_int <= 0:
                issues.setdefault('price', []).append(f"Invalid price: {price} (must be > 0)")
        except (ValueError, TypeError):
            issues.setdefault('price', []).append(f"Invalid price format: {price}")

    # Validate image_url
    image_url = data.get('image_url')
    if image_url:
        if not is_valid_image_url(image_url):
            issues.setdefault('image_url', []).append(f"Invalid image URL: {image_url}")

    # Validate image_urls array
    image_urls = data.get('image_urls')
    if image_urls:
        if not isinstance(image_urls, list):
            issues.setdefault('image_urls', []).append("image_urls must be a list")
        else:
            invalid_urls = [url for url in image_urls if not is_valid_image_url(url)]
            if invalid_urls:
                issues.setdefault('image_urls', []).append(
                    f"Invalid image URLs: {invalid_urls[:3]}"  # Show first 3
                )

    # Validate coordinates
    latitude = data.get('latitude')
    longitude = data.get('longitude')

    if latitude is not None:
        try:
            lat_float = float(latitude)
            if not (-90 <= lat_float <= 90):
                issues.setdefault('latitude', []).append(
                    f"Latitude out of range: {latitude}"
                )
        except (ValueError, TypeError):
            issues.setdefault('latitude', []).append(f"Invalid latitude: {latitude}")

    if longitude is not None:
        try:
            lng_float = float(longitude)
            if not (-180 <= lng_float <= 180):
                issues.setdefault('longitude', []).append(
                    f"Longitude out of range: {longitude}"
                )
        except (ValueError, TypeError):
            issues.setdefault('longitude', []).append(f"Invalid longitude: {longitude}")

    # Validate bedrooms/bathrooms
    for field in ['bedrooms', 'bathrooms']:
        value = data.get(field)
        if value is not None and value != 0:
            try:
                int_val = int(value)
                if int_val < 0:
                    issues.setdefault(field, []).append(
                        f"{field} cannot be negative: {value}"
                    )
            except (ValueError, TypeError):
                issues.setdefault(field, []).append(
                    f"Invalid {field} format: {value}"
                )

    # Validate source
    source = data.get('source')
    if not source or not str(source).strip():
        issues.setdefault('source', []).append("Missing source")

    return issues


def should_insert_property(data: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """Determine if a property should be inserted into the database.
    
    Args:
        data: Property data dictionary
        
    Returns:
        Tuple of (should_insert: bool, reason: Optional[str])
        If should_insert is False, reason explains why
    """
    # Critical fields that must be present
    external_id = data.get('external_id')
    if not external_id or not str(external_id).strip():
        return False, "Missing external_id"

    title = data.get('title')
    if not title or not str(title).strip():
        return False, "Missing title"

    # Check if title is too generic
    title_lower = str(title).strip().lower()
    if title_lower in ['untitled', 'property', 'listing']:
        return False, f"Generic title: {title}"

    # Must have either price or location
    price = data.get('price')
    location = data.get('location') or data.get('address')

    if not price and not location:
        return False, "Missing both price and location"

    # Validate price if present
    if price is not None:
        try:
            price_int = int(price)
            if price_int <= 0:
                return False, f"Invalid price: {price}"
        except (ValueError, TypeError):
            return False, f"Invalid price format: {price}"

    # Must have source
    source = data.get('source')
    if not source or not str(source).strip():
        return False, "Missing source"

    return True, None


def clean_property_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Clean and normalize property data.
    
    Args:
        data: Raw property data
        
    Returns:
        Cleaned property data
    """
    cleaned = data.copy()

    # Normalize string fields
    for field in ['title', 'location', 'address', 'description', 'source']:
        if field in cleaned and cleaned[field]:
            cleaned[field] = str(cleaned[field]).strip()

    # Normalize numeric fields
    for field in ['price', 'bedrooms', 'bathrooms']:
        if field in cleaned and cleaned[field] is not None:
            try:
                cleaned[field] = int(cleaned[field])
            except (ValueError, TypeError):
                cleaned[field] = None

    # Normalize coordinate fields
    for field in ['latitude', 'longitude']:
        if field in cleaned and cleaned[field] is not None:
            try:
                cleaned[field] = float(cleaned[field])
            except (ValueError, TypeError):
                cleaned[field] = None

    # Clean image URLs
    if 'image_url' in cleaned and cleaned['image_url']:
        url = str(cleaned['image_url']).strip()
        if not is_valid_image_url(url):
            cleaned['image_url'] = None

    if 'image_urls' in cleaned and isinstance(cleaned['image_urls'], list):
        cleaned['image_urls'] = [
            str(url).strip()
            for url in cleaned['image_urls']
            if url and is_valid_image_url(str(url))
        ]

    return cleaned
