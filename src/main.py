import os
import re
import json
from agno.agent import Agent
from agno.team import Team
from agno.models.openai import OpenAIChat
from .tavily_toolkit import TavilyCrawlToolkit, TavilyExtractToolkit, TavilySearchToolkit

TAVILY_API_KEY = os.environ["TAVILY_API_KEY"]

# Setup agent + toolkits
crawl_toolkit = TavilyCrawlToolkit(TAVILY_API_KEY)
extract_toolkit = TavilyExtractToolkit(TAVILY_API_KEY)
search_toolkit = TavilySearchToolkit(TAVILY_API_KEY)

tavily_agent = Agent(
    name="Tavily Agent",
    role=(
        "You are a smart Tavily assistant that helps users interact with web content in different ways. "
        "Your job is to analyze the user's input and select the most appropriate tool to handle their request. "
        "You must return ONLY the tool's JSON output without any additional text or explanation.\n\n"
    ),
    model=OpenAIChat(id="gpt-4o"),
    tools=[crawl_toolkit, extract_toolkit, search_toolkit],
    instructions="""
    TOOL SELECTION RULES:
    1. Use the CRAWL tool when:
       - Input is a single URL (e.g., 'https://example.com' or 'example.com')
       - User wants to get the full content of a webpage
       - Example: 'crawl https://example.com' or 'get content from example.com'

    2. Use the EXTRACT tool when:
       - Input contains multiple URLs
       - User wants to extract specific information from URLs
       - Example: 'extract data from https://example1.com and https://example2.com'
       - Example: 'get details from these sites: example1.com, example2.com'

    3. Use the SEARCH tool when:
       - Input is a search query or question
       - User wants to find information about a topic
       - Example: 'what is machine learning?' or 'find information about climate change'
       - Example: 'search for latest news about AI'

    OUTPUT FORMAT:
    - Return ONLY a valid JSON object
    - Use double quotes for all keys and string values
    - Do not include any markdown, explanations, or additional text
    - Example: {"url": "https://example.com"} for crawl
    - Example: {"urls": ["https://example1.com", "https://example2.com"]} for extract
    - Example: {"query": "machine learning basics"} for search
    """
)

flashcard_agent = Agent(
    name="FlashcardGenerator",
    role="Generates educational flashcards from web content",
    model=OpenAIChat(id="gpt-4o"),
    tools=[extract_toolkit],
    instructions="""
    FLASHCARD GENERATION PROTOCOL:

    1. CONTENT EXTRACTION & ORGANIZATION:
       - Use the extract tool to get content from URLs
       - Extract key concepts and main ideas from the content
       - Group related concepts together
       - Create a logical flow of information
       - Focus on important facts and relationships

    2. FLASHCARD STRUCTURE:
       Each flashcard must follow this exact format:
       ```
       # Front: [Clear, concise question or concept]
       
       ## Back
       ### Definition
       [Clear and concise definition or explanation]
       
       ### Key Points
       - [Point 1]
       - [Point 2]
       - [Point 3]
       
       ### Examples
       - [Example 1]
       - [Example 2]
       
       ### Additional Context
       [Any relevant context or connections to other concepts]
       ```

    3. QUALITY REQUIREMENTS:
       - Front must be a clear, specific question or concept
       - Back must contain comprehensive but concise information
       - Include real-world examples
       - Use bullet points for better readability
       - Maintain consistent formatting
       - Ensure each card is self-contained
       - Number each card (e.g., "Card 1:", "Card 2:", etc.)

    4. CONTENT GUIDELINES:
       - Use active voice
       - Keep language simple and clear
       - Include practical applications
       - Add relevant context
       - Connect related concepts
       - Use markdown formatting for structure

    5. OUTPUT FORMAT:
       - Each card must start with "Card X:" followed by the front
       - Front must be prefixed with "Front:"
       - Back must be prefixed with "Back:"
       - Use ### for subsections within the back
       - Use bullet points for lists
       - Separate cards with blank lines
       - Include at least 5-10 cards per topic
       - Ensure proper markdown formatting

    6. EXAMPLE FORMAT:
       ```
       Card 1:
       Front: What is photosynthesis?
       
       Back:
       ### Definition
       The process by which plants convert light energy into chemical energy
       
       ### Key Points
       - Occurs in chloroplasts
       - Requires sunlight, water, and CO2
       - Produces glucose and oxygen
       
       ### Examples
       - Green leaves in sunlight
       - Algae in water
       
       ### Additional Context
       Essential for life on Earth as it produces oxygen and food
       ```

    7. EXTRACTION WORKFLOW:
       - First, use the extract tool to get content from the provided URL(s)
       - Process the extracted content to identify key concepts
       - Generate flashcards based on the extracted information
       - Ensure all content is properly attributed to the source
       - Maintain the original context while creating flashcards
    """,
    show_tool_calls=True,
    markdown=True
)

