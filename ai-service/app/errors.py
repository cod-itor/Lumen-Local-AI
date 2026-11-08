"""Service errors → HTTP status + {"code","message"} (AI_SERVICE.md §4)."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ServiceError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, extra: dict | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.extra = extra or {}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ServiceError)
    async def _service_error(_: Request, e: ServiceError) -> JSONResponse:
        return JSONResponse({"code": e.code, "message": e.message, **e.extra}, status_code=e.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, e: RequestValidationError) -> JSONResponse:
        errors = [f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in e.errors()]
        return JSONResponse({"code": "VALIDATION_ERROR", "message": "Invalid request.", "errors": errors},
                            status_code=400)
