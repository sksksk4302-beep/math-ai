import os
import json
import uuid
import random
import base64
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud import firestore as google_firestore
import vertexai
from vertexai.generative_models import GenerativeModel
from google.cloud import texttospeech
from google.cloud import speech

# 2. Firebase & Vertex AI 초기화
print("🚀 Backend Version 2.0 Started")
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
KEY_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

# Firebase 초기화
if not firebase_admin._apps:
    if KEY_PATH and os.path.exists(KEY_PATH):
        cred = credentials.Certificate(KEY_PATH)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized successfully (Key File)")
    else:
        # Cloud Run 등에서는 ADC(Application Default Credentials) 사용
        try:
            firebase_admin.initialize_app(options={'projectId': PROJECT_ID})
            print(f"✅ Firebase initialized successfully (ADC) - Project: {PROJECT_ID}")
        except Exception as e:
            print(f"⚠️ Warning: Firebase init failed: {e}. Firestore will not work.")

# Firestore 클라이언트
try:
    # Use google-cloud-firestore directly for named database support
    db = google_firestore.Client(project=PROJECT_ID, database='math-ai')
    print("✅ Connected to Firestore database: math-ai")
except Exception as e:
    print(f"❌ Firestore connection failed: {e}")
    db = None

# Vertex AI 초기화 (Service Account Key 사용)
try:
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    print(f"✅ Vertex AI connected! Project: {PROJECT_ID}")
except Exception as e:
    error_msg = f"❌ Vertex AI initialization failed: {e}"
    print(error_msg)
    with open("backend_error.log", "a", encoding="utf-8") as f:
        f.write(f"{error_msg}\n")

app = FastAPI()

# 3. CORS 설정
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    # Firebase Hosting production domains
    "https://math-ai-479306.web.app",
    "https://math-ai-479306.firebaseapp.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # Allow Firebase preview channels like https://math-ai-479306--feature.web.app
    allow_origin_regex=r"^https://math-ai-479306(?:--[a-z0-9-]+)?\.(?:web\.app|firebaseapp\.com)$",
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
### 사용 가능한 시각적 아이템 (visual_items)
- apple, star, dinosaur, car, candy, bus, flower, pencil, coin
- 위 목록 중에서 **매번 다른 것을 골라서** 사용해줘. 사과만 쓰지 마. 상황에 어울리는 것을 골라줘.
- 예를 들어 3개를 보여줘야 하면 ["car", "car", "car"] 처럼 작성해.

### 응답 포맷 (JSON)
{
    "message": "아이고, 아깝다! 사과가 3개 있는데 2개를 더 가져오면 몇 개가 될까? 하나, 둘, 셋, 넷, 다섯! 정답은 5야.",
    "visual_items": ["apple", "apple", "apple", "apple", "apple"],
    "animation_type": "counting"
}
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
    # Vertex AI 모델 초기화 (우선순위: 2.5 Flash -> 1.5 Flash)
    try:
        # 사용자 요청: Gemini 2.5 Flash 시도
        model_name = "gemini-2.5-flash"
        model_explain = GenerativeModel(model_name, system_instruction=SYSTEM_PROMPT_EXPLAIN)
        model_generate = GenerativeModel(model_name, system_instruction=SYSTEM_PROMPT_GENERATE)
        print(f"✅ Vertex AI Models Initialized ({model_name})")
    except Exception as e_25:
        print(f"⚠️ {model_name} init failed, falling back to 1.5-flash: {e_25}")
        # 실패 시 1.5 Flash로 폴백
        model_name = "gemini-1.5-flash"
        model_explain = GenerativeModel(model_name, system_instruction=SYSTEM_PROMPT_EXPLAIN)
        model_generate = GenerativeModel(model_name, system_instruction=SYSTEM_PROMPT_GENERATE)
        print(f"✅ Vertex AI Models Initialized ({model_name}) - Fallback")

except Exception as e:
    print(f"❌ Model Init Failed: {e}")
    model_explain = None
    model_generate = None

# 6.6 STT Client
try:
    speech_client = speech.SpeechClient()
    print("✅ Google Cloud Speech Client Initialized")
except Exception as e:
    print(f"❌ Speech Client Init Failed: {e}")
    speech_client = None

