import os
import json
import uuid
import random
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import vertexai
from vertexai.generative_models import GenerativeModel
import firebase_admin
from firebase_admin import credentials, firestore

# 1. 환경 변수 로드
load_dotenv()

# 2. Firebase & Vertex AI 초기화
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
KEY_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

# Firebase 초기화
if not firebase_admin._apps:
    if KEY_PATH and os.path.exists(KEY_PATH):
        cred = credentials.Certificate(KEY_PATH)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized successfully")
    else:
        print("⚠️ Warning: GOOGLE_APPLICATION_CREDENTIALS not found. Firestore will not work.")

# Firestore 클라이언트
try:
    db = firestore.client()
except Exception as e:
    print(f"❌ Firestore connection failed: {e}")
    db = None

# Vertex AI 초기화
try:
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    print(f"✅ Vertex AI connected! Project: {PROJECT_ID}")
except Exception as e:
    print(f"❌ Vertex AI initialization failed: {e}")

app = FastAPI()

# 3. CORS 설정
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Constants (Leveling Rules)
LEVEL_GUIDES = {
    1: "합이 10 이하인 한 자릿수 덧셈 (예: 3 + 2)",
    2: "합이 18 이하인 한 자릿수 덧셈 (예: 8 + 5)",
    3: "결과가 양수인 한 자릿수 뺄셈 (예: 7 - 3)",
    4: "두 자릿수와 한 자릿수의 덧셈 (예: 12 + 5)",
    5: "1부터 20까지의 수로 이루어진 혼합 산수 (덧셈/뺄셈)"
}

# 5. Data Models
class QuizRequest(BaseModel):
    problem: str
    wrong_answer: str
    user_name: str

class UpdateLevelRequest(BaseModel):
    user_id: str
    new_level: int

class GenerateProblemRequest(BaseModel):
    user_id: str

class SubmitResultRequest(BaseModel):
    user_id: str
    problem_id: str
    is_correct: bool

# 6. Gemini Models
SYSTEM_PROMPT_EXPLAIN = """
너는 7세 아이들을 가르치는 아주 친절하고 똑똑한 AI 수학 선생님이야.
아이가 문제를 틀렸을 때, 무조건 정답을 알려주는 게 아니라 **"왜 틀렸는지"**를 아이 눈높이에서 설명해줘야 해.
가장 중요한 건 **"문제의 유형과 난이도에 맞는 시각적 설명"**을 제공하는 거야.

### 응답 포맷 (JSON)
{
    "message": "아이에게 해줄 말",
    "animation_type": "counting" | "ten_frame",
    "visual_items": ["apple", "apple", "apple"], 
    "correct_answer": 정답 숫자
}

### 사용 가능한 시각적 아이템 (visual_items)
- apple, star, dinosaur, car, candy, bus, flower, pencil, coin
- 위 목록에 있는 것만 사용해서 배열을 채워줘.
- 예를 들어 3개를 보여줘야 하면 ["apple", "apple", "apple"] 처럼 작성해.
"""

SYSTEM_PROMPT_GENERATE = """
너는 7세 아이들을 위한 수학 문제 출제자야.
주어진 난이도(Level) 규칙에 딱 맞는 수학 문제를 하나 만들어줘.

### 응답 포맷 (JSON)
{
    "problem": "3 + 5",
    "answer": 8
}
"""

try:
    model_explain = GenerativeModel("gemini-2.5-flash", system_instruction=SYSTEM_PROMPT_EXPLAIN)
    model_generate = GenerativeModel("gemini-2.5-flash", system_instruction=SYSTEM_PROMPT_GENERATE)
except Exception:
    model_explain = None
    model_generate = None

# 7. API Endpoints

@app.post("/update-level")
async def update_level(request: UpdateLevelRequest):
    if not db:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    user_ref = db.collection("users").document(request.user_id)
    user_ref.set({"current_level": request.new_level}, merge=True)
    return {"status": "success", "new_level": request.new_level}

