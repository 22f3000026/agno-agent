from agno.tools import Toolkit
from tavily import TavilyClient
import json

class TavilyCrawlToolkit(Toolkit):
    def __init__(self, api_key: str):
        super().__init__(name="tavily_crawl_toolkit")
        self.client = TavilyClient(api_key)
        self.register(self.crawl_page)

    def crawl_page(self, url: str) -> str:
        """
        Crawl a URL using Tavily API and return the crawl data as JSON string.
        """
        try:
            response = self.client.crawl(url=url)
            return json.dumps(response)
        except Exception as e:
            raise Exception(f"Tavily crawl failed: {str(e)}")


class TavilyExtractToolkit(Toolkit):
    def __init__(self, api_key: str):
        super().__init__(name="tavily_extract_toolkit")
        self.client = TavilyClient(api_key)
        self.register(self.extract_data)

    def extract_data(self, urls: list) -> str:
        """
        Extract data from a list of URLs using Tavily API and return as JSON string.
        """
        try:
            response = self.client.extract(urls=urls)
            return json.dumps(response)
        except Exception as e:
            raise Exception(f"Tavily extract failed: {str(e)}")


class TavilySearchToolkit(Toolkit):
    def __init__(self, api_key: str):
        super().__init__(name="tavily_search_toolkit")
        self.client = TavilyClient(api_key)
        self.register(self.search_query)

    def search_query(self, query: str) -> str:
        """
        Perform a search using Tavily API and return search results as JSON string.
        """
        try:
            response = self.client.search(query=query)
            return json.dumps(response)
        except Exception as e:
            raise Exception(f"Tavily search failed: {str(e)}")