# 6.5 TTS Helper
def synthesize_text(text: str) -> Optional[str]:
    try:
        client = texttospeech.TextToSpeechClient()
        input_text = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code="ko-KR",
            name="ko-KR-Neural2-C",
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=0.9,
            pitch=1.0
        )
        response = client.synthesize_speech(
            request={"input": input_text, "voice": voice, "audio_config": audio_config}
        )
        return base64.b64encode(response.audio_content).decode("utf-8")
    except Exception as e:
        print(f"⚠️ TTS Error: {e}")
        return None

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
    # Add randomness to prompt to prevent caching/repetition
    random_seed = random.randint(1, 10000)
    prompt = f"Level {current_level} 규칙: {level_rule}. 이 규칙에 맞는 **새롭고 다양한** 수학 문제를 하나 만들어줘. 이전과 다른 숫자를 사용해. (Random Seed: {random_seed})"

    try:
        response = model_generate.generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 1.0 # Max creativity
            }
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
        # Level-specific fallbacks (Expanded)
        FALLBACK_PROBLEMS = {
            1: [
                {"problem": "1 + 1", "answer": 2}, {"problem": "2 + 1", "answer": 3},
                {"problem": "1 + 2", "answer": 3}, {"problem": "2 + 2", "answer": 4},
                {"problem": "3 + 1", "answer": 4}, {"problem": "1 + 3", "answer": 4},
                {"problem": "2 + 3", "answer": 5}, {"problem": "3 + 2", "answer": 5},
                {"problem": "4 + 1", "answer": 5}, {"problem": "1 + 4", "answer": 5},
                {"problem": "3 + 3", "answer": 6}, {"problem": "4 + 2", "answer": 6},
                {"problem": "2 + 4", "answer": 6}, {"problem": "5 + 1", "answer": 6},
                {"problem": "1 + 5", "answer": 6}, {"problem": "4 + 3", "answer": 7},
                {"problem": "3 + 4", "answer": 7}, {"problem": "5 + 2", "answer": 7},
                {"problem": "2 + 5", "answer": 7}, {"problem": "6 + 1", "answer": 7},
                {"problem": "1 + 6", "answer": 7}, {"problem": "4 + 4", "answer": 8},
                {"problem": "5 + 3", "answer": 8}, {"problem": "3 + 5", "answer": 8},
                {"problem": "6 + 2", "answer": 8}, {"problem": "2 + 6", "answer": 8},
                {"problem": "7 + 1", "answer": 8}, {"problem": "1 + 7", "answer": 8},
                {"problem": "5 + 4", "answer": 9}, {"problem": "4 + 5", "answer": 9},
                {"problem": "6 + 3", "answer": 9}, {"problem": "3 + 6", "answer": 9},
                {"problem": "7 + 2", "answer": 9}, {"problem": "2 + 7", "answer": 9},
                {"problem": "8 + 1", "answer": 9}, {"problem": "1 + 8", "answer": 9},
                {"problem": "5 + 5", "answer": 10}, {"problem": "6 + 4", "answer": 10},
                {"problem": "4 + 6", "answer": 10}, {"problem": "7 + 3", "answer": 10},
                {"problem": "3 + 7", "answer": 10}, {"problem": "8 + 2", "answer": 10},
                {"problem": "2 + 8", "answer": 10}, {"problem": "9 + 1", "answer": 10}
            ],
            2: [
                {"problem": "6 + 5", "answer": 11}, {"problem": "5 + 6", "answer": 11},
                {"problem": "7 + 4", "answer": 11}, {"problem": "4 + 7", "answer": 11},
                {"problem": "8 + 3", "answer": 11}, {"problem": "3 + 8", "answer": 11},
                {"problem": "9 + 2", "answer": 11}, {"problem": "6 + 6", "answer": 12},
                {"problem": "7 + 5", "answer": 12}, {"problem": "5 + 7", "answer": 12},
                {"problem": "8 + 4", "answer": 12}, {"problem": "4 + 8", "answer": 12},
                {"problem": "9 + 3", "answer": 12}, {"problem": "7 + 6", "answer": 13},
                {"problem": "6 + 7", "answer": 13}, {"problem": "8 + 5", "answer": 13},
                {"problem": "5 + 8", "answer": 13}, {"problem": "9 + 4", "answer": 13},
                {"problem": "4 + 9", "answer": 13}, {"problem": "7 + 7", "answer": 14},
                {"problem": "8 + 6", "answer": 14}, {"problem": "6 + 8", "answer": 14},
                {"problem": "9 + 5", "answer": 14}, {"problem": "5 + 9", "answer": 14},
                {"problem": "8 + 7", "answer": 15}, {"problem": "7 + 8", "answer": 15},
                {"problem": "9 + 6", "answer": 15}, {"problem": "6 + 9", "answer": 15},
                {"problem": "8 + 8", "answer": 16}, {"problem": "9 + 7", "answer": 16},
                {"problem": "7 + 9", "answer": 16}, {"problem": "9 + 8", "answer": 17},
                {"problem": "8 + 9", "answer": 17}, {"problem": "9 + 9", "answer": 18}
            ],
            3: [
                {"problem": "2 - 1", "answer": 1}, {"problem": "3 - 1", "answer": 2},
                {"problem": "3 - 2", "answer": 1}, {"problem": "4 - 1", "answer": 3},
                {"problem": "4 - 2", "answer": 2}, {"problem": "4 - 3", "answer": 1},
                {"problem": "5 - 1", "answer": 4}, {"problem": "5 - 2", "answer": 3},
                {"problem": "5 - 3", "answer": 2}, {"problem": "5 - 4", "answer": 1},
                {"problem": "6 - 1", "answer": 5}, {"problem": "6 - 2", "answer": 4},
                {"problem": "6 - 3", "answer": 3}, {"problem": "6 - 4", "answer": 2},
                {"problem": "6 - 5", "answer": 1}, {"problem": "7 - 2", "answer": 5},
                {"problem": "7 - 3", "answer": 4}, {"problem": "7 - 4", "answer": 3},
                {"problem": "7 - 5", "answer": 2}, {"problem": "8 - 2", "answer": 6},
                {"problem": "8 - 3", "answer": 5}, {"problem": "8 - 4", "answer": 4},
                {"problem": "8 - 5", "answer": 3}, {"problem": "8 - 6", "answer": 2},
                {"problem": "9 - 2", "answer": 7}, {"problem": "9 - 3", "answer": 6},
                {"problem": "9 - 4", "answer": 5}, {"problem": "9 - 5", "answer": 4},
                {"problem": "9 - 6", "answer": 3}, {"problem": "9 - 7", "answer": 2}
            ],
            4: [
                {"problem": "10 + 1", "answer": 11}, {"problem": "10 + 2", "answer": 12},
                {"problem": "10 + 3", "answer": 13}, {"problem": "10 + 4", "answer": 14},
                {"problem": "10 + 5", "answer": 15}, {"problem": "10 + 6", "answer": 16},
                {"problem": "10 + 7", "answer": 17}, {"problem": "10 + 8", "answer": 18},
                {"problem": "10 + 9", "answer": 19}, {"problem": "11 + 1", "answer": 12},
                {"problem": "11 + 2", "answer": 13}, {"problem": "11 + 3", "answer": 14},
                {"problem": "11 + 4", "answer": 15}, {"problem": "11 + 5", "answer": 16},
                {"problem": "11 + 6", "answer": 17}, {"problem": "11 + 7", "answer": 18},
                {"problem": "11 + 8", "answer": 19}, {"problem": "12 + 1", "answer": 13},
                {"problem": "12 + 2", "answer": 14}, {"problem": "12 + 3", "answer": 15},
                {"problem": "12 + 4", "answer": 16}, {"problem": "12 + 5", "answer": 17},
                {"problem": "12 + 6", "answer": 18}, {"problem": "12 + 7", "answer": 19},
                {"problem": "13 + 1", "answer": 14}, {"problem": "13 + 2", "answer": 15},
                {"problem": "13 + 3", "answer": 16}, {"problem": "13 + 4", "answer": 17},
                {"problem": "13 + 5", "answer": 18}, {"problem": "13 + 6", "answer": 19},
                {"problem": "14 + 1", "answer": 15}, {"problem": "14 + 2", "answer": 16},
                {"problem": "14 + 3", "answer": 17}, {"problem": "14 + 4", "answer": 18},
                {"problem": "14 + 5", "answer": 19}, {"problem": "15 + 1", "answer": 16},
                {"problem": "15 + 2", "answer": 17}, {"problem": "15 + 3", "answer": 18},
                {"problem": "15 + 4", "answer": 19}, {"problem": "16 + 1", "answer": 17},
                {"problem": "16 + 2", "answer": 18}, {"problem": "16 + 3", "answer": 19}
            ],
            5: [
                {"problem": "11 - 1", "answer": 10}, {"problem": "12 - 2", "answer": 10},
                {"problem": "13 - 3", "answer": 10}, {"problem": "14 - 4", "answer": 10},
                {"problem": "15 - 5", "answer": 10}, {"problem": "16 - 6", "answer": 10},
                {"problem": "17 - 7", "answer": 10}, {"problem": "18 - 8", "answer": 10},
                {"problem": "19 - 9", "answer": 10}, {"problem": "20 - 10", "answer": 10},
                {"problem": "11 - 2", "answer": 9}, {"problem": "12 - 3", "answer": 9},
                {"problem": "13 - 4", "answer": 9}, {"problem": "14 - 5", "answer": 9},
                {"problem": "15 - 6", "answer": 9}, {"problem": "16 - 7", "answer": 9},
                {"problem": "17 - 8", "answer": 9}, {"problem": "18 - 9", "answer": 9},
                {"problem": "15 - 1", "answer": 14}, {"problem": "15 - 2", "answer": 13},
                {"problem": "15 - 3", "answer": 12}, {"problem": "15 - 4", "answer": 11},
                {"problem": "16 - 1", "answer": 15}, {"problem": "16 - 2", "answer": 14},
                {"problem": "16 - 3", "answer": 13}, {"problem": "16 - 4", "answer": 12},
                {"problem": "18 - 1", "answer": 17}, {"problem": "18 - 2", "answer": 16},
                {"problem": "18 - 3", "answer": 15}, {"problem": "18 - 4", "answer": 14},
                {"problem": "19 - 1", "answer": 18}, {"problem": "19 - 2", "answer": 17},
                {"problem": "19 - 3", "answer": 16}, {"problem": "19 - 4", "answer": 15},
                {"problem": "20 - 1", "answer": 19}, {"problem": "20 - 2", "answer": 18},
                {"problem": "20 - 3", "answer": 17}, {"problem": "20 - 4", "answer": 16},
                {"problem": "20 - 5", "answer": 15}
            ]
        }
        
        # Get fallbacks for current level, default to Level 1 if not found
        level_fallbacks = FALLBACK_PROBLEMS.get(current_level, FALLBACK_PROBLEMS[1])
        fallback = random.choice(level_fallbacks)
        
        return {
            **fallback, 
            "level": current_level, 
            "id": str(uuid.uuid4()),
            "stickers": current_stickers,
            "total_stickers": total_stickers
        }

