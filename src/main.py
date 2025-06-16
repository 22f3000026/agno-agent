import os
import re
import json
import asyncio
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from .tavily_toolkit import TavilyCrawlToolkit, TavilyExtractToolkit, TavilySearchToolkit
from agno.team import Team

TAVILY_API_KEY = os.environ["TAVILY_API_KEY"]

# Setup toolkits
crawl_toolkit = TavilyCrawlToolkit(TAVILY_API_KEY)
extract_toolkit = TavilyExtractToolkit(TAVILY_API_KEY)
search_toolkit = TavilySearchToolkit(TAVILY_API_KEY)

# Create specialized agents for each toolkit
crawl_agent = Agent(
    name="Tavily Crawl Agent",
    role=(
        "You are a specialized web crawler that helps users traverse websites like a graph starting from a base URL. "
        "Your job is to handle requests for crawling websites and following links to gather comprehensive content. "
        "You must return ONLY the tool's JSON output without any additional text or explanation."
    ),
    model=OpenAIChat(id="gpt-4o"),
    tools=[crawl_toolkit],
)

extract_agent = Agent(
    name="Tavily Extract Agent",
    role=(
        "You are a specialized data extractor that helps users get content from one or more specified URLs. "
        "Your job is to handle requests for extracting specific content from web pages without following links. "
        "You must return ONLY the tool's JSON output without any additional text or explanation."
    ),
    model=OpenAIChat(id="gpt-4o"),
    tools=[extract_toolkit],
)

search_agent = Agent(
    name="Tavily Search Agent",
    role=(
        "You are a specialized search assistant that helps users find information about topics. "
        "Your job is to handle search queries and questions about various subjects. "
        "You must return ONLY the tool's JSON output without any additional text or explanation."
    ),
    model=OpenAIChat(id="gpt-4o"),
    tools=[search_toolkit],
)

# Create the team with specialized agents
tavily_team = Team(
    name="Tavily Team",
    mode="route",
    model=OpenAIChat("gpt-4o"),
    members=[crawl_agent, extract_agent, search_agent],
    show_tool_calls=True,
    markdown=True,
    description="You are a smart router that directs web-related requests to the appropriate specialized agent.",
    instructions=[
        "Route the request based on these simple rules:",
        "1. If the input contains the word 'crawl', route to CRAWL agent",
        "2. If the input contains the word 'extract', route to EXTRACT agent",
        "3. For all other inputs, route to SEARCH agent",
        "",
        "OUTPUT FORMAT:",
        "- Return ONLY a valid JSON object",
        "- Use double quotes for all keys and string values",
        "- Do not include any markdown, explanations, or additional text",
        "- Example: {\"url\": \"https://example.com\"} for crawl",
        "- Example: {\"urls\": \"https://example1.com\"} for extract",
        "- Example: {\"query\": \"machine learning basics\"} for search",
    ],
    show_members_responses=True,
)

async def main(context):
    try:
        body = json.loads(context.req.body or "{}")
        user_input = body.get("input")
        if not user_input:
            return context.res.json({"error": "Missing 'input' field"}, 400)

        task = f"Input from user: {user_input}"

        try:
            result = await tavily_team.arun(task)
            raw_output = result.content.strip()
            context.log(f"Team raw result: {raw_output}")

            # Remove markdown code block markers if present
            cleaned_output = re.sub(r"^```json|^```|```$", "", raw_output, flags=re.MULTILINE).strip()
            context.log(f"Cleaned output: {cleaned_output}")

            # Try parsing
            try:
                response_data = json.loads(cleaned_output)
            except json.JSONDecodeError as e:
                context.error(f"JSON decode failed: {str(e)} - Content: {cleaned_output}")
                return context.res.json({
                    "error": "Team returned invalid JSON",
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

