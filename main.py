import os
import sys
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from agno.agent import Agent
from agno.team import Team
from agno.models.openai import OpenAIChat
from agno.tools.eleven_labs import ElevenLabsTools
from tavily_toolkit import TavilyCrawlToolkit, TavilyExtractToolkit, TavilySearchToolkit, TavilyMapToolkit
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from elabs_toolkit import ElevenLabsToolkit
from image_toolkit import ImageGenerationToolkit
import uuid
import requests
import base64
from PIL import Image
import io
import datetime
import openai  # Move openai import to top level

# Try to import Appwrite SDK
try:
    from appwrite.client import Client
    from appwrite.services.storage import Storage
    from appwrite.input_file import InputFile
    APPWRITE_AVAILABLE = True
except ImportError:
    APPWRITE_AVAILABLE = False
    print("Warning: Appwrite SDK not installed. Install with: pip install appwrite")

# Load environment variables from .env file
load_dotenv()

import re
import json
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from agno.agent import Agent
from agno.team import Team
from agno.models.openai import OpenAIChat
from agno.tools.eleven_labs import ElevenLabsTools
from tavily_toolkit import TavilyCrawlToolkit, TavilyExtractToolkit, TavilySearchToolkit, TavilyMapToolkit
from elabs_toolkit import ElevenLabsToolkit

app = Flask(__name__)

# More flexible CORS configuration
ALLOWED_ORIGINS = [
    'https://100agent-iota.vercel.app',
    'https://100agent-96s7zmbag-akdeepankars-projects.vercel.app',
    'http://localhost:3000',
    'https://prospace-4d2a452088b6.herokuapp.com',
    'https://agno-agent-1-production.up.railway.app'  # Add Railway URL if you're using it
]

# Add environment-based origins
if os.environ.get('FLASK_ENV') == 'development':
    ALLOWED_ORIGINS.extend([
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001'
    ])

# For development, allow all origins if needed
if os.environ.get('FLASK_ENV') == 'development' or os.environ.get('ALLOW_ALL_ORIGINS') == 'true':
    CORS(app, 
         origins="*",
         methods=["GET", "POST", "OPTIONS"],
         allow_headers=["Content-Type", "Accept", "Authorization"],
         supports_credentials=False)  # Set to False when using "*"
else:
    # Production CORS configuration
    CORS(app, 
         origins=ALLOWED_ORIGINS,
         methods=["GET", "POST", "OPTIONS"],
         allow_headers=["Content-Type", "Accept", "Authorization"],
         supports_credentials=True)

# Get API keys
TAVILY_API_KEY = os.environ["TAVILY_API_KEY"]
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

