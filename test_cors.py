#!/usr/bin/env python3
"""
Simple CORS test script to verify the Flask server is properly configured
"""

import requests
import json

def test_cors_endpoint(base_url, endpoint="/health"):
    """Test a CORS endpoint"""
    url = f"{base_url}{endpoint}"
    
    # Test with different origins
    origins = [
        "https://100agent-iota.vercel.app",
        "https://100agent-96s7zmbag-akdeepankars-projects.vercel.app",
        "http://localhost:3000",
        "https://prospace-4d2a452088b6.herokuapp.com"
    ]
    
    print(f"Testing CORS for endpoint: {url}")
    print("=" * 50)
    
    for origin in origins:
        print(f"\nTesting with Origin: {origin}")
        
        headers = {
            "Origin": origin,
            "Content-Type": "application/json"
        }
        
        try:
            # Test OPTIONS request (preflight)
            response = requests.options(url, headers=headers)
            print(f"  OPTIONS Status: {response.status_code}")
            print(f"  Access-Control-Allow-Origin: {response.headers.get('Access-Control-Allow-Origin', 'NOT SET')}")
            print(f"  Access-Control-Allow-Methods: {response.headers.get('Access-Control-Allow-Methods', 'NOT SET')}")
            
            # Test GET request
            response = requests.get(url, headers=headers)
            print(f"  GET Status: {response.status_code}")
            print(f"  Access-Control-Allow-Origin: {response.headers.get('Access-Control-Allow-Origin', 'NOT SET')}")
            
        except Exception as e:
            print(f"  Error: {e}")

def test_flashcards_endpoint(base_url):
    """Test the flashcards endpoint specifically"""
    url = f"{base_url}/generate-flashcards"
    
    print(f"\nTesting flashcards endpoint: {url}")
    print("=" * 50)
    
    # Test with the problematic origin
    origin = "https://100agent-iota.vercel.app"
    headers = {
        "Origin": origin,
        "Content-Type": "application/json"
    }
    
    data = {
        "url": "https://example.com"
    }
    
    try:
        # Test OPTIONS request
        response = requests.options(url, headers=headers)
        print(f"OPTIONS Status: {response.status_code}")
        print(f"Access-Control-Allow-Origin: {response.headers.get('Access-Control-Allow-Origin', 'NOT SET')}")
        
        # Test POST request
        response = requests.post(url, headers=headers, json=data)
        print(f"POST Status: {response.status_code}")
        print(f"Access-Control-Allow-Origin: {response.headers.get('Access-Control-Allow-Origin', 'NOT SET')}")
        
        if response.status_code == 200:
            print("✅ CORS is working correctly!")
        else:
            print(f"❌ CORS issue: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Test with your Heroku URL
    base_url = "https://prospace-4d2a452088b6.herokuapp.com"
    
    print("CORS Test Script")
    print("=" * 50)
    
    # Test health endpoint
    test_cors_endpoint(base_url, "/health")
    
    # Test debug endpoint
    test_cors_endpoint(base_url, "/debug-cors")
    
    # Test flashcards endpoint
    test_flashcards_endpoint(base_url) 