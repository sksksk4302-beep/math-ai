import requests
import json

BASE_URL = "https://math-ai-backend-166031514396.us-central1.run.app"

def debug_db():
    print(f"Debugging DB against: {BASE_URL}")
    try:
        res = requests.get(f"{BASE_URL}/debug-db")
        print(json.dumps(res.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"❌ Request Failed: {e}")

if __name__ == "__main__":
    debug_db()