# Appwrite configuration
APPWRITE_ENDPOINT = os.environ.get("APPWRITE_ENDPOINT", "https://cloud.appwrite.io/v1")
APPWRITE_PROJECT_ID = os.environ.get("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.environ.get("APPWRITE_API_KEY")
APPWRITE_BUCKET_ID = os.environ.get("APPWRITE_BUCKET_ID", "audiobooks")

# Initialize Appwrite client
appwrite_client = None
appwrite_storage = None
if APPWRITE_AVAILABLE and APPWRITE_PROJECT_ID and APPWRITE_API_KEY:
    try:
        appwrite_client = Client()
        appwrite_client.set_endpoint(APPWRITE_ENDPOINT)
        appwrite_client.set_project(APPWRITE_PROJECT_ID)
        appwrite_client.set_key(APPWRITE_API_KEY)
        appwrite_storage = Storage(appwrite_client)
        print(f"Appwrite client initialized successfully for project: {APPWRITE_PROJECT_ID}")
    except Exception as e:
        print(f"Failed to initialize Appwrite client: {str(e)}")
        appwrite_client = None
        appwrite_storage = None
else:
    if not APPWRITE_AVAILABLE:
        print("Appwrite SDK not available")
    if not APPWRITE_PROJECT_ID:
        print("APPWRITE_PROJECT_ID not set")
    if not APPWRITE_API_KEY:
        print("APPWRITE_API_KEY not set")

# Setup Tavily toolkits
crawl_toolkit = TavilyCrawlToolkit(TAVILY_API_KEY)
extract_toolkit = TavilyExtractToolkit(TAVILY_API_KEY)
search_toolkit = TavilySearchToolkit(TAVILY_API_KEY)
map_toolkit = TavilyMapToolkit(TAVILY_API_KEY)

# Setup image generation toolkit
image_toolkit = ImageGenerationToolkit(OPENAI_API_KEY)

# Setup ElevenLabs toolkit
elabs_toolkit = ElevenLabsToolkit(ELEVENLABS_API_KEY)

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

summary_agent = Agent(
    name="Summary Agent",
    role=(
        "You are a content summarizer. "
        "Given extracted content, generate a concise summary as JSON: "
        '{"summary": "..."}'
        "The summary should be 2-3 paragraphs long and capture the main points. "
        "No explanations or markdown. Only valid JSON."
    ),
    model=OpenAIChat("gpt-4o"),
)

quiz_agent = Agent(
    name="Quiz Agent",
    role=(
        "You are a quiz generator. "
        "Given content and parameters, generate a quiz as JSON: "
        '{"quiz": {"title": "...", "description": "...", "questions": [{"question": "...", "options": ["...", "...", "...", "..."], "correct_answer": "..."}]}}'
        "Generate questions based on the specified difficulty level (easy/medium/hard). "
        "For easy questions, focus on basic facts and definitions. "
        "For medium questions, include some analysis and understanding. "
        "For hard questions, include complex concepts and critical thinking. "
        "No explanations or markdown. Only valid JSON."
    ),
    model=OpenAIChat("gpt-4o"),
)


audiobook_agent = Agent(
    name="Audiobook Agent",
    role=(
        "You are an audiobook script generator. "
        "Given a topic, storytelling style, and duration, generate a script for an audiobook. "
        "The script should be structured according to the requested style: "
        "- Educational: informative and structured\n"
        "- Conversational: casual and engaging\n"
        "- Storytelling: narrative and immersive\n"
        "- Interview: Q&A format\n"
        "The script must be the correct length for the requested duration (e.g., 5 minutes of spoken audio, not more or less). "
        "Always return valid JSON: {\"script\": \"...\"}. No explanations or markdown."
    ),
    model=OpenAIChat("gpt-4o"),
)

# Create a simpler audiobook agent that doesn't gather external content
simple_audiobook_agent = Agent(
    name="Simple Audiobook Agent",
    role=(
        "You are an audiobook script generator. "
        "Generate a script based on the given topic, style, and duration. "
        "Do NOT gather external information - create content based on your knowledge. "
        "The script should be structured according to the requested style: "
        "- Educational: informative and structured\n"
        "- Conversational: casual and engaging\n"
        "- Storytelling: narrative and immersive\n"
        "- Interview: Q&A format\n"
        "The script must be the correct length for the requested duration. "
        "Always return valid JSON: {\"script\": \"...\"}. No explanations or markdown."
    ),
    model=OpenAIChat("gpt-4o"),
)

# Storyboard Agents
storyboard_content_agent = Agent(
    name="Storyboard Content Agent",
    role=(
        "You are a storyboard creator. "
        "Given a topic and number of scenes, create simple storyboard content. "
        "Each storyboard should have: "
        "- A clear image prompt for generating a visual "
        "- Supporting text that describes the scene "
        "Always return valid JSON: {\"storyboards\": [{\"scene_number\": 1, \"image_prompt\": \"...\", \"supporting_text\": \"...\"}]}. "
        "No explanations or markdown. Only valid JSON."
    ),
    model=OpenAIChat("gpt-4o"),
)

image_agent = Agent(
    name="Image Generation Agent",
    role=(
        "You are an image generation specialist. "
        "Given an image prompt, generate a high-quality image using DALL-E 3. "
        "Return the image URL as a simple string. "
        "No JSON formatting, just the URL."
    ),
    model=OpenAIChat("gpt-4o"),
    tools=[image_toolkit],
)

note_agent = Agent(
    name="Note Agent",
    role=(
        "You are a note-taking specialist. "
        "Given extracted content, generate detailed and structured notes as JSON: "
        '{"notes": {"title": "...", "key_points": ["...", "..."], "detailed_summary": "..."}}'
        "The notes should be comprehensive, well-organized, and capture the most important information. "
        "Key points should be a list of bullet points. "
        "The detailed summary should be a few paragraphs. "
        "No explanations or markdown. Only valid JSON."
    ),
    model=OpenAIChat("gpt-4o"),
)

brainstorm_agent = Agent(
    name="Brainstorm Agent",
    role=(
        "You are a creative brainstorming assistant. "
        "Given a topic, problem, or prompt, generate a list of creative ideas, solutions, or approaches as JSON: "
        '{"ideas": ["...", "...", "..."]}'
        "Ideas should be diverse, actionable, and inspiring. "
        "No explanations or markdown. Only valid JSON."
    ),
    model=OpenAIChat("gpt-4o"),
)

# Teams
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
    success_criteria=(
        "- Tavily Agent selects the correct tool and returns valid JSON.\n"
        "- Flashcard Agent produces valid flashcard JSON when required.\n"
        "- Final output is valid JSON with 'result' or 'flashcards'."
    )
)

tavily_summary_team = Team(
    name="Tavily Summary Team",
    mode="coordinate",
    model=OpenAIChat("gpt-4o"),
    members=[tavily_agent, summary_agent],
    show_members_responses=True,
    instructions=[
        "If input is a URL, Tavily Agent extracts content.",
        "If extracted content is available, Summary Agent generates a summary.",
        "Coordinate so summary is generated only after valid content extraction.",
        "Return final JSON with the summary.",
        "No markdown, explanations, or extra text — only valid JSON."
    ],
    success_criteria="""
    - Tavily Agent successfully extracts content from the URL.
    - Summary Agent produces a concise summary of the content.
    - Final output is valid JSON with the summary.
    """
)

tavily_note_team = Team(
    name="Tavily Note Team",
    mode="coordinate",
    model=OpenAIChat("gpt-4o"),
    members=[tavily_agent, note_agent],
    show_members_responses=True,
    instructions=[
        "If input is a URL, Tavily Agent extracts content.",
        "If extracted content is available, Note Agent generates detailed notes.",
        "Coordinate so notes are generated only after valid content extraction.",
        "Return final JSON with the notes.",
        "No markdown, explanations, or extra text — only valid JSON."
    ],
    success_criteria="""
    - Tavily Agent successfully extracts content from the URL.
    - Note Agent produces detailed, structured notes in valid JSON format.
    - Final output is valid JSON with the notes.
    """
)

