import json
import requests
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

class TavilyMapToolkit(Toolkit):
    def __init__(self, api_key: str):
        super().__init__(name="tavily_map_toolkit")
        self.api_key = api_key
        self.base_url = "https://api.tavily.com/map"
        self.register(self.map_site)

    def map_site(self,
                 url: str,
                 max_depth: int = 1) -> str:
        """
        Performs a site map using the Tavily API.
        """
        try:
            if not url.startswith(("http://", "https://")):
                url = "https://" + url

            payload = {
                "url": url,
                "max_depth": max_depth,
            }

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            response = requests.post(self.base_url, json=payload, headers=headers)
            response.raise_for_status()
            return response.text

        except requests.exceptions.HTTPError as e:
            # This will catch 4xx and 5xx errors and provide a more detailed message
            error_message = f"Tavily map failed with status {e.response.status_code}"
            try:
                # The response from Tavily for errors is usually JSON
                error_details = e.response.json()
                error_message += f": {error_details}"
            except json.JSONDecodeError:
                # If the error response is not JSON, use the raw text
                error_message += f": {e.response.text}"
            raise Exception(error_message)
        except Exception as e:
            raise Exception(f"Tavily map failed: {str(e)}")
