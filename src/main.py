from appwrite.client import Client
from appwrite.services.users import Users
from appwrite.exception import AppwriteException
import os
import json
import io
import sys

from agno.agent import Agent
from agno.models.openai import OpenAIChat

from tavily_toolkit import TavilyCrawlToolkit, TavilyExtractToolkit, TavilySearchToolkit

# Initialize Tavily toolkits
tavily_crawl_toolkit = TavilyCrawlToolkit(TAVILY_API_KEY)
tavily_extract_toolkit = TavilyExtractToolkit(TAVILY_API_KEY)
tavily_search_toolkit = TavilySearchToolkit(TAVILY_API_KEY)

# Funny agent (as in your original code)
funny_agent = Agent(
    name="Funny Agent",
    role="You always reply in a funny, witty, or silly way. Your job is to make people smile while still answering their question.",
    model=OpenAIChat(id="gpt-4o")
)

# Tavily agent: decides which tavily tool to use
tavily_agent = Agent(
    name="Tavily Agent",
    role=(
        "You are a smart Tavily assistant. The user provides a URL or query. "
        "If it's a URL without extra question, crawl it. "
        "If asked to get specific info from URLs, extract it. "
        "If given a search query, search it. "
        "Choose the correct Tavily tool."
    ),
    model=OpenAIChat(id="gpt-4o"),
    toolkits=[tavily_crawl_toolkit, tavily_extract_toolkit, tavily_search_toolkit]
)

def main(context):
    client = (
        Client()
        .set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])
        .set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
        .set_key(context.req.headers["x-appwrite-key"])
    )
    users = Users(client)

    try:
        response = users.list()
        context.log(f"Total users: {response['total']}")
    except AppwriteException as err:
        context.error(f"Could not list users: {repr(err)}")

    if context.req.path == "/ping":
        return context.res.text("Pong")

    try:
        body = json.loads(context.req.body or "{}")
    except json.JSONDecodeError:
        return context.res.json({"error": "Invalid JSON in request body"}, 400)

    # Funny agent endpoint
    if context.req.path == "/funny":
        prompt = body.get("prompt")
        if not prompt:
            return context.res.json({"error": "Missing 'prompt' in request body"}, 400)
        return run_agent(funny_agent, prompt, context)

    # Tavily agent endpoint
    if context.req.path == "/tavily":
        user_input = body.get("input")
        if not user_input:
            return context.res.json({"error": "Missing 'input' (URL or query) in request body"}, 400)
        return run_agent(tavily_agent, user_input, context)

    return context.res.json({"error": "Invalid endpoint"}, 404)

def run_agent(agent, prompt, context):
    try:
        buffer = io.StringIO()
        sys_stdout = sys.stdout
        sys.stdout = buffer

        agent.print_response(prompt, stream=False)

        sys.stdout = sys_stdout
        response_text = buffer.getvalue().strip()
        context.log(f"{agent.name} output: {response_text}")

        return context.res.json({"input": prompt, "response": response_text})
    except Exception as e:
        sys.stdout = sys_stdout
        context.error(f"{agent.name} failed: {repr(e)}")
        return context.res.json({"error": f"{agent.name} failed", "details": str(e)}, 500)
