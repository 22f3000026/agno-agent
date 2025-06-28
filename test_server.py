#!/usr/bin/env python3
"""
Test script to verify server connectivity and CORS configuration
"""

import requests
import json

def test_server_health(base_url):
    """Test if server is responding"""
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        print(f"✅ Health check: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Server status: {data.get('status')}")
            print(f"   CORS origins: {data.get('cors_origins')}")
        return response.status_code == 200
    except requests.exceptions.RequestException as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_cors_preflight(base_url):
    """Test CORS preflight request"""
    try:
        headers = {
            'Origin': 'https://100agent-iota.vercel.app',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type'
        }
        response = requests.options(f"{base_url}/generate-notes", headers=headers, timeout=10)
        print(f"✅ CORS preflight: {response.status_code}")
        
        cors_headers = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
        }
        print(f"   CORS headers: {cors_headers}")
        return response.status_code == 200
    except requests.exceptions.RequestException as e:
        print(f"❌ CORS preflight failed: {e}")
        return False

def test_generate_notes(base_url):
    """Test the generate-notes endpoint"""
    try:
        headers = {
            'Content-Type': 'application/json',
            'Origin': 'https://100agent-iota.vercel.app'
        }
        data = {
            'url': 'https://example.com'
        }
        response = requests.post(f"{base_url}/generate-notes", 
                               headers=headers, 
                               json=data, 
                               timeout=30)
        print(f"✅ Generate notes: {response.status_code}")
        if response.status_code == 200:
            print("   ✅ Endpoint working correctly")
        else:
            print(f"   ❌ Error: {response.text[:200]}")
        return response.status_code == 200
    except requests.exceptions.RequestException as e:
        print(f"❌ Generate notes failed: {e}")
        return False

def main():
    # Test URLs
    test_urls = [
        "https://prospace-4d2a452088b6.herokuapp.com",
        "http://localhost:5000",  # Local development
    ]
    
    print("🔍 Testing server connectivity and CORS configuration...\n")
    
    for url in test_urls:
        print(f"🌐 Testing: {url}")
        print("-" * 50)
        
        # Test health
        health_ok = test_server_health(url)
        
        if health_ok:
            # Test CORS preflight
            cors_ok = test_cors_preflight(url)
            
            # Test actual endpoint
            if cors_ok:
                notes_ok = test_generate_notes(url)
            else:
                print("⚠️  Skipping endpoint test due to CORS issues")
                notes_ok = False
        else:
            print("⚠️  Server not responding, skipping other tests")
            cors_ok = False
            notes_ok = False
        
        print(f"\n📊 Results for {url}:")
        print(f"   Health: {'✅' if health_ok else '❌'}")
        print(f"   CORS: {'✅' if cors_ok else '❌'}")
        print(f"   Endpoint: {'✅' if notes_ok else '❌'}")
        print("\n" + "="*60 + "\n")

if __name__ == "__main__":
    main() 