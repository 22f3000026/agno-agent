import os
import json
from agno.agent import Agent
from agno.team import Team
from agno.models.openai import OpenAIChat
from .tavily_toolkit import TavilyCrawlToolkit, TavilyExtractToolkit, TavilySearchToolkit

TAVILY_API_KEY = os.environ["TAVILY_API_KEY"]

# Setup agent + toolkits
crawl_toolkit = TavilyCrawlToolkit(TAVILY_API_KEY)
extract_toolkit = TavilyExtractToolkit(TAVILY_API_KEY)
search_toolkit = TavilySearchToolkit(TAVILY_API_KEY)

tavily_agent = Agent(
    name="Tavily Agent",
    role="Smart Tavily assistant for web content interaction",
    model=OpenAIChat(id="gpt-4o"),
    tools=[crawl_toolkit, extract_toolkit, search_toolkit],
    instructions="""
    TOOL SELECTION RULES:
    1. Use CRAWL for single URLs
    2. Use EXTRACT for multiple URLs
    3. Use SEARCH for queries
    4. Return only JSON output
    """
)

flashcard_agent = Agent(
    name="FlashcardGenerator",
    role="Generates educational flashcards from web content",
    model=OpenAIChat(id="gpt-4o"),
    tools=[extract_toolkit],
    instructions="""
    FLASHCARD PROTOCOL:
    1. Extract content using extract tool
    2. Create cards with:
       - Front: Clear question/concept
       - Back: Definition, key points, examples
    3. Use markdown formatting
    4. Number each card
    """,
    show_tool_calls=True,
    markdown=True
)

content_team = Team(
    name="ContentProcessingTeam",
    mode="route",
    model=OpenAIChat(id="gpt-4o"),
    members=[tavily_agent, flashcard_agent],
    description="Routes requests between Tavily content processing and flashcard generation",
    instructions="""
    ROUTING RULES:
    1. Route to Tavily Agent when:
       - User wants to crawl a website
       - User wants to extract data from URLs
       - User wants to search the web
       - User wants raw web content

    2. Route to Flashcard Agent when:
       - User mentions "flashcard" or "cards"
       - User wants to study or learn something
       - User wants educational content
       - User wants to create study material

    3. Response Format:
       - Tavily Agent: Return JSON
       - Flashcard Agent: Return markdown cards
    """,
    success_criteria="Correct agent selected, proper format, request handled",
    show_members_responses=True
)

async def main(context):
    try:
        # Quick input validation
        body = json.loads(context.req.body or "{}")
        user_input = body.get("input")
        if not user_input:
            return context.res.json({"error": "Missing 'input' field"}, 400)

        # Process request
        result = await content_team.arun(user_input)
        output = result.content.strip()

        # Handle response based on content type
        try:
            if "flashcard" in user_input.lower() or "card" in user_input.lower():
                return context.res.json({"status": "success", "result": output})
            else:
                return context.res.json({"status": "success", "result": json.loads(output)})
        except json.JSONDecodeError:
            return context.res.json({"status": "success", "result": output})

    except Exception as e:
        return context.res.json({"error": str(e)}, 500)

