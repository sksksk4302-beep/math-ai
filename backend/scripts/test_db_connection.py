import requests
import json
import time

BASE_URL = "https://math-ai-backend-166031514396.us-central1.run.app"
USER_ID = "test_user_verify_2"

def run_test():
    print(f"Testing against: {BASE_URL}")
    print(f"User ID: {USER_ID}")

    # 1. Generate Problem (Initial State)
    print("\n1. Generating Problem...")
    try:
        res = requests.post(f"{BASE_URL}/generate-problem", json={"user_id": USER_ID})
        res.raise_for_status()
        data = res.json()
        print(f"   Initial State: Level {data.get('level')}, Stickers {data.get('stickers')}")
        problem_id = data.get('id')
        initial_stickers = data.get('stickers', 0)
    except Exception as e:
        print(f"❌ Generate Problem Failed: {e}")
        return

    # 2. Submit Correct Result
    print("\n2. Submitting Correct Result...")
    try:
        payload = {
            "user_id": USER_ID,
            "problem_id": problem_id,
            "is_correct": True
        }
        res = requests.post(f"{BASE_URL}/submit-result", json=payload)
        res.raise_for_status()
        data = res.json()
        print(f"   Result: Level {data.get('new_level')}, Stickers {data.get('level_stickers')}")
        
        new_stickers = data.get('level_stickers')
        
        if new_stickers == initial_stickers + 1:
            print("\n✅ SUCCESS: Sticker count incremented correctly!")
        else:
            print(f"\n❌ FAILURE: Sticker count did not increment. (Expected {initial_stickers + 1}, got {new_stickers})")
            print("   Possible cause: Backend is running in stateless mode (DB connection failed).")

    except Exception as e:
        print(f"❌ Submit Result Failed: {e}")

if __name__ == "__main__":
    run_test()
