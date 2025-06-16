from flask import Flask, request, jsonify
from tavily_toolkit import TavilyCrawlToolkit, TavilyExtractToolkit, TavilySearchToolkit
from agno.agent import Agent
from agno.models.openai import OpenAIChat
import os
import json

app = Flask(__name__)

# Initialize Tavily toolkits
tavily_crawl_toolkit = TavilyCrawlToolkit(TAVILY_API_KEY)
tavily_extract_toolkit = TavilyExtractToolkit(TAVILY_API_KEY)
tavily_search_toolkit = TavilySearchToolkit(TAVILY_API_KEY)

# Tavily agent
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

@app.route("/api/tavily", methods=["POST"])
def tavily_handler():
    data = request.get_json()

    if not data or "input" not in data:
        return jsonify({"error": "Missing 'input' field"}), 400

    try:
        task = f"""
        Input from user: {data['input']}

        INSTRUCTIONS:
        - If input is a plain URL, use the crawl tool.
        - If input asks to extract details from a URL, use the extract tool.
        - If input looks like a search query, use the search tool.
        - Return only the tool's JSON string output.
        """

        result = tavily_agent.run(task)

        # Attempt to parse output
        try:
            response_data = json.loads(result.content)
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid response format from agent"}), 500

        if isinstance(response_data, dict) and "error" in response_data:
            return jsonify(response_data), 400

        return jsonify({
            "status": "success",
            "result": response_data
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