@app.post("/generate-problem")
async def generate_problem(request: GenerateProblemRequest):
    # 1. Get User Info (Level & Stickers)
    current_level = 1
    current_stickers = 0
    total_stickers = 0
    
    if db:
        try:
            user_ref = db.collection("users").document(request.user_id)
            user_doc = user_ref.get()
            if user_doc.exists:
                data = user_doc.to_dict()
                current_level = data.get("current_level", 1)
                current_stickers = data.get("level_stickers", 0)
                total_stickers = data.get("total_stickers", 0)
            else:
                # Create new user if not exists
                user_ref.set({
                    "current_level": 1, 
                    "level_stickers": 0, 
                    "total_stickers": 0,
                    "recent_results": []
                })
        except Exception as e:
            print(f"⚠️ Firestore Error (Skipping DB): {e}")

    # 2. Generate Problem via Gemini
    if not model_generate:
        # Fallback if model is not initialized
        return {
            "problem": "2 + 2", 
            "answer": 4, 
            "level": current_level, 
            "id": str(uuid.uuid4()),
            "stickers": current_stickers,
            "total_stickers": total_stickers
        }

    level_rule = LEVEL_GUIDES.get(current_level, LEVEL_GUIDES[1])
    prompt = f"Level {current_level} 규칙: {level_rule}. 이 규칙에 맞는 문제를 하나 만들어줘."

    try:
        response = model_generate.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        result = json.loads(response.text)
        
        # Add metadata
        result["level"] = current_level
        result["id"] = str(uuid.uuid4())
        result["stickers"] = current_stickers
        result["total_stickers"] = total_stickers
        
        print(f"🆕 [문제 생성] Level {current_level}: {result['problem']}")
        return result

    except Exception as e:
        print(f"🔥 문제 생성 실패 (AI Error): {e}")
        # Fallback problem to prevent 500 error
        fallback_problems = [
            {"problem": "1 + 1", "answer": 2},
            {"problem": "2 + 3", "answer": 5},
            {"problem": "5 + 5", "answer": 10},
            {"problem": "10 - 2", "answer": 8},
            {"problem": "7 + 4", "answer": 11}
        ]
        fallback = random.choice(fallback_problems)
        return {
            **fallback, 
            "level": current_level, 
            "id": str(uuid.uuid4()),
            "stickers": current_stickers,
            "total_stickers": total_stickers
        }

@app.post("/submit-result")
async def submit_result(request: SubmitResultRequest):
    if not db:
        raise HTTPException(status_code=500, detail="Database not connected")

    user_ref = db.collection("users").document(request.user_id)
    
    # Transaction to ensure atomic updates
    @firestore.transactional
    def update_user_stats(transaction, ref):
        snapshot = transaction.get(ref)
        if not snapshot.exists:
            # 초기화: level 1, level_stickers 0, total_stickers 0
            user_data = {
                "current_level": 1, 
                "level_stickers": 0, 
                "total_stickers": 0,
                "recent_results": []
            }
        else:
            user_data = snapshot.to_dict()

        current_level = user_data.get("current_level", 1)
        level_stickers = user_data.get("level_stickers", 0)
        total_stickers = user_data.get("total_stickers", 0)
        recent_results = user_data.get("recent_results", [])

        # 1. Update History
        db.collection("history").add({
            "user_id": request.user_id,
            "problem_id": request.problem_id,
            "is_correct": request.is_correct,
            "timestamp": firestore.SERVER_TIMESTAMP
        })

        # 2. Update Recent Results (참고용으로 유지)
        recent_results.append(request.is_correct)
        if len(recent_results) > 10:
            recent_results.pop(0)

        grand_finale = False
        levelup_event = False

        # 3. Reward & Leveling Logic (New Rule: 5 stickers per level)
        if request.is_correct:
            level_stickers += 1
            total_stickers += 1
            
            # Check for Level Up or Grand Finale
            if level_stickers >= 5:
                if current_level < 5:
                    current_level += 1
                    level_stickers = 0 # Reset for new level
                    levelup_event = True
                    print(f"🆙 Level Up! {request.user_id} -> Lv.{current_level}")
                else:
                    # Level 5 and 5 stickers collected -> Grand Finale!
                    grand_finale = True
                    print(f"🎉 Grand Finale! {request.user_id} completed all levels!")
        
        # 오답일 경우 스티커 차감 로직은 없음 (격려 위주)

        transaction.update(ref, {
            "current_level": current_level,
            "level_stickers": level_stickers,
            "total_stickers": total_stickers,
            "recent_results": recent_results
        })

        return {
            "new_level": current_level,
            "level_stickers": level_stickers,
            "total_stickers": total_stickers,
            "levelup_event": levelup_event,
            "grand_finale": grand_finale
        }

    transaction = db.transaction()
    try:
        result = update_user_stats(transaction, user_ref)
        return result
    except Exception as e:
        print(f"🔥 결과 저장 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/explain-error")
async def explain_error(request: QuizRequest):
    if not model_explain:
        raise HTTPException(status_code=500, detail="Vertex AI model not initialized")

    print(f"📥 [오답 설명 요청] {request.user_name}: {request.problem} (답: {request.wrong_answer})")
    
    # Log to Firestore
    if db:
        db.collection("history").add({
            "type": "explanation_request",
            "user_name": request.user_name,
            "problem": request.problem,
            "wrong_answer": request.wrong_answer,
            "timestamp": firestore.SERVER_TIMESTAMP
        })

    prompt = f"""
    문제: {request.problem}
    사용자가 쓴 답: {request.wrong_answer}
    사용자 이름: {request.user_name}
    
    위 상황에 맞춰서 아이에게 설명해주고 JSON을 만들어줘.
    """

    try:
        response = model_explain.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result = json.loads(response.text)
        print(f"📤 [응답] AI 선생님: {result['message']}")
        return result

    except Exception as e:
        print(f"🔥 에러: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def health_check():
    return {"status": "Math AI Server is Running 🚀"}