@app.post("/submit-result")
async def submit_result(request: SubmitResultRequest):
    # Return success even if DB is not available
    if not db:
        return {
            "new_level": 1,
            "level_stickers": 0,
            "total_stickers": 0,
            "levelup_event": False,
            "grand_finale": False
        }

    try:
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
            try:
                db.collection("history").add({
                    "user_id": request.user_id,
                    "problem_id": request.problem_id,
                    "is_correct": request.is_correct,
                    "timestamp": firestore.SERVER_TIMESTAMP
                })
            except Exception as e:
                print(f"⚠️ History logging failed: {e}")

            # 2. Update Recent Results (참고용으로 유지)
            recent_results.append(request.is_correct)
            if len(recent_results) > 10:
                recent_results.pop(0)

            grand_finale = False
            levelup_event = False

            # 3. Reward & Leveling Logic (New Rule: 10 stickers per level)
            if request.is_correct:
                level_stickers += 1
                total_stickers += 1
                
                # Check for Level Up or Grand Finale
                if level_stickers >= 10:
                    if current_level < 5:
                        current_level += 1
                        level_stickers = 0 # Reset for new level
                        levelup_event = True
                        print(f"🆙 Level Up! {request.user_id} -> Lv.{current_level}")
                    else:
                        # Level 5 and 10 stickers collected -> Grand Finale!
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
                "grand_finale": grand_finale,
                "audio_base64": synthesize_text("정답입니다! 참 잘했어요!") if request.is_correct else None
            }
            
        return update_user_stats(db.transaction(), user_ref)

    except Exception as e:
        print(f"🔥 결과 저장 실패: {e}")
        # Return default values instead of raising error
        return {
            "new_level": 1,
            "level_stickers": 0,
            "total_stickers": 0,
            "levelup_event": False,
            "grand_finale": False
        }

