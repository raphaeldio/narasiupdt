import os

# Uji tidak boleh menyentuh jaringan: sumber bukti daring tanpa kunci (feed RSS, Google News) dimatikan.
os.environ["FACT_FEEDS"] = "false"
os.environ["NEWS_SEARCH"] = "false"
# Kasus uji memakai korpus data uji di backend/data/testbed_fixtures.json.
os.environ["TESTBED_FIXTURES"] = "true"