tavily_quiz_team = Team(
    name="Tavily Quiz Team",
    mode="coordinate",
    model=OpenAIChat("gpt-4o"),
    members=[tavily_agent, quiz_agent],
    show_members_responses=True,
    instructions=[
        "If input is a URL, Tavily Agent extracts content.",
        "If extracted content is available, Quiz Agent generates a quiz.",
        "Generate the specified number of questions at the specified difficulty level.",
        "Return final JSON with the quiz.",
        "No markdown, explanations, or extra text — only valid JSON."
    ],
    success_criteria="""
    - Tavily Agent successfully extracts content from the URL.
    - Quiz Agent produces a quiz with the correct number of questions.
    - Questions match the specified difficulty level.
    - Final output is valid JSON with the quiz.
    """,
    show_tool_calls=True
)

audiobook_team = Team(
    name="Audiobook Team",
    mode="coordinate",
    model=OpenAIChat("gpt-4o"),
    members=[tavily_agent, audiobook_agent],
    show_members_responses=True,
    instructions=[
        "Tavily Agent gathers information on the topic.",
        "Audiobook Agent generates a script in the requested style and duration.",
        "Audio Agent converts the script to audio.",
        "Return final JSON with the audio file path.",
        "No markdown, explanations, or extra text — only valid JSON."
    ],
    success_criteria="""
    - Tavily Agent gathers relevant content.
    - Audiobook Agent produces a script matching the topic, style, and duration.
    - Audio Agent generates audio from the script.
    - Final output is valid JSON with the audio file path.
    """
)

# Simple audiobook team that doesn't gather external content
simple_audiobook_team = Team(
    name="Simple Audiobook Team",
    mode="coordinate",
    model=OpenAIChat("gpt-4o"),
    members=[simple_audiobook_agent],
    show_members_responses=True,
    instructions=[
        "Generate an audiobook script based on the topic, style, and duration.",
        "Do not gather external information - create content based on knowledge.",
        "Return final JSON with the script.",
        "No markdown, explanations, or extra text — only valid JSON."
    ],
    success_criteria="""
    - Generate a script matching the topic, style, and duration.
    - Script is appropriate length for the requested duration.
    - Final output is valid JSON with the script.
    """
)

storyboard_team = Team(
    name="Storyboard Generation Team",
    mode="coordinate",
    model=OpenAIChat("gpt-4o"),
    members=[storyboard_content_agent],
    show_members_responses=True,
    instructions=[
        "Create {number_of_boards} storyboard scenes for the given topic.",
        "Each scene should have an image prompt and supporting text.",
        "Return final JSON with complete storyboard data.",
        "No markdown, explanations, or extra text — only valid JSON."
    ],
    success_criteria="""
    - Create the requested number of storyboard scenes.
    - Each storyboard has scene_number, image_prompt, and supporting_text.
    - Final output is valid JSON with complete storyboard data.
    """
)

# Helper
def is_valid_url(url):
    return re.match(r"^https?://", url) or re.match(r"^[\w\.-]+\.[a-z]{2,}", url)

def estimate_tokens(text):
    """
    Rough estimation of tokens (1 token ≈ 4 characters for English text)
    """
    return len(text) // 4

def validate_token_limit(text, max_tokens=25000):
    """
    Validate if text is within token limits
    """
    estimated_tokens = estimate_tokens(text)
    return estimated_tokens <= max_tokens, estimated_tokens

def truncate_content(content, max_tokens=20000):
    """
    Truncate content to fit within token limits
    """
    if not content:
        return content
    
    estimated_tokens = estimate_tokens(content)
    if estimated_tokens <= max_tokens:
        return content
    
    # Calculate how many characters we can keep
    max_chars = max_tokens * 4
    truncated = content[:max_chars]
    
    # Try to truncate at a sentence boundary
    last_period = truncated.rfind('.')
    last_exclamation = truncated.rfind('!')
    last_question = truncated.rfind('?')
    
    last_sentence_end = max(last_period, last_exclamation, last_question)
    if last_sentence_end > max_chars * 0.8:  # If we can find a sentence end in the last 20%
        truncated = truncated[:last_sentence_end + 1]
    
    return truncated + " [Content truncated due to length limits]"

def handle_openai_rate_limit_error(error_message):
    """
    Parse and handle OpenAI rate limit errors
    """
    if "Request too large" in error_message or "tokens per min" in error_message:
        return {
            "status": "error",
            "message": "Content too long. Please try a shorter topic or reduce duration.",
            "error_type": "rate_limit"
        }
    elif "rate limit" in error_message.lower():
        return {
            "status": "error", 
            "message": "Rate limit exceeded. Please wait a moment and try again.",
            "error_type": "rate_limit"
        }
    else:
        return {
            "status": "error",
            "message": "An error occurred while processing your request.",
            "error_type": "general"
        }

