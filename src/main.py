from appwrite.client import Client
from appwrite.services.users import Users
from appwrite.exception import AppwriteException
import os
import json
import io
import sys

from agno.agent import Agent
from agno.models.openai import OpenAIChat

# Create the funny agent
funny_agent = Agent(
    name="Funny Agent",
    role="You always reply in a funny, witty, or silly way. Your job is to make people smile while still answering their question.",
    model=OpenAIChat(id="gpt-4o")
)

def main(context):
    # Initialize Appwrite client (optional)
    client = (
        Client()
        .set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])
        .set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
        .set_key(context.req.headers["x-appwrite-key"])
    )

    users = Users(client)

    # Example Appwrite SDK usage (optional)
    try:
        response = users.list()
        context.log("Total users: " + str(response["total"]))
    except AppwriteException as err:
        context.error("Could not list users: " + repr(err))

    # Ping endpoint
    if context.req.path == "/ping":
        return context.res.text("Pong")

    # Parse input
    try:
        body = json.loads(context.req.body or "{}")
        prompt = body.get("prompt")
        if not prompt:
            return context.res.json({"error": "Missing 'prompt' in request body"}, 400)
    except json.JSONDecodeError:
        return context.res.json({"error": "Invalid JSON in request body"}, 400)

    # Capture printed response
    try:
        buffer = io.StringIO()
        sys_stdout = sys.stdout
        sys.stdout = buffer

        funny_agent.print_response(prompt, stream=False)

        sys.stdout = sys_stdout
        response_text = buffer.getvalue().strip()

    except Exception as e:
        sys.stdout = sys_stdout  # Ensure stdout is reset
        context.error("Funny agent failed: " + repr(e))
        return context.res.json({"error": "Funny agent failed", "details": str(e)}, 500)

    # Return as JSON
    return context.res.json({
        "prompt": prompt,
        "response": response_text
    })
