"""Per-feature model downloads (CLAUDE.md §5). Only what a feature needs; nothing runs without a flag.

    uv run python scripts/download_models.py --translation   # NLLB-200 distilled 600M → CTranslate2 int8 (~0.6 GB)
    uv run python scripts/download_models.py --background    # rembg isnet-general-use (~0.17 GB, Apache-2.0)
    uv run --group images python scripts/download_models.py --images  # FLUX.2 [klein] 4B, mflux 4-bit (~4.6 GB)
    uv run python scripts/download_models.py --voice         # Whisper small EN (~0.5 GB) + Khmer fine-tune (int8)

--translation downloads Meta's official facebook/nllb-200-distilled-600M (~2.5 GB) and converts it in a temporary
virtualenv (torch + transformers, pinned) that is deleted afterwards, together with the download cache.
License: CC-BY-NC-4.0 (non-commercial).
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SERVICE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE))

CONVERTER_PINS = [
    "torch==2.14.1",
    "transformers==4.57.6",
    "ctranslate2==4.8.3",
    "sentencepiece==0.2.2",
    "protobuf==7.36.2",
]
NLLB = "facebook/nllb-200-distilled-600M"


def translation() -> None:
    from app.config import get_settings

    out = get_settings().translation_model_dir
    if (out / "model.bin").is_file() and (out / "sentencepiece.bpe.model").is_file():
        print(f"translation model already present: {out}")
        return
    uv = shutil.which("uv")
    if not uv:
        sys.exit("uv is required (https://docs.astral.sh/uv/)")
    with tempfile.TemporaryDirectory(prefix="nllb-convert-") as tmp:
        venv, hf = Path(tmp) / ".venv", Path(tmp) / "hf"
        subprocess.run([uv, "venv", "-q", "--python", "3.12", str(venv)], check=True)  # noqa: S603
        subprocess.run(  # noqa: S603
            [uv, "pip", "install", "-q", "--python", str(venv / "bin" / "python"), *CONVERTER_PINS], check=True
        )
        env = {"HF_HOME": str(hf), "HF_HUB_DISABLE_TELEMETRY": "1", "PATH": "/usr/bin:/bin"}
        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(  # noqa: S603
            [
                str(venv / "bin" / "ct2-transformers-converter"),
                "--model",
                NLLB,
                "--output_dir",
                str(out),
                "--quantization",
                "int8",
                "--force",
            ],
            check=True,
            env=env,
        )
        spm = next(hf.glob("hub/models--facebook--nllb-200-distilled-600M/snapshots/*/sentencepiece.bpe.model"))
        shutil.copy(spm, out / "sentencepiece.bpe.model")
    print(f"translation model ready: {out}")


WHISPER_EN_REPO = "Systran/faster-whisper-{name}"  # MIT, CTranslate2 conversion of openai/whisper
WHISPER_KM = "seanghay/whisper-small-khmer-v2"  # Apache-2.0; base Whisper is unusable for Khmer (AI_SERVICE.md §11.1)


def voice() -> None:
    from huggingface_hub import snapshot_download

    from app.config import get_settings

    s = get_settings()
    en = s.models_dir / f"faster-whisper-{s.whisper_en_model}"
    if not (en / "model.bin").is_file():
        snapshot_download(WHISPER_EN_REPO.format(name=s.whisper_en_model), local_dir=en)
    print(f"whisper EN ready: {en}")
    km = s.whisper_km_model_dir
    if (km / "model.bin").is_file():
        print(f"whisper KM already present: {km}")
        return
    uv = shutil.which("uv")
    if not uv:
        sys.exit("uv is required (https://docs.astral.sh/uv/)")
    with tempfile.TemporaryDirectory(prefix="whisper-km-convert-") as tmp:
        venv, hf = Path(tmp) / ".venv", Path(tmp) / "hf"
        subprocess.run([uv, "venv", "-q", "--python", "3.12", str(venv)], check=True)  # noqa: S603
        subprocess.run(  # noqa: S603
            [uv, "pip", "install", "-q", "--python", str(venv / "bin" / "python"), *CONVERTER_PINS], check=True
        )
        env = {"HF_HOME": str(hf), "HF_HUB_DISABLE_TELEMETRY": "1", "PATH": "/usr/bin:/bin"}
        km.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(  # noqa: S603
            [
                str(venv / "bin" / "ct2-transformers-converter"),
                "--model",
                WHISPER_KM,
                "--output_dir",
                str(km),
                "--quantization",
                "int8",
                "--copy_files",
                "tokenizer.json",
                "preprocessor_config.json",
                "--force",
            ],
            check=True,
            env=env,
        )
    print(f"whisper KM ready: {km}")


IMAGE_REPO = "Runpod/FLUX.2-klein-4B-mflux-4bit"  # Apache-2.0, 4-bit quantization of black-forest-labs/FLUX.2-klein-4B


def background() -> None:
    from rembg import new_session

    from app.config import get_settings

    new_session(get_settings().rembg_model)  # downloads once into ~/.u2net
    print(f"background model ready: {get_settings().rembg_model}")


def images() -> None:
    from huggingface_hub import snapshot_download

    from app.config import get_settings

    out = get_settings().image_model_dir
    snapshot_download(IMAGE_REPO, local_dir=out)
    print(f"image model ready: {out}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--translation", action="store_true", help="NLLB-200 600M int8 for Khmer ↔ English")
    ap.add_argument("--voice", action="store_true", help="faster-whisper small (EN) + Khmer Whisper fine-tune")
    ap.add_argument("--background", action="store_true", help="rembg isnet-general-use for background removal")
    ap.add_argument("--images", action="store_true", help="FLUX.2 [klein] 4B 4-bit (needs `uv run --group images`)")
    args = ap.parse_args()
    if not any(vars(args).values()):
        ap.print_help()
        return
    if args.translation:
        translation()
    if args.voice:
        voice()
    if args.background:
        background()
    if args.images:
        images()


if __name__ == "__main__":
    main()
