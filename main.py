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
import uuid
import requests
import base64
from PIL import Image
import io
import datetime
import openai  # Move openai import to top level

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
        "You are a storyboard content creator. "
        "Given a refined prompt and scene breakdown, create detailed storyboard content with supporting text for each scene. "
        "Each storyboard should have: "
        "- A clear visual description for image generation "
        "- Supporting text that explains or narrates the scene "
        "- Appropriate tone and style for the storyboard type "
        "- CONSISTENT ART STYLE: All image prompts must use the same artistic style, color palette, and visual approach "
        "- COHERENT VISUAL NARRATIVE: Images should flow together as a unified story with consistent characters, settings, and visual elements "
        "Always return valid JSON: {\"storyboards\": [{\"scene_number\": 1, \"image_prompt\": \"...\", \"supporting_text\": \"...\"}]}. "
        "No explanations or markdown. Only valid JSON."
    ),
    model=OpenAIChat("gpt-4o"),
)

image_generation_agent = Agent(
    name="Image Generation Agent",
    role=(
        "You are an image generation specialist. "
        "Given image prompts, generate high-quality images using DALL-E 3. "
        "CRITICAL REQUIREMENTS: "
        "- All images must maintain the SAME ARTISTIC STYLE throughout the storyboard "
        "- Use consistent color palette, lighting, and visual approach "
        "- Ensure visual continuity between scenes "
        "- All images will be generated in 1:1 square format "
        "Always return valid JSON: {\"images\": [{\"scene_number\": 1, \"image_url\": \"...\", \"image_path\": \"...\"}]}. "
        "No explanations or markdown. Only valid JSON."
    ),
    model=OpenAIChat("gpt-4o"),
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
    members=[storyboard_content_agent],  # Remove image_generation_agent to avoid potential issues
    show_members_responses=True,
    instructions=[
        "Storyboard Content Agent creates detailed content with image prompts and supporting text.",
        "Create {number_of_boards} storyboard scenes with clear image prompts and supporting text.",
        "Return final JSON with complete storyboard data including image prompts and text.",
        "No markdown, explanations, or extra text — only valid JSON."
    ],
    success_criteria="""
    - Content Agent creates detailed storyboard content with clear image prompts.
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

def generate_image_with_dalle(prompt, aspect_ratio="1:1", size="1024x1024", art_style=None):
    """
    Generate image using DALL-E 3 API with consistent art style
    """
    try:
        # Check if OpenAI API key is available
        if not OPENAI_API_KEY:
            raise Exception("OpenAI API key is not configured")
        
        app.logger.info(f"Starting image generation with prompt: {prompt[:100]}...")
        
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        
        # Always use 1:1 ratio for storyboards
        dalle_size = "1024x1024"
        
        # Enhance prompt with art style consistency
        enhanced_prompt = prompt
        if art_style:
            enhanced_prompt = f"{prompt}, {art_style}"
        
        app.logger.info(f"Enhanced prompt: {enhanced_prompt[:100]}...")
        
        response = client.images.generate(
            model="dall-e-3",
            prompt=enhanced_prompt,
            size=dalle_size,
            quality="standard",
            n=1,
        )
        
        app.logger.info("DALL-E API call successful")
        
        image_url = response.data[0].url
        app.logger.info(f"Generated image URL: {image_url}")
        
        # Download and save the image
        app.logger.info("Downloading image...")
        image_response = requests.get(image_url)
        image_response.raise_for_status()
        
        # Generate unique filename
        filename = f"storyboard_{uuid.uuid4().hex}.png"
        filepath = os.path.join("src/storyboard_generations", filename)
        
        # Ensure directory exists
        os.makedirs("src/storyboard_generations", exist_ok=True)
        
        # Save image
        app.logger.info(f"Saving image to: {filepath}")
        with open(filepath, "wb") as f:
            f.write(image_response.content)
        
        app.logger.info("Image generation completed successfully")
        
        return {
            "image_url": image_url,
            "image_path": filepath,
            "filename": filename
        }
        
    except ImportError as e:
        app.logger.error(f"Import error: {str(e)}")
        raise Exception(f"OpenAI package not available: {str(e)}")
    except Exception as e:
        app.logger.error(f"Image generation error: {str(e)}")
        raise Exception(f"Image generation failed: {str(e)}")

def validate_storyboard_params(data):
    """
    Validate storyboard generation parameters
    """
    required_fields = ['description', 'image_type', 'number_of_boards']
    
    for field in required_fields:
        if field not in data:
            return False, f"Missing required field: {field}"
    
    # Validate image_type
    valid_types = ['Educational', 'Marketing', 'Entertainment', 'Technical']
    if data['image_type'] not in valid_types:
        return False, f"Invalid image_type. Must be one of: {', '.join(valid_types)}"
    
    # Validate number_of_boards
    try:
        num_boards = int(data['number_of_boards'])
        if num_boards < 1 or num_boards > 10:
            return False, "number_of_boards must be between 1 and 10"
    except (ValueError, TypeError):
        return False, "number_of_boards must be a valid integer"
    
    # Validate skip_images (optional boolean)
    if 'skip_images' in data and not isinstance(data['skip_images'], bool):
        return False, "skip_images must be a boolean value"
    
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
        image_type = data.get('image_type')
        number_of_boards = int(data.get('number_of_boards'))
        user_art_style = data.get('art_style')  # Optional art style

        # Add art style to task if provided
        art_style_prompt = f"Art Style: {user_art_style}" if user_art_style else ""

        # Build task for storyboard generation
        task = f"""
        User Description: {description}
        Storyboard Type: {image_type}
        Number of Storyboards: {number_of_boards}
        {art_style_prompt}
        
        CRITICAL REQUIREMENTS:
        - All images will be generated in 1:1 square format (1024x1024)
        - Maintain CONSISTENT ART STYLE across all storyboards
        - Use the same color palette, lighting, and visual approach
        - Ensure visual continuity and coherence between scenes
        - Create a unified visual narrative
        
        GOAL:
        - Create {number_of_boards} storyboard scenes with detailed content based on the user description
        - Generate supporting text for each storyboard
        - Create image prompts that maintain consistent art style and visual continuity
        - Ensure the content is appropriate for {image_type} storyboard type
        - Return complete storyboard data in valid JSON format
        """
        
        # Run the storyboard team
        try:
            result = storyboard_team.run(task)
            raw_output = result.content.strip()
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
        
        # Generate images for each storyboard
        final_storyboards = []
        
        # Determine art style for consistency
        if user_art_style:
            art_style = user_art_style
        else:
            art_styles = {
                'Educational': 'clean, professional illustration style, bright colors, clear composition',
                'Marketing': 'modern, vibrant, commercial art style, high contrast, engaging visuals',
                'Entertainment': 'dynamic, cinematic style, dramatic lighting, rich colors',
                'Technical': 'precise, technical illustration style, neutral colors, detailed diagrams'
            }
            art_style = art_styles.get(image_type, 'professional illustration style')
        
        # Check if image generation should be attempted
        skip_image_generation = data.get('skip_images', False)
        
        for storyboard in storyboards:
            try:
                image_prompt = storyboard.get("image_prompt", "")
                scene_number = storyboard.get("scene_number", 1)
                
                if image_prompt and not skip_image_generation:
                    # Generate image using DALL-E with consistent art style
                    try:
                        image_result = generate_image_with_dalle(
                            prompt=image_prompt,
                            aspect_ratio="1:1",
                            art_style=art_style
                        )
                        
                        final_storyboard = {
                            "scene_number": scene_number,
                            "image_prompt": image_prompt,
                            "supporting_text": storyboard.get("supporting_text", ""),
                            "image_url": image_result["image_url"],
                            "image_path": image_result["image_path"],
                            "image_filename": image_result["filename"],
                            "art_style": art_style
                        }
                    except Exception as img_error:
                        app.logger.error(f"Image generation failed for scene {scene_number}: {str(img_error)}")
                        # Fallback to storyboard without image
                        final_storyboard = {
                            "scene_number": scene_number,
                            "image_prompt": image_prompt,
                            "supporting_text": storyboard.get("supporting_text", ""),
                            "image_url": None,
                            "image_path": None,
                            "image_filename": None,
                            "art_style": art_style,
                            "error": f"Image generation failed: {str(img_error)}"
                        }
                else:
                    # Create storyboard without image
                    final_storyboard = {
                        "scene_number": scene_number,
                        "image_prompt": image_prompt,
                        "supporting_text": storyboard.get("supporting_text", ""),
                        "image_url": None,
                        "image_path": None,
                        "image_filename": None,
                        "art_style": art_style
                    }
                
                final_storyboards.append(final_storyboard)
                
            except Exception as e:
                app.logger.error(f"Storyboard processing failed for scene {scene_number}: {str(e)}")
                # Add storyboard without image if processing fails
                final_storyboard = {
                    "scene_number": scene_number,
                    "image_prompt": storyboard.get("image_prompt", ""),
                    "supporting_text": storyboard.get("supporting_text", ""),
                    "image_url": None,
                    "image_path": None,
                    "image_filename": None,
                    "art_style": art_style,
                    "error": f"Processing failed: {str(e)}"
                }
                final_storyboards.append(final_storyboard)
        
        # Format the response
        return jsonify({
            "status": "success",
            "data": {
                "storyboards": final_storyboards,
                "metadata": {
                    "description": description,
                    "image_type": image_type,
                    "number_of_boards": number_of_boards,
                    "total_generated": len(final_storyboards),
                    "art_style": art_style
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