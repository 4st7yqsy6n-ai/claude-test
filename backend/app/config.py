import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    FRED_API_KEY: str = os.getenv("FRED_API_KEY", "")
    KOYFIN_API_KEY: str = os.getenv("KOYFIN_API_KEY", "")
    ALLOWED_ORIGINS: list[str] = os.getenv("ALLOWED_ORIGINS", "*").split(",")

    @property
    def has_anthropic_key(self) -> bool:
        return bool(self.ANTHROPIC_API_KEY)

    @property
    def has_fred_key(self) -> bool:
        return bool(self.FRED_API_KEY)

    @property
    def has_koyfin_key(self) -> bool:
        return bool(self.KOYFIN_API_KEY)


settings = Settings()
