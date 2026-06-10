import sys
import os
from unittest.mock import patch, MagicMock

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.utils.llm_client import call_llm_json, robust_parse_json, FREE_MODELS

def test_robust_json_parsing():
    print("[TEST] Checking robust_parse_json helper...")
    # Markdown formatting
    raw_markdown = "```json\n{\"status\": \"ok\", \"items\": [1, 2]}\n```"
    assert robust_parse_json(raw_markdown) == {"status": "ok", "items": [1, 2]}
    
    # Text prefix and suffix
    raw_prefix = "Sure, here is the data: {\"status\": \"ok\", \"items\": [1, 2]} let me know if you need anything else."
    assert robust_parse_json(raw_prefix) == {"status": "ok", "items": [1, 2]}
    
    # Trailing comma
    raw_trailing = "{\"status\": \"ok\", \"items\": [1, 2, ],}"
    assert robust_parse_json(raw_trailing) == {"status": "ok", "items": [1, 2]}
    print("[SUCCESS] robust_parse_json works perfectly!")

def test_rotation_failure_handling():
    print("[TEST] Checking failover logic when models encounter errors...")
    
    # Mocking OpenAI Client calls to simulate model rate limit (429) then success
    mock_responses = [
        # Model 1: meta-llama/llama-3.3-70b-instruct:free raises rate limit (429)
        Exception("Rate limit exceeded (429)"),
        # Model 2: qwen/qwen3-coder:free raises bad request (400) for response_format, then success on retry
        Exception("Bad Request (400) - JSON mode not supported"),
        MagicMock(choices=[MagicMock(message=MagicMock(content="{\"source\": \"qwen_coder_retry\"}"))])
    ]
    
    call_count = 0
    
    def mock_create(*args, **kwargs):
        nonlocal call_count
        res = mock_responses[call_count]
        call_count += 1
        if isinstance(res, Exception):
            raise res
        return res

    with patch('backend.utils.llm_client.OpenAI') as MockOpenAI:
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = mock_create
        MockOpenAI.return_value = mock_client
        
        # Temporarily force OpenRouter key to be present
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "mock_or_key"}):
            # We call the function
            res = call_llm_json("test prompt", "test instruction")
            print(f"Result from mocked failover: {res}")
            
            # The result should be from Model 2 retry
            assert res == {"source": "qwen_coder_retry"}
            
            # Check how many times create was called
            # 1st call: Model 1 with response_format -> Exception 429
            # 2nd call: Model 2 with response_format -> Exception 400
            # 3rd call: Model 2 without response_format -> Success
            assert mock_client.chat.completions.create.call_count == 3
            
    print("[SUCCESS] Failover and rotation logic works correctly under simulated errors!")

def test_real_openrouter_call():
    # Only run if we actually have the key configured in environment
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("[SKIP] Skipping real OpenRouter integration test (API key not found).")
        return
        
    print("[TEST] Running real OpenRouter test call...")
    prompt = "Create a JSON object containing a 'title' string about 'Binary Search Tree' and a list of 'topics' with 2 strings."
    
    # We will invoke call_llm_json. Since FREE_MODELS has 10 models, it should succeed with one of them.
    try:
        res = call_llm_json(prompt)
        print(f"Real API response: {res}")
        assert isinstance(res, dict)
        assert "title" in res
        assert "topics" in res
        print("[SUCCESS] Real OpenRouter call completed successfully!")
    except Exception as e:
        print(f"[FAIL] Real OpenRouter call failed: {e}")
        assert False

if __name__ == "__main__":
    print("=== STARTING LLM ROTATION TEST SUITE ===")
    test_robust_json_parsing()
    print("-" * 40)
    test_rotation_failure_handling()
    print("-" * 40)
    test_real_openrouter_call()
    print("=== TEST SUITE COMPLETED ===")
