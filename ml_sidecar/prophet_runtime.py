"""
Runtime helpers for making Prophet use a valid CmdStan installation.

Prophet 1.1.6 may prefer its bundled ``stan_model/cmdstan-2.33.1`` directory
even when that packaged directory is incomplete. In containerized deployments
we install a real CmdStan via cmdstanpy, then repoint Prophet at that valid
installation when needed.
"""

from __future__ import annotations

import logging
import pathlib
import shutil

logger = logging.getLogger(__name__)

_BUNDLED_CMDSTAN_DIR = "cmdstan-2.33.1"


def ensure_prophet_cmdstan_path() -> None:
    """
    Repair Prophet's preferred CmdStan directory if the packaged copy is
    incomplete and a valid cmdstanpy installation is available.
    """
    try:
        import cmdstanpy
        import prophet as prophet_module
    except Exception as exc:
        logger.debug("Prophet runtime preparation skipped: %s", exc)
        return

    try:
        installed_path = pathlib.Path(cmdstanpy.cmdstan_path()).resolve()
    except Exception as exc:
        logger.warning("CmdStan path unavailable for Prophet: %s", exc)
        return

    if not installed_path.exists():
        logger.warning("CmdStan path does not exist: %s", installed_path)
        return

    bundled_path = (
        pathlib.Path(prophet_module.__file__).resolve().parent
        / "stan_model"
        / _BUNDLED_CMDSTAN_DIR
    )

    if bundled_path.exists() and (bundled_path / "makefile").exists():
        return

    try:
        _replace_with_symlink(bundled_path, installed_path)
        logger.info("Prepared Prophet CmdStan path: %s -> %s", bundled_path, installed_path)
    except Exception as exc:
        logger.warning("Unable to repair Prophet CmdStan path: %s", exc)


def _replace_with_symlink(dst: pathlib.Path, src: pathlib.Path) -> None:
    if dst.is_symlink() or dst.is_file():
        dst.unlink()
    elif dst.exists():
        shutil.rmtree(dst)

    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.symlink_to(src, target_is_directory=True)
