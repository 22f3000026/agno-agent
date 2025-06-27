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

@app.route('/')
def index():
    return 'Hello, Railway!'

