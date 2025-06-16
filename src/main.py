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
        - Return only a valid JSON object (no stringified JSON, no markdown, no explanation).
        - Format keys and strings using double quotes as per JSON spec.
        - Example: {{"foo": "bar"}}
        """

        async def run_agent():
            return await tavily_agent.run(task)

        result = asyncio.create_task(run_agent())
        raw_output = result.result().content.strip()
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
        context.error(f"Exception: {str(e)}")
        return context.res.json({"error": str(e)}, 500)

    except Exception as e:
        context.error(f"Exception: {str(e)}")
        return context.res.json({"error": str(e)}, 500)

