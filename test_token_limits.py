#!/usr/bin/env python3
"""
Test script to verify token limit handling
"""

import requests
import json

# Test server URL (adjust as needed)
BASE_URL = "http://localhost:5000"

def test_token_usage_check():
    """Test the token usage check endpoint"""
    print("Testing token usage check...")
    
    # Test with short content
    short_content = "This is a short test."
    response = requests.post(f"{BASE_URL}/check-token-usage", 
                           json={"content": short_content})
    print(f"Short content response: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"  Tokens: {data['data']['estimated_tokens']}")
        print(f"  Guidance: {data['data']['guidance']}")
    
    # Test with long content
    long_content = "This is a very long content. " * 1000
    response = requests.post(f"{BASE_URL}/check-token-usage", 
                           json={"content": long_content})
    print(f"Long content response: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"  Tokens: {data['data']['estimated_tokens']}")
        print(f"  Guidance: {data['data']['guidance']}")

def test_audiobook_generation():
    """Test audiobook generation with different topic lengths"""
    print("\nTesting audiobook generation...")
    
    # Test with short topic
    short_topic = "Python basics"
    response = requests.post(f"{BASE_URL}/audiobook-to-audio", 
                           json={
                               "topic": short_topic,
                               "style": "Educational",
                               "duration": "1 minutes"
                           })
    print(f"Short topic response: {response.status_code}")
    if response.status_code != 200:
        print(f"  Error: {response.json()}")
    
    # Test with very long topic (should fail)
    long_topic = "This is a very long topic that should exceed the token limits. " * 100
    response = requests.post(f"{BASE_URL}/audiobook-to-audio", 
                           json={
                               "topic": long_topic,
                               "style": "Educational", 
                               "duration": "1 minutes"
                           })
    print(f"Long topic response: {response.status_code}")
    if response.status_code != 200:
        print(f"  Expected error: {response.json()}")

def test_storyboard_generation():
    """Test storyboard generation with different description lengths"""
    print("\nTesting storyboard generation...")
    
    # Test with short description
    short_desc = "A simple educational storyboard about science"
    response = requests.post(f"{BASE_URL}/generate-storyboards", 
                           json={
                               "description": short_desc,
                               "image_type": "Educational",
                               "number_of_boards": 2
                           })
    print(f"Short description response: {response.status_code}")
    if response.status_code != 200:
        print(f"  Error: {response.json()}")
    
    # Test with very long description (should fail)
    long_desc = "This is a very long description that should exceed the token limits. " * 200
    response = requests.post(f"{BASE_URL}/generate-storyboards", 
                           json={
                               "description": long_desc,
                               "image_type": "Educational",
                               "number_of_boards": 2
                           })
    print(f"Long description response: {response.status_code}")
    if response.status_code != 200:
        print(f"  Expected error: {response.json()}")

if __name__ == "__main__":
    print("Testing token limit handling...")
    try:
        test_token_usage_check()
        test_audiobook_generation()
        test_storyboard_generation()
        print("\nAll tests completed!")
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to server. Make sure it's running on localhost:5000")
    except Exception as e:
        print(f"Error during testing: {e}") 