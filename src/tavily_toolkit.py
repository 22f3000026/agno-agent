import json
from agno.tools import Toolkit
from tavily import TavilyClient

class TavilyCrawlToolkit(Toolkit):
    def __init__(self, api_key: str):
        super().__init__(name="tavily_crawl_toolkit")
        self.client = TavilyClient(api_key)
        self.register(self.crawl_page)

    def crawl_page(self, url: str) -> str:
        try:
            if not url.startswith(("http://", "https://")):
                url = "https://" + url

            response = self.client.crawl(
                url=url,
                max_depth=1,
                max_breadth=20,
                limit=50,
                instructions="Python SDK",
                allow_external=False,
                include_images=False,
                extract_depth="basic",
                format="markdown"
            )
            return json.dumps(response)
        except Exception as e:
            raise Exception(f"Tavily crawl failed: {str(e)}")

class TavilyExtractToolkit(Toolkit):
    def __init__(self, api_key: str):
        super().__init__(name="tavily_extract_toolkit")
        self.client = TavilyClient(api_key)
        self.register(self.extract_data)

    def extract_data(self, urls: list[str]) -> str:
        try:
            processed_urls = [
                url if url.startswith(("http://", "https://")) else "https://" + url
                for url in urls
            ]

            response = self.client.extract(
                urls=processed_urls,
                include_images=False,
                extract_depth="basic",
                format="markdown"
            )
            return json.dumps(response)
        except Exception as e:
            raise Exception(f"Tavily extract failed: {str(e)}")

class TavilySearchToolkit(Toolkit):
    def __init__(self, api_key: str):
        super().__init__(name="tavily_search_toolkit")
        self.client = TavilyClient(api_key)
        self.register(self.search_query)

    def search_query(self, query: str) -> str:
        try:
            if not query or not query.strip():
                raise ValueError("Search query cannot be empty")

            response = self.client.search(
                query=query.strip(),
                search_depth="basic",
                chunks_per_source=3,
                max_results=1,
                include_answer=True,
                include_raw_content=True,
                include_images=False,
                include_image_descriptions=False
            )
            return json.dumps(response)
        except Exception as e:
            raise Exception(f"Tavily search failed: {str(e)}")
