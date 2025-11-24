import asyncio

from backend.tasks.cron_tasks import daily_scrape


def main() -> None:
  asyncio.run(daily_scrape())


if __name__ == "__main__":
  main()
