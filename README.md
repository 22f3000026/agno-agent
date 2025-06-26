# ⚡ Python Starter Function

A simple starter function. Edit `src/main.py` to get started and create something awesome! 🚀

## 🧰 Usage

### GET /ping

- Returns a "Pong" message.

**Response**

Sample `200` Response:

```text
Pong
```

### GET, POST, PUT, PATCH, DELETE /

- Returns a "Learn More" JSON response.

**Response**

Sample `200` Response:

```json
{
  "motto": "Build like a team of hundreds_",
  "learn": "https://appwrite.io/docs",
  "connect": "https://appwrite.io/discord",
  "getInspired": "https://builtwith.appwrite.io"
}
```

### POST /generate-storyboards

- Generates storyboards with images and supporting text based on user description.

**Request Body**

```json
{
  "description": "A journey through the solar system exploring each planet",
  "image_type": "Educational",
  "number_of_boards": 3,
  "art_style": "Studio Ghibli style"
}
```

**Parameters:**
- `description` (required): The main description/prompt for the storyboard
- `image_type` (required): Type of storyboard - "Educational", "Marketing", "Entertainment", or "Technical"
- `number_of_boards` (required): Number of storyboards to generate (1-10)
- `art_style` (optional): Specify a custom art style (e.g., "Pixar style", "cyberpunk aesthetic")

**Response**

Sample `200` Response:

```json
{
  "status": "success",
  "data": {
    "storyboards": [
      {
        "scene_number": 1,
        "image_prompt": "A detailed illustration of the Sun with planets orbiting around it",
        "supporting_text": "Our journey begins at the center of our solar system - the Sun. This massive star provides light and energy to all the planets that orbit around it.",
        "image_url": "https://oaidalleapiprodscus.blob.core.windows.net/private/...",
        "image_path": "src/storyboard_generations/storyboard_abc123.png",
        "image_filename": "storyboard_abc123.png"
      }
    ],
    "metadata": {
      "description": "A journey through the solar system exploring each planet",
      "image_type": "Educational",
      "number_of_boards": 3,
      "total_generated": 3
    }
  }
}
```

### POST /generate-notes

- Extracts content from a URL and generates detailed, structured notes.

**Request Body**

```json
{
  "url": "https://en.wikipedia.org/wiki/Artificial_intelligence"
}
```

**Parameters:**
- `url` (required): The URL to extract content from.

**Response**

Sample `200` Response:

```json
{
  "status": "success",
  "data": {
    "notes": {
      "title": "Artificial Intelligence",
      "key_points": [
        "AI is intelligence demonstrated by machines, as opposed to the natural intelligence displayed by humans and animals.",
        "Leading AI textbooks define the field as the study of 'intelligent agents'...",
        "The field was founded on the assumption that human intelligence can be so precisely described that a machine can be made to simulate it."
      ],
      "detailed_summary": "Artificial intelligence (AI) is a wide-ranging branch of computer science concerned with building smart machines capable of performing tasks that typically require human intelligence..."
    }
  }
}
```

### POST /tavily-search

- Performs a Tavily search and returns the results.

**Request Body**

```json
{
  "query": "What is the capital of France?"
}
```

**Parameters:**
- `query` (required): The search query.

**Response**

Sample `200` Response:

```json
{
  "status": "success",
  "data": {
    "answer": "The capital of France is Paris.",
    "results": [
      {
        "title": "Paris - Wikipedia",
        "url": "https://en.wikipedia.org/wiki/Paris",
        "content": "Paris is the capital and most populous city of France...",
        "score": 0.98,
        "raw_content": "..."
      }
    ]
  }
}
```

### POST /tavily-map

- Performs a site map using Tavily and returns the structure.

**Request Body**

```json
{
  "url": "docs.tavily.com",
  "max_depth": 1
}
```

**Parameters:**
- `url` (required): The URL of the site to map.
- `max_depth` (optional): The maximum depth to crawl. Default is 1.

**Response**

A JSON object representing the site map.

### GET /storyboard-images/<filename>

- Serves generated storyboard images.

**Response**

Returns the image file with appropriate MIME type.

## ⚙️ Configuration

| Setting           | Value                             |
| ----------------- | --------------------------------- |
| Runtime           | Python (3.9)                      |
| Entrypoint        | `src/main.py`                     |
| Build Commands    | `pip install -r requirements.txt` |
| Permissions       | `any`                             |
| Timeout (Seconds) | 15                                |

## 🔒 Environment Variables

Required environment variables:
- `TAVILY_API_KEY`: API key for Tavily search/crawl functionality
- `ELEVENLABS_API_KEY`: API key for ElevenLabs text-to-speech
- `OPENAI_API_KEY`: API key for OpenAI (DALL-E 3 image generation)

## 🎨 Storyboard Types

The system supports four types of storyboards:

1. **Educational**: Informative content with clear explanations and learning objectives
2. **Marketing**: Promotional content with compelling visuals and messaging
3. **Entertainment**: Engaging storytelling with dramatic or humorous elements
4. **Technical**: Detailed technical content with diagrams and specifications

## 📐 Aspect Ratios

Storyboards are automatically generated in **1:1 square format** (1024x1024) to ensure:
- Consistent visual presentation across all scenes
- Uniform layout and composition
- Better visual flow and narrative coherence
- No need to specify aspect ratio - it's handled automatically

## 🎨 Art Style Consistency

Each storyboard type uses a consistent art style across all scenes. You can also provide your own custom style.

- **Educational**: Clean, professional illustration style with bright colors and clear composition
- **Marketing**: Modern, vibrant commercial art style with high contrast and engaging visuals  
- **Entertainment**: Dynamic, cinematic style with dramatic lighting and rich colors
- **Technical**: Precise, technical illustration style with neutral colors and detailed diagrams

This ensures visual continuity and creates a cohesive storyboard experience.

## 🚀 Testing

Run the test script to try the storyboard generation:

```bash
python test_storyboard.py
```

This will generate a sample storyboard about the solar system with 3 educational scenes in 1:1 square format with consistent art style.