def safe_team_run(team, task, max_tokens=25000):
    """
    Safely run a team with error handling for rate limits
    """
    try:
        # Validate task length
        is_valid, token_count = validate_token_limit(task, max_tokens)
        if not is_valid:
            return None, {
                "status": "error",
                "message": f"Request too long ({token_count} tokens). Please use shorter input.",
                "error_type": "token_limit"
            }
        
        result = team.run(task)
        return result, None
        
    except Exception as e:
        error_str = str(e)
        app.logger.error(f"Team run error: {error_str}")
        
        # Handle OpenAI rate limit errors
        if "Request too large" in error_str or "tokens per min" in error_str:
            return None, handle_openai_rate_limit_error(error_str)
        elif "rate limit" in error_str.lower():
            return None, handle_openai_rate_limit_error(error_str)
        else:
            return None, {
                "status": "error",
                "message": f"Processing failed: {error_str}",
                "error_type": "general"
            }

def validate_storyboard_params(data):
    """
    Validate storyboard generation parameters
    """
    required_fields = ['description', 'number_of_boards']
    
    for field in required_fields:
        if field not in data:
            return False, f"Missing required field: {field}"
    
    # Validate number_of_boards
    try:
        num_boards = int(data['number_of_boards'])
        if num_boards < 1 or num_boards > 10:
            return False, "number_of_boards must be between 1 and 10"
    except (ValueError, TypeError):
        return False, "number_of_boards must be a valid integer"
    
    return True, "Valid"

# Add CORS preflight handler
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        origin = request.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
        else:
            response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Accept, Authorization"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

@app.after_request
def after_request(response):
    # Add CORS headers to all responses
    origin = request.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
    else:
        # For development or if origin is not in allowed list, allow all
        response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Accept, Authorization"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.route('/')
def index():
    return 'Hello, 100Agents!'