@app.post("/explain-error")
async def explain_error(request: QuizRequest):
    if not model_explain:
        raise HTTPException(status_code=500, detail="Vertex AI model not initialized")

    print(f"📥 [오답 설명 요청] {request.user_name}: {request.problem} (답: {request.wrong_answer})")
    
    # Log to Firestore
    if db:
        try:
            db.collection("history").add({
                "type": "explanation_request",
                "user_name": request.user_name,
                "problem": request.problem,
                "wrong_answer": request.wrong_answer,
                "timestamp": firestore.SERVER_TIMESTAMP
            })
        except Exception as e:
            print(f"⚠️ Firestore Error (Skipping DB): {e}")

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
        
        # TTS Generation
        audio_base64 = synthesize_text(result['message'])
        result['audio_base64'] = audio_base64
        
        print(f"📤 [응답] AI 선생님: {result['message']}")
        return result

    except Exception as e:
        error_msg = f"🔥 에러: {str(e)}"
        print(error_msg)
        with open("backend_error.log", "a", encoding="utf-8") as f:
            f.write(f"{error_msg}\n")
            
        # Fallback response
        fallback_msg = f"{request.user_name}, 괜찮아! 우리 다시 한 번 천천히 세어볼까?"
        
        # Randomize fallback items
        available_items = ["apple", "star", "dinosaur", "car", "candy", "bus", "flower", "pencil", "coin"]
        selected_item = random.choice(available_items)
        # Use correct answer count if possible, otherwise default to 5
        # We don't have correct answer in request, but we can try to parse problem or just show some
        # Actually request.problem is "2 + 3" string. Let's just show 5 items as generic fallback or try to parse
        
        return {
            "message": fallback_msg,
            "animation_type": "counting",
            "visual_items": [selected_item] * 5, 
            "correct_answer": 0,
            "audio_base64": synthesize_text(fallback_msg)
        }

