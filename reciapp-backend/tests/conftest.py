import os
import tempfile

os.environ.setdefault("SECRET_KEY", "test-secret-key-only-for-unit-tests")
# SQLite temporal: los tests de integración corren sin PostgreSQL
os.environ.setdefault("DATABASE_URL", "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.db"))
os.environ["LLM_PROVIDER"] = "local"
