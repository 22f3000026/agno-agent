import os
import sys
import uuid
import requests
import base64
from PIL import Image
import io
import re
import json
from dotenv import load_dotenv
from tavily_toolkit import TavilyCrawlToolkit, TavilyExtractToolkit, TavilySearchToolkit, TavilyMapToolkit
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from elabs_toolkit import ElevenLabsToolkit
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from agno.agent import Agent
from agno.team import Team
from agno.models.openai import OpenAIChat
from tavily_toolkit import TavilyCrawlToolkit, TavilyExtractToolkit, TavilySearchToolkit, TavilyMapToolkit
from elabs_toolkit import ElevenLabsToolkit


# Load environment variables from .env file
load_dotenv()

from flask import Flask
app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept"],
        "supports_credentials": True
    }
})


# Get API keys
TAVILY_API_KEY = os.environ["TAVILY_API_KEY"]
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

# Setup Tavily toolkits
crawl_toolkit = TavilyCrawlToolkit(TAVILY_API_KEY)
extract_toolkit = TavilyExtractToolkit(TAVILY_API_KEY)
search_toolkit = TavilySearchToolkit(TAVILY_API_KEY)
map_toolkit = TavilyMapToolkit(TAVILY_API_KEY)

# Create directories for storyboard images
os.makedirs("src/storyboard_generations", exist_ok=True)

# Agents
tavily_agent = Agent(
    name="Tavily Agent",
    role=(
        "You are a smart Tavily assistant. "
        "Choose between crawl, extract, or search tools based on the input. "
        "Use Search toolkit, if Input type is not URL"
        "Always return valid JSON with the tool output. No explanations."
    ),
    model=OpenAIChat("gpt-4o"),
    tools=[crawl_toolkit, extract_toolkit, search_toolkit],
)

@app.route('/')
def index():
    return 'Hello, Heroku!'

@app.route('/tavily-agent', methods=['POST', 'OPTIONS'])
def tavily_agent_endpoint():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json()
        if not data or not data.get('prompt'):
            return jsonify({
                "status": "error",
                "message": "'prompt' is required"
            }), 400
        prompt = data['prompt']
        result = tavily_agent.run(prompt)
        raw_output = result.content.strip()
        cleaned_output = re.sub(r"^```json|^```|```$", "", raw_output, flags=re.MULTILINE).strip()
        json_match = re.search(r'(\{.*\})', cleaned_output, re.DOTALL)
        if not json_match:
            return jsonify({
                "status": "error",
                "message": "No valid JSON found in response"
            }), 500
        json_str = json_match.group(1)
        response_data = json.loads(json_str)
        return jsonify({
            "status": "success",
            "data": response_data
        })
    except json.JSONDecodeError as e:
        return jsonify({
            "status": "error",
            "message": f"Invalid JSON returned by agent: {str(e)}"
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
