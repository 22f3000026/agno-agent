from agno.tools import Toolkit
from tavily import TavilyClient
import json

class TavilyCrawlToolkit(Toolkit):
    def __init__(self, api_key: str):
        super().__init__(name="tavily_crawl_toolkit")
        self.api_key = api_key  # Save API key for direct request
        self.register(self.crawl_page)

    def crawl_page(self, url: str) -> str:
        """
        Crawl a URL using Tavily API with custom options and return crawl data as JSON string.

        Args:
            url: The URL to crawl

        Returns:
            JSON string containing crawled data
        """
        try:
            # Ensure URL has proper protocol
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url

            payload = {
                "url": url,
                "max_depth": 1,
                "max_breadth": 20,
                "limit": 50,
                "instructions": "Python SDK",
                "select_paths": None,
                "select_domains": None,
                "exclude_paths": None,
                "exclude_domains": None,
                "allow_external": False,
                "include_images": False,
                "categories": None,
                "extract_depth": "basic",
                "format": "markdown"
            }

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            response = requests.post("https://api.tavily.com/crawl", json=payload, headers=headers)
            response.raise_for_status()

            return json.dumps(response.json())

        except Exception as e:
            raise Exception(f"Tavily crawl failed: {str(e)}")


class TavilyExtractToolkit(Toolkit):
    def __init__(self, api_key: str):
        super().__init__(name="tavily_extract_toolkit")
        self.client = TavilyClient(api_key)
        self.register(self.extract_data)

    def extract_data(self, urls: list[str]) -> str:
        """
        Extract data from a list of URLs using Tavily API and return as JSON string.
        
        Args:
            urls: List of URLs to extract data from
            
        Returns:
            JSON string containing extracted data
        """
        try:
            # Ensure URLs have proper protocol
            processed_urls = [url if url.startswith(('http://', 'https://')) else 'https://' + url for url in urls]

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
        self.api_key = api_key
        self.register(self.search_query)

    def search_query(self, query: str) -> str:
        """
        Perform a search using Tavily API with custom options and return results as JSON string.

        Args:
            query: The search query string

        Returns:
            JSON string containing search results
        """
        try:
            if not query or not query.strip():
                raise ValueError("Search query cannot be empty")

            payload = {
                "query": query.strip(),
                "topic": "general",
                "search_depth": "basic",
                "chunks_per_source": 3,
                "max_results": 1,
                "time_range": None,
                "days": 7,
                "include_answer": True,
                "include_raw_content": True,
                "include_images": False,
                "include_image_descriptions": False,
                "include_domains": [],
                "exclude_domains": [],
                "country": None
            }

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            response = requests.post("https://api.tavily.com/search", json=payload, headers=headers)
            response.raise_for_status()

            return json.dumps(response.json())

        except Exception as e:
            raise Exception(f"Tavily search failed: {str(e)}")
