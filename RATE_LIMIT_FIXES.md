# Rate Limit and Token Limit Fixes

## Problem
The application was hitting OpenAI's rate limits with the error:
```
Request too large for gpt-4o in organization org-G... on tokens per min (TPM): Limit 30000, Requested 52326
```

This was happening because:
1. The audiobook generation was using a complex team that gathered external content via Tavily
2. Large content was being processed without token validation
3. No proper error handling for rate limit errors

## Solutions Implemented

### 1. Token Management Utilities
Added helper functions to manage token usage:
- `estimate_tokens(text)`: Rough token estimation (1 token ≈ 4 characters)
- `validate_token_limit(text, max_tokens=25000)`: Check if content is within limits
- `truncate_content(content, max_tokens=20000)`: Truncate content at sentence boundaries
- `handle_openai_rate_limit_error(error_message)`: Parse and handle rate limit errors

### 2. Safe Team Execution
Created `safe_team_run(team, task, max_tokens=25000)` function that:
- Validates task length before execution
- Handles rate limit errors gracefully
- Returns structured error responses

### 3. Simplified Audiobook Generation
- Created `simple_audiobook_agent` that doesn't gather external content
- Replaced complex `audiobook_team` with `simple_audiobook_team`
- Added topic length validation (max 1000 tokens)
- Added script length validation and truncation

### 4. Enhanced Error Handling
All endpoints now use `safe_team_run()` for consistent error handling:
- `/generate-flashcards`
- `/generate-summary` 
- `/generate-notes`
- `/generate-quiz`
- `/audiobook-to-audio`
- `/generate-storyboards`
- `/brainstorm`

### 5. New Token Usage Check Endpoint
Added `/check-token-usage` endpoint to help users:
- Check estimated token count for their content
- Get guidance on content length
- Understand rate limits

## Usage Examples

### Check Token Usage
```bash
curl -X POST http://localhost:5000/check-token-usage \
  -H "Content-Type: application/json" \
  -d '{"content": "Your content here"}'
```

### Generate Audiobook (with validation)
```bash
curl -X POST http://localhost:5000/audiobook-to-audio \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Python basics",
    "style": "Educational",
    "duration": "2 minutes"
  }'
```

### Generate Storyboards (with validation)
```bash
curl -X POST http://localhost:5000/generate-storyboards \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Educational storyboard about photosynthesis",
    "image_type": "Educational",
    "number_of_boards": 3
  }'
```

## Error Responses

### Token Limit Exceeded
```json
{
  "status": "error",
  "message": "Topic too long (1500 tokens). Please use a shorter topic.",
  "error_type": "token_limit"
}
```

### Rate Limit Exceeded
```json
{
  "status": "error",
  "message": "Content too long. Please try a shorter topic or reduce duration.",
  "error_type": "rate_limit"
}
```

## Testing

Run the test script to verify the fixes:
```bash
python test_token_limits.py
```

## Recommendations

1. **For Users**: Keep topics and descriptions concise (under 1000 tokens for topics, 2000 for descriptions)
2. **For Development**: Monitor token usage with the `/check-token-usage` endpoint
3. **For Production**: Consider implementing caching and request queuing for high-traffic scenarios

## Token Limits by Endpoint

| Endpoint | Input Limit | Processing Limit | Notes |
|----------|-------------|------------------|-------|
| `/audiobook-to-audio` | 1000 tokens | 15000 tokens | Topic validation + script truncation |
| `/generate-storyboards` | 2000 tokens | 25000 tokens | Description validation |
| `/generate-flashcards` | 25000 tokens | 25000 tokens | URL content processing |
| `/generate-summary` | 25000 tokens | 25000 tokens | URL content processing |
| `/generate-notes` | 25000 tokens | 25000 tokens | URL content processing |
| `/generate-quiz` | 25000 tokens | 25000 tokens | URL content processing |
 