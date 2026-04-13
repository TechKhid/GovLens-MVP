FROM python:3.11-slim

WORKDIR /app

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=100

# build-essential: needed by scikit-learn C extensions
# libgomp1: required by Prophet's underlying Stan/cmdstan
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
    && pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# Prophet requires cmdstan binaries to be compiled and available
RUN python -m cmdstanpy.install_cmdstan

# Prophet 1.1.6 prefers its bundled cmdstan path if present, but that packaged
# directory is incomplete in this environment. Point Prophet's expected path at
# the real CmdStan installation so the backend initializes correctly.
RUN python -c "\
import pathlib, shutil; \
import cmdstanpy, prophet; \
src = pathlib.Path(cmdstanpy.cmdstan_path()); \
dst = pathlib.Path(prophet.__file__).resolve().parent / 'stan_model' / 'cmdstan-2.33.1'; \
shutil.rmtree(dst, ignore_errors=True); \
dst.symlink_to(src, target_is_directory=True); \
print(f'Linked {dst} -> {src}')"

# Pre-download the sentence-transformer model weights at build time
# so the container starts instantly and needs no outbound internet at   runtime.
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('paraphrase-MiniLM-L6-v2'); \
print('Model cached.')"

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
