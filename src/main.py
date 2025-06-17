import os
import re
import json
from agno.agent import Agent, Team
from agno.models.openai import OpenAIChat
from .tavily_toolkit import TavilyCrawlToolkit, TavilyExtractToolkit, TavilySearchToolkit

# Get API key
TAVILY_API_KEY = os.environ["TAVILY_API_KEY"]

# Setup Tavily toolkits
crawl_toolkit = TavilyCrawlToolkit(TAVILY_API_KEY)
extract_toolkit = TavilyExtractToolkit(TAVILY_API_KEY)
search_toolkit = TavilySearchToolkit(TAVILY_API_KEY)

# Agents
tavily_agent = Agent(
    name="Tavily Agent",
    role=(
        "You are a smart Tavily assistant. "
        "Choose between crawl, extract, or search tools based on the input. "
        "Always return valid JSON with the tool output. No explanations."
    ),
    model=OpenAIChat("gpt-4o"),
    tools=[crawl_toolkit, extract_toolkit, search_toolkit],
)

flashcard_agent = Agent(
    name="Flashcard Agent",
    role=(
        "You are a flashcard generator. "
        "Given extracted content, generate 5-10 flashcards as JSON: "
        '{"flashcards": [{"question": "...", "answer": "..."}]}'
        "No explanations or markdown. Only valid JSON."
    ),
    model=OpenAIChat("gpt-4o"),
)

# Team
tavily_flashcard_team = Team(
    name="Tavily Flashcard Team",
    mode="coordinate",
    model=OpenAIChat("gpt-4o"),
    members=[tavily_agent, flashcard_agent],
    show_members_responses=True,
    instructions=[
        "If input looks like a search query, Tavily Agent handles it.",
        "If input is a URL, Tavily Agent decides whether to crawl or extract.",
        "If extracted content is available, Flashcard Agent generates flashcards.",
        "Coordinate so flashcards are generated only after valid content extraction.",
        "Return final JSON with either a 'result' or 'flashcards' key.",
        "No markdown, explanations, or extra text — only valid JSON."
    ],
    success_criteria="""
    - Tavily Agent selects the correct tool and returns valid JSON.
    - Flashcard Agent produces valid flashcard JSON when required.
    - Final output is valid JSON with 'result' or 'flashcards'.
    """
)

# Helper
def is_valid_url(url):
    return re.match(r"^https?://", url) or re.match(r"^[\w\.-]+\.[a-z]{2,}", url)

# Main handler
def main(context):
    try:
        body = json.loads(context.req.body or "{}")
        user_input = body.get("input")

        if not user_input:
            return context.res.json({"error": "Missing 'input' field"}, 400)

        # Normalize URL if needed
        if is_valid_url(user_input) and not user_input.startswith(("http://", "https://")):
            user_input = "https://" + user_input

        # Build task
        task = f"""
        Input: {user_input}

        GOAL:
        - Tavily Agent decides how to process input (crawl/extract/search).
        - If extract succeeds and content is found, Flashcard Agent generates flashcards.
        - Final JSON must have either 'result' or 'flashcards'.
        """

        result = tavily_flashcard_team.run(task)
        raw_output = result.content.strip()

        # Clean up any code fences (just in case)
        cleaned_output = re.sub(r"^```json|^```|```$", "", raw_output, flags=re.MULTILINE).strip()
        context.log(f"Team raw output: {cleaned_output}")

        # Parse and return
        response_data = json.loads(cleaned_output)
        return context.res.json({
            "status": "success",
            "output": response_data
        })

    except json.JSONDecodeError as e:
        context.error(f"JSON decode failed: {str(e)}")
        return context.res.json({
            "error": "Invalid JSON returned by team",
            "details": str(e)
        }, 500)

    except Exception as e:
        context.error(f"General error: {str(e)}")
        return context.res.json({
            "error": str(e),
            "type": "general_error"
        }, 500)
