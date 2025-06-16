from agno.tools import Toolkit
from tavily import TavilyClient
import json
import time
import asyncio
from typing import Optional

class TavilyCrawlToolkit(Toolkit):
    def __init__(self, api_key: str, max_retries: int = 3, timeout: int = 30):
        super().__init__(name="tavily_crawl_toolkit")
        self.client = TavilyClient(api_key)
        self.max_retries = max_retries
        self.timeout = timeout
        self.register(self.crawl_page)

    async def crawl_page(self, url: str) -> str:
        """
        Crawl a URL using Tavily API and return the crawl data as JSON string.
        
        Args:
            url: The URL to crawl
            
        Returns:
            JSON string containing crawled data
        """
        for attempt in range(self.max_retries):
            try:
                if not url.startswith(('http://', 'https://')):
                    url = 'https://' + url
                response = await asyncio.to_thread(
                    self.client.crawl,
                    url=url,
                    timeout=self.timeout
                )
                return json.dumps(response)
            except Exception as e:
                if attempt == self.max_retries - 1:
                    raise Exception(f"Tavily crawl failed after {self.max_retries} attempts: {str(e)}")
                await asyncio.sleep(1)  # Wait before retrying


class TavilyExtractToolkit(Toolkit):
    def __init__(self, api_key: str, max_retries: int = 3, timeout: int = 30):
        super().__init__(name="tavily_extract_toolkit")
        self.client = TavilyClient(api_key)
        self.max_retries = max_retries
        self.timeout = timeout
        self.register(self.extract_data)

    async def extract_data(self, urls: str) -> str:
        """
        Extract data from a URL using Tavily API and return as JSON string.
        
        Args:
            urls: URL to extract data from
            
        Returns:
            JSON string containing extracted data
        """
        for attempt in range(self.max_retries):
            try:
                if not urls.startswith(('http://', 'https://')):
                    urls = 'https://' + urls
                response = await asyncio.to_thread(
                    self.client.extract,
                    urls=[urls],
                    timeout=self.timeout
                )
                return json.dumps(response)
            except Exception as e:
                if attempt == self.max_retries - 1:
                    raise Exception(f"Tavily extract failed after {self.max_retries} attempts: {str(e)}")
                await asyncio.sleep(1)  # Wait before retrying


class TavilySearchToolkit(Toolkit):
    def __init__(self, api_key: str, max_retries: int = 3, timeout: int = 30):
        super().__init__(name="tavily_search_toolkit")
        self.client = TavilyClient(api_key)
        self.max_retries = max_retries
        self.timeout = timeout
        self.register(self.search_query)

    async def search_query(self, query: str) -> str:
        """
        Perform a search using Tavily API and return search results as JSON string.
        
        Args:
            query: The search query string
            
        Returns:
            JSON string containing search results
        """
        for attempt in range(self.max_retries):
            try:
                if not query or not query.strip():
                    raise ValueError("Search query cannot be empty")
                response = await asyncio.to_thread(
                    self.client.search,
                    query=query.strip(),
                    timeout=self.timeout
                )
                return json.dumps(response)
            except Exception as e:
                if attempt == self.max_retries - 1:
                    raise Exception(f"Tavily search failed after {self.max_retries} attempts: {str(e)}")
                await asyncio.sleep(1)  # Wait before retrying
