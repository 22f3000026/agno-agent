import os
import re
import json
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from .tavily_toolkit import TavilyCrawlToolkit, TavilyExtractToolkit, TavilySearchToolkit

TAVILY_API_KEY = os.environ["TAVILY_API_KEY"]

# Setup toolkits
crawl_toolkit = TavilyCrawlToolkit(TAVILY_API_KEY)
extract_toolkit = TavilyExtractToolkit(TAVILY_API_KEY)
search_toolkit = TavilySearchToolkit(TAVILY_API_KEY)

# Setup agents
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

flashcard_agent = Agent(
    name="Flashcard Agent",
    role=(
        "You are a flashcard generator. "
        "Given extracted content, create a list of flashcards. "
        "Each flashcard is a JSON object with 'question' and 'answer' fields. "
        "Return a JSON object with a 'flashcards' array."
    ),
    model=OpenAIChat(id="gpt-4o"),
)

def generate_flashcards(extracted_content: str, context):
    # Ask GPT to create flashcards
    task = f"""
    Extracted content:
    {extracted_content}

    INSTRUCTIONS:
    - Generate 5-10 flashcards based on this content.
    - Each flashcard must have a 'question' and 'answer'.
    - Return as JSON: {{"flashcards": [{{"question": "...", "answer": "..."}}]}}
    - Do not include explanations or markdown code blocks.
    """

    result = flashcard_agent.run(task)
    raw_output = result.content.strip()
    context.log(f"Flashcard agent raw result: {raw_output}")

    cleaned_output = re.sub(r"^```json|^```|```$", "", raw_output, flags=re.MULTILINE).strip()

    try:
        flashcards = json.loads(cleaned_output)
        return flashcards
    except json.JSONDecodeError as e:
        context.error(f"Flashcard JSON decode failed: {str(e)} - Content: {cleaned_output}")
        return {"error": "Invalid flashcard JSON", "raw": cleaned_output}

def main(context):
    try:
        body = json.loads(context.req.body or "{}")
        user_input = body.get("input")
        mode = body.get("mode", "default")  # mode = default | flashcard

        if not user_input:
            return context.res.json({"error": "Missing 'input' field"}, 400)
    
    if mode == "flashcard":
        if not is_valid_url(user_input):
            return context.res.json({
                "error": "Flashcard mode requires a valid URL."
            }, 400)
    
        # Ensure https
        if not user_input.startswith(('http://', 'https://')):
            user_input = 'https://' + user_input
    
        context.log(f"Running extract for flashcard mode on: {user_input}")
        try:
            extracted_json_str = extract_toolkit.extract_data([user_input])
            extracted_data = json.loads(extracted_json_str)
            extracted_content = extracted_data.get("content", "")
    
            if not extracted_content:
                return context.res.json({
                    "error": "No content extracted from URL"
                }, 500)
    
            flashcards = generate_flashcards(extracted_content, context)
            return context.res.json({
                "status": "success",
                "flashcards": flashcards
            })

    except Exception as e:
        error_msg = str(e)
        context.error(f"Flashcard mode failed: {error_msg}")
        return context.res.json({
            "error": error_msg,
            "type": "flashcard_error"
        }, 500)


        else:
            # Default tavily agent logic
            task = f"""
            Input from user: {user_input}

            INSTRUCTIONS:
            - If input is a plain URL, use the crawl tool.
            - If input asks to extract details from a URL, use the extract tool.
            - If input looks like a search query, use the search tool.
            - Return only a valid JSON object (no stringified JSON, no markdown, no explanation).
            - Format keys and strings using double quotes as per JSON spec.
            """

            result = tavily_agent.run(task)
            raw_output = result.content.strip()
            context.log(f"Agent raw result: {raw_output}")

            cleaned_output = re.sub(r"^```json|^```|```$", "", raw_output, flags=re.MULTILINE).strip()

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
        context.error(f"General exception: {str(e)}")
        return context.res.json({
            "error": str(e),
            "type": "general_error"
        }, 500)
