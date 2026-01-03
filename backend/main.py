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

# Gemini Models 초기화
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

try:
    model_explain = GenerativeModel("gemini-2.0-flash-exp", system_instruction=SYSTEM_PROMPT_EXPLAIN)
    print("✅ Gemini Model Initialized")
except Exception as e:
    print(f"❌ Gemini Model Init Failed: {e}")
    model_explain = None

# Speech Client 초기화
try:
    speech_client = speech.SpeechClient()
    print("✅ Speech Client Initialized")
except Exception as e:
    print(f"❌ Speech Client Init Failed: {e}")
    speech_client = None

# TTS Helper Function
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
    session_id: str

class SubmitResultRequest(BaseModel):
    user_id: str
    session_id: str
    problem_id: str
    problem: str
    answer: int
    user_answer: str
    is_correct: bool
    source: str

class StartSessionRequest(BaseModel):
    user_id: str

class ContinueSessionRequest(BaseModel):
    user_id: str

@app.post("/start-session")
async def start_session(request: StartSessionRequest):
    """새 세션 시작"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    try:
        # 새 세션 ID 생성
        session_id = str(uuid.uuid4())
        
        # 세션 문서 생성
        session_data = {
            "user_id": request.user_id,
            "current_level": 1,
            "level_stickers": 0,
            "total_stickers": 0,
            "created_at": firestore.SERVER_TIMESTAMP,
            "last_activity": firestore.SERVER_TIMESTAMP
        }
        
        db.collection("sessions").document(session_id).set(session_data)
        
        # 사용자 문서 업데이트 (마지막 세션 ID 저장)
        db.collection("users").document(request.user_id).set({
            "last_session_id": session_id,
            "last_activity": firestore.SERVER_TIMESTAMP
        }, merge=True)
        
        print(f"🎮 [새 세션 시작] user: {request.user_id}, session: {session_id}")
        
        return {
            "session_id": session_id,
            "current_level": 1,
            "level_stickers": 0,
            "total_stickers": 0
        }
    except Exception as e:
        print(f"🔥 Start session failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/continue-session")
async def continue_session(request: ContinueSessionRequest):
    """이전 세션 이어하기"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    try:
        # 사용자의 마지막 세션 ID 가져오기
        user_ref = db.collection("users").document(request.user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return {"status": "no_history"}
        
        user_data = user_doc.to_dict()
        last_session_id = user_data.get("last_session_id")
        
        if not last_session_id:
            return {"status": "no_history"}
        
        # 세션 데이터 가져오기
        session_ref = db.collection("sessions").document(last_session_id)
        session_doc = session_ref.get()
        
        if not session_doc.exists:
            return {"status": "no_history"}
        
        session_data = session_doc.to_dict()
        
        # 세션 활동 시간 업데이트
        session_ref.update({"last_activity": firestore.SERVER_TIMESTAMP})
        
        print(f"🔄 [세션 이어하기] user: {request.user_id}, session: {last_session_id}")
        
        return {
            "session_id": last_session_id,
            "current_level": session_data.get("current_level", 1),
            "level_stickers": session_data.get("level_stickers", 0),
            "total_stickers": session_data.get("total_stickers", 0)
        }
    except Exception as e:
        print(f"🔥 Continue session failed: {e}")
        return {"status": "no_history"}

@app.post("/generate-problem")
async def generate_problem(request: GenerateProblemRequest):
    # 1. Get Session Info (Level & Stickers)
    current_level = 1
    current_stickers = 0
    total_stickers = 0
    
    if db:
        try:
            session_ref = db.collection("sessions").document(request.session_id)
            session_doc = session_ref.get()
            if session_doc.exists:
                data = session_doc.to_dict()
                current_level = data.get("current_level", 1)
                current_stickers = data.get("level_stickers", 0)
                total_stickers = data.get("total_stickers", 0)
        except Exception as e:
            print(f"⚠️ Firestore Error (Skipping DB): {e}")

    # 2. Fetch Problem from Problem Bank (Firestore)
    problem_data = None
    if db:
        try:
            # Fetch all problems for this level (or a random subset if possible, but Firestore random is hard)
            # For 30 items, fetching all IDs and picking one is fine.
            # Optimization: Use a random offset or ID if we had sequential IDs, but here we have random IDs.
            # Let's fetch all for the level and pick one randomly. 30 items is small.
            problems_ref = db.collection("problems").where("level", "==", current_level).stream()
            problems_list = [p.to_dict() for p in problems_ref]
            
            if problems_list:
                problem_data = random.choice(problems_list)
                print(f"🏦 [문제 은행] Level {current_level} 문제 선택 완료: {problem_data['problem']}")
            else:
                print(f"⚠️ [문제 은행] Level {current_level} 문제 없음. Fallback 사용.")
        except Exception as e:
            print(f"🔥 Firestore Problem Fetch Error: {e}")

    # 3. Fallback if DB failed or empty
    if not problem_data:
        problem_data = {
            "problem": "2 + 2", 
            "answer": 4
        }

    return {
        "problem": problem_data["problem"],
        "answer": problem_data["answer"],
        "level": current_level,
        "id": str(uuid.uuid4()), # Generate a unique ID for this instance of the problem
        "stickers": current_stickers,
        "total_stickers": total_stickers,
        "source": "problem_bank" if db else "fallback"
    }

@app.post("/submit-result")
async def submit_result(request: SubmitResultRequest):
    """문제 결과 제출 및 진행 상황 업데이트"""
    if not db:
        return {
            "new_level": 1,
            "level_stickers": 0,
            "total_stickers": 0,
            "levelup_event": False
        }
    
    try:
        session_ref = db.collection("sessions").document(request.session_id)
        
        # Transaction으로 원자적 업데이트
        @firestore.transactional
        def update_session_stats(transaction, ref):
            snapshot = transaction.get(ref)
            if not snapshot.exists:
                # 세션이 없으면 새로 생성
                session_data = {
                    "user_id": request.user_id,
                    "current_level": 1,
                    "level_stickers": 0,
                    "total_stickers": 0
                }
            else:
                session_data = snapshot.to_dict()
            
            current_level = session_data.get("current_level", 1)
            level_stickers = session_data.get("level_stickers", 0)
            total_stickers = session_data.get("total_stickers", 0)
            
            levelup_event = False
            
            # 정답인 경우 스티커 추가
            if request.is_correct:
                level_stickers += 1
                total_stickers += 1
                
                # 10개 모으면 레벨업
                if level_stickers >= 10:
                    if current_level < 5:
                        current_level += 1
                        level_stickers = 0
                        levelup_event = True
                        print(f"🆙 Level Up! session: {request.session_id} -> Lv.{current_level}")
            
            # 세션 업데이트
            transaction.update(ref, {
                "current_level": current_level,
                "level_stickers": level_stickers,
                "total_stickers": total_stickers,
                "last_activity": firestore.SERVER_TIMESTAMP
            })
            
            #히스토리 기록
            try:
                db.collection("history").add({
                    "user_id": request.user_id,
                    "session_id": request.session_id,
                    "problem_id": request.problem_id,
                    "problem": request.problem,
                    "answer": request.answer,
                    "user_answer": request.user_answer,
                    "is_correct": request.is_correct,
                    "source": request.source,
                    "timestamp": firestore.SERVER_TIMESTAMP
                })
            except Exception as e:
                print(f"⚠️ History logging failed: {e}")
            
            return {
                "new_level": current_level,
                "level_stickers": level_stickers,
                "total_stickers": total_stickers,
                "levelup_event": levelup_event,
                "audio_base64": synthesize_text("정답입니다! 참 잘했어요!") if request.is_correct else None
            }
        
        return update_session_stats(db.transaction(), session_ref)
    
    except Exception as e:
        print(f"🔥 Submit result failed: {e}")
        return {
            "new_level": 1,
            "level_stickers": 0,
            "total_stickers": 0,
            "levelup_event": False
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
    역할: 친절하고 지혜로운 AI 초등 수학 선생님
    상황: {request.user_name} 어린이가 수학 문제 "{request.problem}"를 틀렸습니다. (오답: {request.wrong_answer})
    
    목표: 단순히 정답을 알려주는 것이 아니라, 수학적 사고력을 키워줄 수 있는 방법으로 설명해주세요.
    
    설명 방식 (다음 중 문제에 가장 적합한 하나를 선택):
    1. **10 만들기 (Make 10):** 덧셈의 경우, 숫자를 갈라서 10을 먼저 만드는 방법을 보여주세요. (예: 8+5 -> 8+2+3 -> 10+3 -> 13)
    2. **가르기와 모으기 (Decomposition):** 숫자를 분해하여 계산하기 쉽게 만드세요.
    3. **수직선 (Number Line):** 수직선 위에서 껑충 뛰는 상상을 하도록 유도하세요.
    4. **짝꿍수:** 더해서 10이 되는 짝꿍수를 활용하세요.
    
    제약 사항:
    - 말투는 매우 다정하고 격려하는 말투 (~해요, ~해볼까요?)
    - 설명은 3문장 이내로 간결하게.
    - JSON 포맷으로 응답.
    
    JSON Output Format:
    {{
        "message": "아이에게 해줄 말 (설명 포함)",
        "animation_type": "counting", 
        "visual_items": ["star", "star"...] (시각적 보조가 필요하면 아이템 이름 나열, 최대 10개),
        "correct_answer": 정답숫자
    }}
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
        
        return {
            "message": fallback_msg,
            "animation_type": "counting",
            "visual_items": ["star"] * 5, 
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