@app.get("/")
async def health_check():
    return {"status": "Math AI Server is Running 🚀"}

@app.get("/timeout-audio")
async def get_timeout_audio():
    text = "시간이 다 됐어요! 선생님이랑 같이 풀어볼까요?"
    audio_base64 = synthesize_text(text)
    return {"audio_base64": audio_base64, "message": text}

@app.get("/debug-db")
async def debug_db():
    results = {}
    
    # 1. Try Default DB
    try:
        db_default = firestore.client()
        # Try a read operation
        docs = list(db_default.collection("test").limit(1).stream())
        results["default"] = "Connected (Read Success)"
    except Exception as e:
        results["default"] = f"Failed: {str(e)}"

    # 2. Try 'math-ai' DB
    try:
        db_named = google_firestore.Client(project=PROJECT_ID, database='math-ai')
        docs = list(db_named.collection("test").limit(1).stream())
        results["math-ai"] = "Connected (Read Success)"
    except Exception as e:
        results["math-ai"] = f"Failed: {str(e)}"
        
    # 3. Current Global DB Status
    results["current_global_db"] = "Connected" if db else "None"
    
    return results

def normalize_korean_number(text: str) -> str:
    """한글 숫자를 아라비아 숫자로 변환"""
    korean_to_digit = {
        '영': '0', '공': '0',
        '일': '1', '하나': '1',
        '이': '2', '둘': '2',
        '삼': '3', '셋': '3',
        '사': '4', '넷': '4',
        '오': '5', '다섯': '5',
        '육': '6', '여섯': '6',
        '칠': '7', '일곱': '7',
        '팔': '8', '여덟': '8',
        '구': '9', '아홉': '9',
        '십': '10', '열': '10'
    }
    
    # 완전 일치 확인
    text_clean = text.strip()
    if text_clean in korean_to_digit:
        return korean_to_digit[text_clean]
    
    # 한글 숫자 치환
    normalized = text
    for korean, digit in korean_to_digit.items():
        normalized = normalized.replace(korean, digit)
    
    # 숫자만 추출
    import re
    return re.sub(r'[^0-9]', '', normalized)

@app.post("/stt")
async def speech_to_text(file: UploadFile = File(...)):
    if not speech_client:
        raise HTTPException(status_code=500, detail="Speech client not initialized")
    
    try:
        content = await file.read()
        audio = speech.RecognitionAudio(content=content)
        
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
            sample_rate_hertz=48000,
            language_code="ko-KR",
            enable_automatic_punctuation=True,
        )
        
        response = speech_client.recognize(config=config, audio=audio)
        
        transcript = ""
        for result in response.results:
            transcript += result.alternatives[0].transcript
        
        print(f"🎤 STT Transcript: {transcript}")
        
        # 한글 숫자를 아라비아 숫자로 변환
        number = normalize_korean_number(transcript)
        
        print(f"🔢 Converted Number: {number}")
        
        return {"text": transcript, "number": number}
    except Exception as e:
        print(f"STT Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

