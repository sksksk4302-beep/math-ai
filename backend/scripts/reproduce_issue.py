import requests
import json
import uuid
import time

BASE_URL = "http://127.0.0.1:8006"
USER_ID = f"test_user_{uuid.uuid4().hex[:8]}"

def test_sticker_accumulation():
    print(f"🧪 Testing with User ID: {USER_ID}")

    # 1. Start Session 1
    print("\n[Step 1] Starting Session 1...")
    try:
        res = requests.post(f"{BASE_URL}/start-session", json={"user_id": USER_ID})
        if res.status_code != 200:
            print(f"❌ Start Session 1 Failed: {res.text}")
            return
        data = res.json()
        session_id_1 = data['session_id']
        print(f"✅ Session 1 Started: {session_id_1}")
        print(f"   Initial Total Stickers: {data['total_stickers']}")
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return

    # 2. Submit Correct Answer in Session 1
    print("\n[Step 2] Submitting Correct Answer in Session 1...")
    submit_payload = {
        "user_id": USER_ID,
        "session_id": session_id_1,
        "problem_id": "test_prob_1",
        "problem": "1+1",
        "answer": 2,
        "user_answer": "2",
        "is_correct": True,
        "source": "test"
    }
    res = requests.post(f"{BASE_URL}/submit-result", json=submit_payload)
    data = res.json()
    print(f"✅ Result Submitted. Total Stickers: {data['total_stickers']}")
    
    if data['total_stickers'] != 1:
        print(f"⚠️ Warning: Stickers did not increment to 1. Response: {data}")

    print("Waiting for DB consistency...")
    time.sleep(2)

    # 3. Start Session 2 (New Game)
    print("\n[Step 3] Starting Session 2 (New Game)...")
    res = requests.post(f"{BASE_URL}/start-session", json={"user_id": USER_ID})
    data = res.json()
    session_id_2 = data['session_id']
    print(f"✅ Session 2 Started: {session_id_2}")
    print(f"   Total Stickers in New Session: {data['total_stickers']}")

    # 4. Verify Session 2 Start
    if data['total_stickers'] == 0:
        print("\n✅ Session 2 correctly started with 0 stickers.")
    else:
        print(f"\n❌ Session 2 started with {data['total_stickers']} stickers (Expected 0).")

    # 5. Submit Correct Answer in Session 2
    print("\n[Step 4] Submitting Correct Answer in Session 2...")
    submit_payload['session_id'] = session_id_2
    res = requests.post(f"{BASE_URL}/submit-result", json=submit_payload)
    data = res.json()
    print(f"✅ Result Submitted. Total Stickers: {data['total_stickers']}")

    if data['total_stickers'] == 1:
        print("\n✅ SUCCESS: Stickers incremented to 1 in Session 2.")
    else:
        print(f"\n❌ FAILURE: Stickers did not increment. Current: {data['total_stickers']}")

if __name__ == "__main__":
    test_sticker_accumulation()