# Coordinated Team for Content Processing
content_team = Team(
    name="ContentProcessingTeam",
    mode="route",
    model=OpenAIChat(id="gpt-4o"),
    members=[tavily_agent, flashcard_agent],
    description="Routes requests between Tavily content processing and flashcard generation based on user needs",
    instructions="""
    ROUTING WORKFLOW:

    1. REQUEST ANALYSIS:
       Route to Tavily Agent when:
       - Input is a single URL to crawl
       - Input contains multiple URLs to extract from
       - Input is a search query
       - User wants raw web content or search results
       Examples:
       - "crawl https://example.com"
       - "extract from https://site1.com and https://site2.com"
       - "search for machine learning basics"

       Route to Flashcard Agent when:
       - Input contains "flashcard" or "cards"
       - User wants to learn or study a topic
       - Input is educational content
       - User wants structured learning material
       Examples:
       - "create flashcards about photosynthesis"
       - "generate study cards from this URL: example.com"
       - "make flashcards about machine learning"

    2. ROUTING RULES:
       - If input contains URLs and "flashcard"/"cards" → Flashcard Agent
       - If input is a search query and "flashcard"/"cards" → Flashcard Agent
       - If input is just URLs or search → Tavily Agent
       - If input is unclear, ask for clarification

    3. RESPONSE HANDLING:
       - Tavily Agent: Return JSON response
       - Flashcard Agent: Return markdown-formatted cards
       - Maintain consistent error handling
       - Ensure proper formatting for each agent type
    """,
    success_criteria="""
    - Correct agent selected based on input
    - Appropriate response format maintained
    - Clear routing decisions
    - Proper error handling
    - User intent satisfied
    """,
    show_members_responses=True
)

def main(context):
    try:
        body = json.loads(context.req.body or "{}")
        user_input = body.get("input")
        request_type = body.get("request_type", "content")  # Default to content request
        
        if not user_input:
            return context.res.json({"error": "Missing 'input' field"}, 400)

        task = f"""
        Input from user: {user_input}
        Request type: {request_type}

        Process this input according to the coordination workflow and return the appropriate response.
        Remember to:
        - Follow the specific format for each request type
        - Ensure proper markdown formatting for flashcards
        - Return JSON for content-only requests
        - Validate all outputs before returning
        """

        try:
            result = content_team.run(task)
            raw_output = result.content.strip()
            context.log(f"Team raw result: {raw_output}")

            # Remove markdown code block markers if present
            cleaned_output = re.sub(r"^```json|^```|```$", "", raw_output, flags=re.MULTILINE).strip()
            context.log(f"Cleaned output: {cleaned_output}")

            # Try parsing if it's a JSON response
            if request_type == "content":
                try:
                    response_data = json.loads(cleaned_output)
                except json.JSONDecodeError as e:
                    context.error(f"JSON decode failed: {str(e)} - Content: {cleaned_output}")
                    return context.res.json({
                        "error": "Team returned invalid JSON",
                        "raw": cleaned_output
                    }, 500)
            else:
                response_data = cleaned_output

            return context.res.json({
                "status": "success",
                "result": response_data
            })

        except Exception as e:
            error_msg = str(e)
            context.error(f"Team execution failed: {error_msg}")
            return context.res.json({
                "error": error_msg,
                "type": "team_execution_error"
            }, 500)

    except Exception as e:
        context.error(f"General exception: {str(e)}")
        return context.res.json({
            "error": str(e),
            "type": "general_error"
        }, 500)

