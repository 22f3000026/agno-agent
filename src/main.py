import asyncio
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
        "You are a smart Tavily assistant. "
        "Decide between crawl, extract, or search based on user input. "
        "Return only the tool's JSON string output."
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

        INSTRUCTIONS:
        - If input is a plain URL, use the crawl tool.
        - If input asks to extract details from a URL, use the extract tool.
        - If input looks like a search query, use the search tool.
        - Return only the tool's JSON string output.
        - Ensure the response is a valid JSON string: use double quotes, no comments, no extra text.
        """
        
        result = asyncio.run(tavily_agent.run(task))
        raw_output = result.content.strip()
        context.log(f"Agent raw result: {raw_output}")

        # Just return the raw response *as a string*
        return context.res.json({
            "status": "success",
            "raw_response": raw_output
        })

    except Exception as e:
        context.error(f"Exception: {str(e)}")
        return context.res.json({"error": str(e)}, 500)

