"""X-Internal-Token check: only the backend may call this service."""

import hmac

from fastapi import Header

from app.config import get_settings
from app.errors import ServiceError


async def require_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    expected = get_settings().internal_token
    if not x_internal_token or not hmac.compare_digest(x_internal_token.encode(), expected.encode()):
        raise ServiceError("UNAUTHORIZED", "Missing or invalid internal token.", 401)
