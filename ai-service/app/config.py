"""Settings from the environment / .env (AI_SERVICE.md §12.1)."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=SERVICE_DIR / ".env", extra="ignore")

    host: str = "127.0.0.1"
    port: int = 8001
    internal_token: str = Field(min_length=8)
    ai_profile: Literal["full", "lite"] = "full"
    app_name: str = "Lumen"
    database_url: str = "postgresql://learnai:learnai-local@localhost:5433/learnai"
    rules_dir: Path = SERVICE_DIR.parent / "rules"
    storage_dir: Path = SERVICE_DIR.parent / "storage"
    models_dir: Path = SERVICE_DIR / "models"
    public_url: str = "http://localhost:3000"

    ollama_host: str = "http://localhost:11434"
    ollama_chat_model: str = "llama3.2"
    ollama_embed_model: str = "embeddinggemma"
    ollama_keep_alive: str = "30m"
    embed_dim: int = 768

    searxng_url: str = "http://localhost:8888"

    translation_model_dir: Path = SERVICE_DIR / "models" / "nllb-200-distilled-600M-int8"
    translation_tokenizer: str = "facebook/nllb-200-distilled-600M"
    whisper_en_model: str = "small"
    whisper_km_model_dir: Path = SERVICE_DIR / "models" / "whisper-small-khmer-ct2"

    image_backend: Literal["mflux", "diffusers"] = "mflux"
    image_model: str = "black-forest-labs/FLUX.2-klein-4B"
    image_quantize: int = 4
    image_unload_after_job: bool = True
    rembg_model: str = "isnet-general-use"

    guard_injection_classifier: bool = False
    prompt_guard_model: str = "meta-llama/Llama-Prompt-Guard-2-22M"
    hf_token: str = ""
    guard_content_classifier: bool = False
    guard_content_model: str = "llama-guard3:1b"

    idle_unload_minutes: int = 10
    log_prompts: bool = False

    # Optional per-feature overrides of the profile defaults (AI_SERVICE.md §1).
    feature_host_chat: bool | None = None
    feature_web_search: bool | None = None
    feature_translation: bool | None = None
    feature_voice: bool | None = None
    feature_images: bool | None = None
    feature_bg_removal: bool | None = None
    feature_tts: bool | None = None

    def resolve_paths(self) -> "Settings":
        """Relative paths in .env are relative to the ai-service folder, not the shell's cwd."""
        for name in ("rules_dir", "storage_dir", "models_dir", "translation_model_dir", "whisper_km_model_dir"):
            p: Path = getattr(self, name)
            if not p.is_absolute():
                setattr(self, name, (SERVICE_DIR / p).resolve())
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings().resolve_paths()  # type: ignore[call-arg]
