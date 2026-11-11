FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.12.7 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY app ./app
COPY data ./data
# Jalan sebagai pengguna biasa; var/ (SQLite laporan) dipasang sebagai volume.
RUN useradd --system --uid 10001 narasi && mkdir -p var && chown narasi var
USER narasi
ENV PORT=8080 PATH="/app/.venv/bin:$PATH"
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,os; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/health', timeout=2)"
# Satu worker: sesi analisis + aliran SSE disimpan di memori proses (asyncio menangani ribuan koneksi serentak).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --proxy-headers --forwarded-allow-ips='*' --timeout-graceful-shutdown 20 --no-access-log"]
