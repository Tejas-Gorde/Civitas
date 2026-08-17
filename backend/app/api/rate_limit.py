"""Redis-backed fixed-window limiter. Failure is closed in production."""
from fastapi import HTTPException, Request
from redis import Redis
from redis.exceptions import RedisError
from app.core.config import get_settings

settings = get_settings()


def get_redis_client() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def public_rate_limit(request: Request) -> None:
    key = f"rate:public:{request.client.host if request.client else 'unknown'}"
    try:
        r = get_redis_client()
        count = r.incr(key)
        if count == 1:
            r.expire(key, 60)
    except (RedisError, Exception) as error:
        if settings.environment != "development":
            raise HTTPException(503, "Rate limiting service unavailable") from error
        return
    if count > 30:
        raise HTTPException(429, "Too many requests; retry shortly")