@app.route('/generate-flashcards', methods=['POST', 'OPTIONS'])
def generate_flashcards():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "status": "error",
                "message": "No JSON data provided"
            }), 400
            
        url = data.get('url')
        if not url:
            return jsonify({
                "status": "error",
                "message": "URL is required"
            }), 400

        # Validate URL
        if not is_valid_url(url):
            return jsonify({
                "status": "error",
                "message": "Invalid URL provided"
            }), 400

        # Normalize URL if needed
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        # Build task
        task = f"""
        Input URL: {url}

        GOAL:
        - Extract content from the provided URL
        - Generate flashcards from the extracted content
        - Return flashcards in valid JSON format
        """

        result, error = safe_team_run(tavily_flashcard_team, task)
        if error:
            return jsonify(error), 500
        
        raw_output = result.content.strip()

        # Clean up any code fences and extract JSON
        cleaned_output = re.sub(r"^```json|^```|```$", "", raw_output, flags=re.MULTILINE).strip()
        app.logger.info(f"Team raw output: {cleaned_output}")

        # Extract JSON part from the response
        json_match = re.search(r'(\{.*\})', cleaned_output, re.DOTALL)
        if not json_match:
            return jsonify({
                "status": "error",
                "message": "No valid JSON found in response"
            }), 500

        json_str = json_match.group(1)
        response_data = json.loads(json_str)
        
        # Format the response to match the expected structure
        return jsonify({
            "status": "success",
            "data": {
                "flashcards": response_data.get("flashcards", [])
            }
        })

    except json.JSONDecodeError as e:
        app.logger.error(f"JSON decode failed: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Invalid JSON returned by team"
        }), 500

    except Exception as e:
        app.logger.error(f"General error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/generate-summary', methods=['POST', 'OPTIONS'])
def generate_summary():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "status": "error",
                "message": "No JSON data provided"
            }), 400
            
        url = data.get('url')
        if not url:
            return jsonify({
                "status": "error",
                "message": "URL is required"
            }), 400

        # Validate URL
        if not is_valid_url(url):
            return jsonify({
                "status": "error",
                "message": "Invalid URL provided"
            }), 400

        # Normalize URL if needed
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        # Build task
        task = f"""
        Input URL: {url}

        GOAL:
        - Extract content from the provided URL
        - Generate a concise summary of the content
        - Return summary in valid JSON format
        """

        result, error = safe_team_run(tavily_summary_team, task)
        if error:
            return jsonify(error), 500
        
        raw_output = result.content.strip()

        # Clean up any code fences and extract JSON
        cleaned_output = re.sub(r"^```json|^```|```$", "", raw_output, flags=re.MULTILINE).strip()
        app.logger.info(f"Team raw output: {cleaned_output}")

        # Extract JSON part from the response
        json_match = re.search(r'(\{.*\})', cleaned_output, re.DOTALL)
        if not json_match:
            return jsonify({
                "status": "error",
                "message": "No valid JSON found in response"
            }), 500

        json_str = json_match.group(1)
        response_data = json.loads(json_str)
        
        # Format the response to match the expected structure
        return jsonify({
            "status": "success",
            "data": {
                "summary": response_data.get("summary", "")
            }
        })

    except json.JSONDecodeError as e:
        app.logger.error(f"JSON decode failed: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Invalid JSON returned by team"
        }), 500

    except Exception as e:
        app.logger.error(f"General error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/generate-notes', methods=['POST', 'OPTIONS'])
def generate_notes():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "status": "error",
                "message": "No JSON data provided"
            }), 400
            
        url = data.get('url')
        if not url:
            return jsonify({
                "status": "error",
                "message": "URL is required"
            }), 400

        # Validate URL
        if not is_valid_url(url):
            return jsonify({
                "status": "error",
                "message": "Invalid URL provided"
            }), 400

        # Normalize URL if needed
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        # Build task
        task = f"""
        Input URL: {url}

        GOAL:
        - Extract content from the provided URL.
        - Generate detailed, structured notes from the extracted content.
        - Return notes in valid JSON format.
        """

        result, error = safe_team_run(tavily_note_team, task)
        if error:
            return jsonify(error), 500
        
        raw_output = result.content.strip()

        # Clean up any code fences and extract JSON
        cleaned_output = re.sub(r"^```json|^```|```$", "", raw_output, flags=re.MULTILINE).strip()
        app.logger.info(f"Team raw output: {cleaned_output}")

        # Extract JSON part from the response
        json_match = re.search(r'(\{.*\})', cleaned_output, re.DOTALL)
        if not json_match:
            return jsonify({
                "status": "error",
                "message": "No valid JSON found in response"
            }), 500

        json_str = json_match.group(1)
        response_data = json.loads(json_str)
        
        # Format the response to match the expected structure
        return jsonify({
            "status": "success",
            "data": {
                "notes": response_data.get("notes", {})
            }
        })

    except json.JSONDecodeError as e:
        app.logger.error(f"JSON decode failed: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Invalid JSON returned by team"
        }), 500

    except Exception as e:
        app.logger.error(f"General error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
    

@app.route('/generate-quiz', methods=['POST', 'OPTIONS'])
def generate_quiz():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "status": "error",
                "message": "No JSON data provided"
            }), 400
            
        # Accept either url or query
        url = data.get('url')
        query = data.get('query')
        
        if not url and not query:
            return jsonify({
                "status": "error",
                "message": "Either 'url' or 'query' is required"
            }), 400

        num_questions = data.get('num_questions', 5)  # Default to 5 questions
        difficulty = data.get('difficulty', 'medium')  # Default to medium difficulty

        # Validate inputs
        if url and not is_valid_url(url):
            return jsonify({
                "status": "error",
                "message": "Invalid URL provided"
            }), 400

        if not isinstance(num_questions, int) or num_questions < 1 or num_questions > 20:
            return jsonify({
                "status": "error",
                "message": "Number of questions must be between 1 and 20"
            }), 400

        if difficulty not in ['easy', 'medium', 'hard']:
            return jsonify({
                "status": "error",
                "message": "Difficulty must be 'easy', 'medium', or 'hard'"
            }), 400

        # Normalize URL if needed
        if url and not url.startswith(("http://", "https://")):
            url = "https://" + url

        # Build task
        task = f"""
        Input: {url if url else query}
        Input Type: {"URL" if url else "Search Query"}
        Number of Questions: {num_questions}
        Difficulty Level: {difficulty}

        GOAL:
        - If URL is provided, extract content from it
        - If search query is provided, search for relevant content
        - Generate a quiz with {num_questions} questions at {difficulty} difficulty
        - Each question should have 4 options and one correct answer
        - Return quiz in valid JSON format
        """

        result = tavily_quiz_team.run(task)
        raw_output = result.content.strip()

        # Clean up any code fences and extract JSON
        cleaned_output = re.sub(r"^```json|^```|```$", "", raw_output, flags=re.MULTILINE).strip()
        app.logger.info(f"Team raw output: {cleaned_output}")

        # Extract JSON part from the response
        json_match = re.search(r'(\{.*\})', cleaned_output, re.DOTALL)
        if not json_match:
            return jsonify({
                "status": "error",
                "message": "No valid JSON found in response"
            }), 500

        json_str = json_match.group(1)
        response_data = json.loads(json_str)
        
        # Format the response to match the expected structure
        return jsonify({
            "status": "success",
            "data": {
                "quiz": response_data.get("quiz", {})
            }
        })

    except json.JSONDecodeError as e:
        app.logger.error(f"JSON decode failed: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Invalid JSON returned by team"
        }), 500

    except Exception as e:
        app.logger.error(f"General error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/generate-storyboards', methods=['POST', 'OPTIONS'])
def generate_storyboards():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "status": "error",
                "message": "No JSON data provided"
            }), 400
        
        # Validate parameters
        is_valid, error_message = validate_storyboard_params(data)
        if not is_valid:
            return jsonify({
                "status": "error",
                "message": error_message
            }), 400
        
        description = data.get('description')
        number_of_boards = int(data.get('number_of_boards'))
        skip_images = data.get('skip_images', False)  # New parameter
        
        # Limit number of boards for Heroku to prevent timeouts
        if number_of_boards > 5:
            return jsonify({
                "status": "error",
                "message": "Maximum 5 storyboards allowed to prevent timeout"
            }), 400

        # Build task for storyboard generation
        task = f"""
        Topic: {description}
        Number of Storyboards: {number_of_boards}
        
        Create {number_of_boards} storyboard scenes for this topic.
        Each scene should have an image prompt and supporting text.
        """
        
        # Run the storyboard team with timeout
        try:
            import threading
            import queue
            
            def run_storyboard_team():
                try:
                    result = storyboard_team.run(task)
                    result_queue.put(("success", result))
                except Exception as e:
                    result_queue.put(("error", str(e)))
            
            result_queue = queue.Queue()
            team_thread = threading.Thread(target=run_storyboard_team)
            team_thread.daemon = True
            team_thread.start()
            
            # Wait for result with timeout (25 seconds)
            try:
                result_type, result_data = result_queue.get(timeout=25)
                if result_type == "error":
                    raise Exception(result_data)
                raw_output = result_data.content.strip()
            except queue.Empty:
                return jsonify({
                    "status": "error",
                    "message": "Storyboard generation timed out. Please try with fewer boards."
                }), 408
                
        except Exception as e:
            app.logger.error(f"Storyboard team execution failed: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Storyboard generation failed: {str(e)}"
            }), 500
        
        # Clean up any code fences and extract JSON
        cleaned_output = re.sub(r"^```json|^```|```$", "", raw_output, flags=re.MULTILINE).strip()
        app.logger.info(f"Storyboard Team raw output: {cleaned_output}")

        # Extract JSON part from the response
        json_match = re.search(r'(\{.*\})', cleaned_output, re.DOTALL)
        if not json_match:
            return jsonify({
                "status": "error",
                "message": "No valid JSON found in response"
            }), 500

        json_str = json_match.group(1)
        response_data = json.loads(json_str)
        
        # Extract storyboards from response
        storyboards = response_data.get("storyboards", [])
        
        # Generate one comprehensive image for all storyboards
        final_storyboards = []
        comprehensive_prompt = ""
        comprehensive_image_url = None
        comprehensive_image_path = None
        comprehensive_filename = None
        
        # Build comprehensive image prompt from all storyboards
        for i, storyboard in enumerate(storyboards):
            image_prompt = storyboard.get("image_prompt", "")
            scene_number = storyboard.get("scene_number", i + 1)
            supporting_text = storyboard.get("supporting_text", "")
            
            if image_prompt:
                comprehensive_prompt += f"Scene {scene_number}: {image_prompt}. "
            
            # Create storyboard structure (text only, no individual images)
            final_storyboard = {
                "scene_number": scene_number,
                "image_prompt": image_prompt,
                "supporting_text": supporting_text
            }
            final_storyboards.append(final_storyboard)
        
        # Generate one comprehensive image if we have prompts and images aren't skipped
        if comprehensive_prompt and not skip_images:
            try:
                # Create grid layout based on number of boards
                if number_of_boards == 1:
                    layout_prompt = "single image"
                elif number_of_boards == 2:
                    layout_prompt = "2 panels arranged vertically (top and bottom)"
                elif number_of_boards == 3:
                    layout_prompt = "3 panels arranged in a triangle (top, bottom left, bottom right)"
                elif number_of_boards == 4:
                    layout_prompt = "4 panels arranged in a 2x2 grid (top left, top right, bottom left, bottom right)"
                elif number_of_boards == 5:
                    layout_prompt = "5 panels arranged in a 3x2 grid (top row: 2 panels, bottom row: 3 panels)"
                else:
                    layout_prompt = f"{number_of_boards} panels arranged in a grid layout"
                
                # Create a comprehensive prompt for all scenes
                full_prompt = f"Create a storyboard with {layout_prompt}. {comprehensive_prompt} Each panel should clearly show its respective scene. Use consistent art style across all panels."
                
                image_result = image_toolkit.generate_image(
                    prompt=full_prompt,
                    aspect_ratio="1:1",
                    size="1024x1024",
                    quality="standard"
                )
                
                # Store the comprehensive image details
                comprehensive_image_url = image_result["image_url"]
                comprehensive_image_path = image_result["image_path"]
                comprehensive_filename = image_result["filename"]
                    
            except Exception as img_error:
                app.logger.error(f"Comprehensive image generation failed: {str(img_error)}")
        
        # Format the response
        return jsonify({
            "status": "success",
            "data": {
                "image_url": comprehensive_image_url,
                "image_path": comprehensive_image_path,
                "filename": comprehensive_filename,
                "storyboards": final_storyboards,
                "metadata": {
                    "description": description,
                    "number_of_boards": number_of_boards,
                    "total_generated": len(final_storyboards),
                    "comprehensive_image": not skip_images and comprehensive_prompt != ""
                }
            }
        })
        
    except json.JSONDecodeError as e:
        app.logger.error(f"JSON decode failed: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Invalid JSON returned by team"
        }), 500
        
    except Exception as e:
        app.logger.error(f"General error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/storyboard-images/<filename>', methods=['GET'])
def serve_storyboard_image(filename):
    """
    Serve generated storyboard images
    """
    try:
        image_path = os.path.join("src/storyboard_generations", filename)
        if os.path.exists(image_path):
            return send_file(image_path, mimetype='image/png')
        else:
            return jsonify({
                "status": "error",
                "message": "Image not found"
            }), 404
    except Exception as e:
        app.logger.error(f"Error serving image: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/generate-image', methods=['POST', 'OPTIONS'])
def generate_image():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "status": "error",
                "message": "No JSON data provided"
            }), 400
        
        prompt = data.get('prompt')
        if not prompt:
            return jsonify({
                "status": "error",
                "message": "Prompt is required"
            }), 400
        
        # Optional parameters
        aspect_ratio = data.get('aspect_ratio', '1:1')
        size = data.get('size', '1024x1024')
        quality = data.get('quality', 'standard')
        
        # Generate image using the toolkit
        try:
            image_result = image_toolkit.generate_image(
                prompt=prompt,
                aspect_ratio=aspect_ratio,
                size=size,
                quality=quality
            )
            
            return jsonify({
                "status": "success",
                "data": image_result
            })
            
        except Exception as img_error:
            app.logger.error(f"Image generation failed: {str(img_error)}")
            return jsonify({
                "status": "error",
                "message": f"Image generation failed: {str(img_error)}"
            }), 500
        
    except Exception as e:
        app.logger.error(f"General error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/generated-images/<filename>', methods=['GET'])
def serve_generated_image(filename):
    """
    Serve generated images from the image toolkit
    """
    try:
        image_path = os.path.join("src/generated_images", filename)
        if os.path.exists(image_path):
            return send_file(image_path, mimetype='image/png')
        else:
            return jsonify({
                "status": "error",
                "message": "Image not found"
            }), 404
    except Exception as e:
        app.logger.error(f"Error serving image: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/audiobook-to-audio', methods=['POST', 'OPTIONS'])
def generate_audiobook():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "status": "error",
                "message": "No JSON data provided"
            }), 400
        
        # Extract parameters
        topic = data.get('topic')
        style = data.get('style', 'Educational')
        duration = data.get('duration', 30)
        voice_id = data.get('voice_id', 'JBFqnCBsd6RMkjVDRZzb')
        
        # Validate required parameters
        if not topic:
            return jsonify({
                "status": "error",
                "message": "Topic is required"
            }), 400
        
        # Validate style
        valid_styles = ['Educational', 'Conversational', 'Storytelling', 'Interview']
        if style not in valid_styles:
            return jsonify({
                "status": "error",
                "message": f"Style must be one of: {', '.join(valid_styles)}"
            }), 400
        
        # Validate duration (in seconds)
        if not isinstance(duration, int) or duration < 10 or duration > 300:
            return jsonify({
                "status": "error",
                "message": "Duration must be between 10 and 300 seconds"
            }), 400
        
        # Build task for audiobook generation
        task = f"""
        Topic: {topic}
        Style: {style}
        Duration: {duration} seconds
        
        Generate an audiobook script for {duration} seconds of audio content.
        The script should be appropriate for {duration} seconds of spoken audio.
        """
        
        # Run the simple audiobook team
        try:
            result = simple_audiobook_team.run(task)
            raw_output = result.content.strip()
        except Exception as e:
            app.logger.error(f"Audiobook team execution failed: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Audiobook generation failed: {str(e)}"
            }), 500
        
        # Clean up any code fences and extract JSON
        cleaned_output = re.sub(r"^```json|^```|```$", "", raw_output, flags=re.MULTILINE).strip()
        app.logger.info(f"Audiobook Team raw output: {cleaned_output}")
        
        # Extract JSON part from the response
        json_match = re.search(r'(\{.*\})', cleaned_output, re.DOTALL)
        if not json_match:
            return jsonify({
                "status": "error",
                "message": "No valid JSON found in response"
            }), 500
        
        json_str = json_match.group(1)
        response_data = json.loads(json_str)
        
        # Extract script from response
        script = response_data.get("script", "")
        
        if not script:
            return jsonify({
                "status": "error",
                "message": "No script generated"
            }), 500
        
        # Convert script to audio using ElevenLabs
        try:
            # Generate unique filename
            filename = f"audiobook_{uuid.uuid4().hex}.mp3"
            
            # Use ElevenLabs toolkit to generate audio
            audio_result = elabs_toolkit.text_to_speech(
                text=script,
                voice_id=voice_id,
                model_id="eleven_multilingual_v2",
                output_format="mp3_44100_128",
                filename=filename
            )
            
            # Save to Appwrite storage if available
            appwrite_file_id = None
            appwrite_file_url = None
            
            app.logger.info(f"Appwrite client available: {bool(appwrite_client)}")
            app.logger.info(f"Appwrite storage available: {bool(appwrite_storage)}")
            app.logger.info(f"APPWRITE_PROJECT_ID: {APPWRITE_PROJECT_ID}")
            app.logger.info(f"APPWRITE_BUCKET_ID: {APPWRITE_BUCKET_ID}")
            
            if appwrite_client and appwrite_storage:
                try:
                    app.logger.info(f"Attempting to upload file: {audio_result['audio_file']}")
                    
                    # Check if file exists
                    if not os.path.exists(audio_result["audio_file"]):
                        app.logger.error(f"Local file does not exist: {audio_result['audio_file']}")
                        raise Exception("Local audio file not found")
                    
                    # Get file size
                    file_size = os.path.getsize(audio_result["audio_file"])
                    app.logger.info(f"File size: {file_size} bytes")
                    
                    # Upload to Appwrite storage
                    appwrite_result = appwrite_storage.create_file(
                        bucket_id=APPWRITE_BUCKET_ID,
                        file_id=filename,
                        file=InputFile.from_path(audio_result["audio_file"])
                    )
                    
                    app.logger.info(f"Appwrite upload result: {appwrite_result}")
                    
                    appwrite_file_id = appwrite_result["$id"]
                    appwrite_file_url = f"{APPWRITE_ENDPOINT}/storage/buckets/{APPWRITE_BUCKET_ID}/files/{appwrite_file_id}/view?project={APPWRITE_PROJECT_ID}"
                    
                    app.logger.info(f"File uploaded to Appwrite: {appwrite_file_id}")
                    app.logger.info(f"Appwrite file URL: {appwrite_file_url}")
                    
                except Exception as appwrite_error:
                    app.logger.error(f"Failed to upload to Appwrite: {str(appwrite_error)}")
                    app.logger.error(f"Appwrite error type: {type(appwrite_error)}")
                    import traceback
                    app.logger.error(f"Appwrite error traceback: {traceback.format_exc()}")
            else:
                app.logger.warning("Appwrite client or storage not available")
                if not APPWRITE_PROJECT_ID:
                    app.logger.warning("APPWRITE_PROJECT_ID not set")
                if not APPWRITE_API_KEY:
                    app.logger.warning("APPWRITE_API_KEY not set")
            
            # Small delay to ensure audio is processed in history
            import time
            time.sleep(2)
            
            # Get the temporary audio URL from ElevenLabs history
            try:
                from elevenlabs import ElevenLabs
                
                # Debug: Check if API key is available
                app.logger.info(f"ELEVENLABS_API_KEY available: {bool(ELEVENLABS_API_KEY)}")
                app.logger.info(f"ELEVENLABS_API_KEY length: {len(ELEVENLABS_API_KEY) if ELEVENLABS_API_KEY else 0}")
                
                if not ELEVENLABS_API_KEY:
                    app.logger.warning("ELEVENLABS_API_KEY is not set, skipping history lookup")
                    # Use Appwrite URL if available, otherwise local file
                    audio_url = appwrite_file_url or f"/audio-files/{audio_result['audio_file_name']}"
                else:
                    # Use ElevenLabs client to get history
                    client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
                    history_data = client.history.list()
                    
                    app.logger.info(f"ElevenLabs history response: {history_data}")
                    
                    # Find the most recent audio for this script
                    audio_url = None
                    if history_data.get("history"):
                        # Get the most recent item (should be our just-generated audio)
                        latest_item = history_data["history"][0]
                        
                        app.logger.info(f"Latest history item: {latest_item}")
                        
                        # Look for audio_url in the history item
                        audio_url = latest_item.get("audio_url")
                        
                        if audio_url:
                            app.logger.info(f"Found ElevenLabs audio URL: {audio_url}")
                        else:
                            app.logger.error("No audio_url found in latest history item")
                            app.logger.error(f"Available fields: {list(latest_item.keys())}")
                            # Use Appwrite URL if available, otherwise local file
                            audio_url = appwrite_file_url or f"/audio-files/{audio_result['audio_file_name']}"
                    else:
                        app.logger.error("No history items found in response")
                        # Use Appwrite URL if available, otherwise local file
                        audio_url = appwrite_file_url or f"/audio-files/{audio_result['audio_file_name']}"
                
                # Format the response
                return jsonify({
                    "status": "success",
                    "data": {
                        "script": script,
                        "audio_url": audio_url,  # ElevenLabs URL, Appwrite URL, or local file URL
                        "appwrite_file_id": appwrite_file_id,
                        "appwrite_file_url": appwrite_file_url,
                        "audio_file": audio_result["audio_file"],  # Local file path (backup)
                        "audio_file_name": audio_result["audio_file_name"],
                        "topic": topic,
                        "style": style,
                        "duration": duration,
                        "voice_id": voice_id
                    }
                })
                
            except Exception as history_error:
                app.logger.error(f"Failed to get ElevenLabs history: {str(history_error)}")
                # Fallback to Appwrite URL or local file
                audio_url = appwrite_file_url or f"/audio-files/{audio_result['audio_file_name']}"
                return jsonify({
                    "status": "success",
                    "data": {
                        "script": script,
                        "audio_url": audio_url,
                        "appwrite_file_id": appwrite_file_id,
                        "appwrite_file_url": appwrite_file_url,
                        "audio_file": audio_result["audio_file"],
                        "audio_file_name": audio_result["audio_file_name"],
                        "topic": topic,
                        "style": style,
                        "duration": duration,
                        "voice_id": voice_id
                    }
                })
            
        except Exception as audio_error:
            app.logger.error(f"Audio generation failed: {str(audio_error)}")
            return jsonify({
                "status": "error",
                "message": f"Audio generation failed: {str(audio_error)}"
            }), 500
        
    except json.JSONDecodeError as e:
        app.logger.error(f"JSON decode failed: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Invalid JSON returned by team"
        }), 500
        
    except Exception as e:
        app.logger.error(f"General error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/audio-files/<filename>', methods=['GET'])
def serve_audio_file(filename):
    """
    Serve generated audio files
    """
    try:
        audio_path = os.path.join("audio_generations", filename)
        if os.path.exists(audio_path):
            return send_file(audio_path, mimetype='audio/mpeg')
        else:
            return jsonify({
                "status": "error",
                "message": "Audio file not found"
            }), 404
    except Exception as e:
        app.logger.error(f"Error serving audio file: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    # Enable debug mode for development
    app.debug = True
    
    # Set host to 0.0.0.0 to allow external connections
    # Set port to 5000 (default Flask port)
    app.run(host='0.0.0.0', port=5000, debug=True)