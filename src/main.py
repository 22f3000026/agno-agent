from appwrite.client import Client
from appwrite.services.users import Users
from appwrite.exception import AppwriteException
import os
import json
import io
import sys

from agno.agent import Agent
from agno.models.openai import OpenAIChat

# Define your funny agent
funny_agent = Agent(
    name="Funny Agent",
    role="You always reply in a funny, witty, or silly way. Your job is to make people smile while still answering their question.",
    model=OpenAIChat(id="gpt-4o")
)

def main(context):
    # Setup Appwrite client
    client = (
        Client()
        .set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])
        .set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
        .set_key(context.req.headers["x-appwrite-key"])
    )

    users = Users(client)

    # Log users (this won't mix with agent output as it's before capture)
    try:
        response = users.list()
        context.log(f"Total users: {response['total']}")
    except AppwriteException as err:
        context.error(f"Could not list users: {repr(err)}")

    if context.req.path == "/ping":
        return context.res.text("Pong")

    # Parse JSON input
    try:
        body = json.loads(context.req.body or "{}")
        prompt = body.get("prompt")
        if not prompt:
            return context.res.json({"error": "Missing 'prompt' in request body"}, 400)
    except json.JSONDecodeError:
        return context.res.json({"error": "Invalid JSON in request body"}, 400)

    # Capture ONLY the funny agent's output
    try:
        buffer = io.StringIO()
        sys_stdout = sys.stdout
        sys.stdout = buffer

        funny_agent.print_response(prompt, stream=False)

        sys.stdout = sys_stdout
        response_text = buffer.getvalue().strip()

    except Exception as e:
        sys.stdout = sys_stdout
        context.error(f"Funny agent failed: {repr(e)}")
        return context.res.json({"error": "Funny agent failed", "details": str(e)}, 500)

    # Return clean JSON
    return context.res.json({
        "prompt": prompt,
        "response": response_text
    })
