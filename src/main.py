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

def clean_json_string(s):
    # Remove markdown code block markers
    s = re.sub(r'^```json|^```|```$', '', s, flags=re.MULTILINE).strip()
    # Replace single quotes with double quotes (only for keys and string values)
    s = re.sub(r"'([^']*)':", r'"\1":', s)
    s = re.sub(r":\s*'([^']*)'", r':"\1"', s)
    # Try to extract a JSON object using regex
    match = re.search(r'(\{.*\})', s, re.DOTALL)
    if match:
        return match.group(1)
    return s

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

        result = asyncio.run(tavily_agent.run(task))
        raw_output = result.content.strip()
        context.log(f"Agent raw result: {raw_output}")
        cleaned_output = clean_json_string(raw_output)
        context.log(f"Cleaned output: {cleaned_output}")
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

