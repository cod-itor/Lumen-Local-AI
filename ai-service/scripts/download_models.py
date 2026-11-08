"""Per-feature model downloads (CLAUDE.md §5). Only what a feature needs; nothing runs without a flag.

    uv run python scripts/download_models.py --translation   # NLLB-200 distilled 600M → CTranslate2 int8 (~0.6 GB)

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


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--translation", action="store_true", help="NLLB-200 600M int8 for Khmer ↔ English")
    args = ap.parse_args()
    if not any(vars(args).values()):
        ap.print_help()
        return
    if args.translation:
        translation()


if __name__ == "__main__":
    main()
