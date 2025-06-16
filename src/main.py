import os
import re
import json
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from .tavily_toolkit import TavilyCrawlToolkit, TavilyExtractToolkit, TavilySearchToolkit

TAVILY_API_KEY = os.environ["TAVILY_API_KEY"]

# Setup agent + toolkits
crawl_toolkit = TavilyCrawlToolkit(TAVILY_API_KEY)
extract_toolkit = TavilyExtractToolkit(TAVILY_API_KEY)
search_toolkit = TavilySearchToolkit(TAVILY_API_KEY)

tavily_agent = Agent(
    name="Tavily Agent",
    role=(
        "You are a smart Tavily assistant that helps users interact with web content in different ways. "
        "Your job is to analyze the user's input and select the most appropriate tool to handle their request. "
        "You must return ONLY the tool's JSON output without any additional text or explanation."
    ),
    model=OpenAIChat(id="gpt-4o"),
    tools=[crawl_toolkit, extract_toolkit, search_toolkit],
)

def main(context):
    try:
        body = json.loads(context.req.body or "{}")
        user_input = body.get("input")
        if not user_input:
            return context.res.json({"error": "Missing 'input' field"}, 400)

        task = f"""
        Input from user: {user_input}

        TOOL SELECTION RULES:
        1. Use the CRAWL tool when:
           - Input is a single URL (e.g., "https://example.com" or "example.com")
           - User wants to get the full content of a webpage
           - Example: "crawl https://example.com" or "get content from example.com"

        2. Use the EXTRACT tool when:
           - Input contains multiple URLs
           - User wants to extract specific information from URLs
           - Example: "extract data from https://example1.com and https://example2.com"
           - Example: "get details from these sites: example1.com, example2.com"

        3. Use the SEARCH tool when:
           - Input is a search query or question
           - User wants to find information about a topic
           - Example: "what is machine learning?" or "find information about climate change"
           - Example: "search for latest news about AI"

        OUTPUT FORMAT:
        - Return ONLY a valid JSON object
        - Use double quotes for all keys and string values
        - Do not include any markdown, explanations, or additional text
        - Example: {{"url": "https://example.com"}} for crawl
        - Example: {{"urls": ["https://example1.com", "https://example2.com"]}} for extract
        - Example: {{"query": "machine learning basics"}} for search
        """

        try:
            result = tavily_agent.run(task)
            raw_output = result.content.strip()
            context.log(f"Agent raw result: {raw_output}")

            # Remove markdown code block markers if present
            cleaned_output = re.sub(r"^```json|^```|```$", "", raw_output, flags=re.MULTILINE).strip()
            context.log(f"Cleaned output: {cleaned_output}")

            # Try parsing
            try:
                response_data = json.loads(cleaned_output)
            except json.JSONDecodeError as e:
                context.error(f"JSON decode failed: {str(e)} - Content: {cleaned_output}")
                return context.res.json({
                    "error": "Agent returned invalid JSON",
                    "raw": cleaned_output
                }, 500)

            return context.res.json({
                "status": "success",
                "result": response_data
            })

        except Exception as e:
            error_msg = str(e)
            context.error(f"Tool execution failed: {error_msg}")
            return context.res.json({
                "error": error_msg,
                "type": "tool_execution_error"
            }, 500)

    except Exception as e:
        context.error(f"General exception: {str(e)}")
        return context.res.json({
            "error": str(e),
            "type": "general_error"
        }, 500)

