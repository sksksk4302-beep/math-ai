import os
import time
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud import firestore as google_firestore

# Configuration
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "math-ai-479306")
KEY_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

# Initialize Firebase
if not firebase_admin._apps:
    if KEY_PATH and os.path.exists(KEY_PATH):
        cred = credentials.Certificate(KEY_PATH)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app(options={'projectId': PROJECT_ID})

try:
    db = google_firestore.Client(project=PROJECT_ID, database='math-ai')
    print("✅ Connected to Firestore")
except Exception as e:
    print(f"❌ Firestore connection failed: {e}")
    exit(1)

# Hardcoded Problems (30 per level)
HARDCODED_PROBLEMS = {
    1: [ # Level 1: Sum <= 10, 1-digit + 1-digit
        {"problem": "1 + 1", "answer": 2}, {"problem": "1 + 2", "answer": 3}, {"problem": "2 + 1", "answer": 3},
        {"problem": "1 + 3", "answer": 4}, {"problem": "2 + 2", "answer": 4}, {"problem": "3 + 1", "answer": 4},
        {"problem": "1 + 4", "answer": 5}, {"problem": "2 + 3", "answer": 5}, {"problem": "3 + 2", "answer": 5},
        {"problem": "4 + 1", "answer": 5}, {"problem": "1 + 5", "answer": 6}, {"problem": "2 + 4", "answer": 6},
        {"problem": "3 + 3", "answer": 6}, {"problem": "4 + 2", "answer": 6}, {"problem": "5 + 1", "answer": 6},
        {"problem": "1 + 6", "answer": 7}, {"problem": "2 + 5", "answer": 7}, {"problem": "3 + 4", "answer": 7},
        {"problem": "4 + 3", "answer": 7}, {"problem": "5 + 2", "answer": 7}, {"problem": "6 + 1", "answer": 7},
        {"problem": "1 + 7", "answer": 8}, {"problem": "2 + 6", "answer": 8}, {"problem": "3 + 5", "answer": 8},
        {"problem": "4 + 4", "answer": 8}, {"problem": "5 + 3", "answer": 8}, {"problem": "6 + 2", "answer": 8},
        {"problem": "7 + 1", "answer": 8}, {"problem": "1 + 8", "answer": 9}, {"problem": "2 + 7", "answer": 9}
    ],
    2: [ # Level 2: Sum <= 18, 1-digit + 1-digit (Carry over focus)
        {"problem": "5 + 6", "answer": 11}, {"problem": "6 + 5", "answer": 11}, {"problem": "7 + 4", "answer": 11},
        {"problem": "8 + 3", "answer": 11}, {"problem": "9 + 2", "answer": 11}, {"problem": "5 + 7", "answer": 12},
        {"problem": "6 + 6", "answer": 12}, {"problem": "7 + 5", "answer": 12}, {"problem": "8 + 4", "answer": 12},
        {"problem": "9 + 3", "answer": 12}, {"problem": "5 + 8", "answer": 13}, {"problem": "6 + 7", "answer": 13},
        {"problem": "7 + 6", "answer": 13}, {"problem": "8 + 5", "answer": 13}, {"problem": "9 + 4", "answer": 13},
        {"problem": "5 + 9", "answer": 14}, {"problem": "6 + 8", "answer": 14}, {"problem": "7 + 7", "answer": 14},
        {"problem": "8 + 6", "answer": 14}, {"problem": "9 + 5", "answer": 14}, {"problem": "6 + 9", "answer": 15},
        {"problem": "7 + 8", "answer": 15}, {"problem": "8 + 7", "answer": 15}, {"problem": "9 + 6", "answer": 15},
        {"problem": "7 + 9", "answer": 16}, {"problem": "8 + 8", "answer": 16}, {"problem": "9 + 7", "answer": 16},
        {"problem": "8 + 9", "answer": 17}, {"problem": "9 + 8", "answer": 17}, {"problem": "9 + 9", "answer": 18}
    ],
    3: [ # Level 3: Result > 0, 1-digit - 1-digit
        {"problem": "2 - 1", "answer": 1}, {"problem": "3 - 1", "answer": 2}, {"problem": "3 - 2", "answer": 1},
        {"problem": "4 - 1", "answer": 3}, {"problem": "4 - 2", "answer": 2}, {"problem": "4 - 3", "answer": 1},
        {"problem": "5 - 1", "answer": 4}, {"problem": "5 - 2", "answer": 3}, {"problem": "5 - 3", "answer": 2},
        {"problem": "5 - 4", "answer": 1}, {"problem": "6 - 1", "answer": 5}, {"problem": "6 - 2", "answer": 4},
        {"problem": "6 - 3", "answer": 3}, {"problem": "6 - 4", "answer": 2}, {"problem": "6 - 5", "answer": 1},
        {"problem": "7 - 1", "answer": 6}, {"problem": "7 - 2", "answer": 5}, {"problem": "7 - 3", "answer": 4},
        {"problem": "7 - 4", "answer": 3}, {"problem": "7 - 5", "answer": 2}, {"problem": "7 - 6", "answer": 1},
        {"problem": "8 - 1", "answer": 7}, {"problem": "8 - 2", "answer": 6}, {"problem": "8 - 3", "answer": 5},
        {"problem": "8 - 4", "answer": 4}, {"problem": "8 - 5", "answer": 3}, {"problem": "8 - 6", "answer": 2},
        {"problem": "8 - 7", "answer": 1}, {"problem": "9 - 1", "answer": 8}, {"problem": "9 - 2", "answer": 7}
    ],
    4: [ # Level 4: 2-digit (10-20) + 1-digit
        {"problem": "10 + 1", "answer": 11}, {"problem": "10 + 2", "answer": 12}, {"problem": "10 + 3", "answer": 13},
        {"problem": "10 + 4", "answer": 14}, {"problem": "10 + 5", "answer": 15}, {"problem": "11 + 1", "answer": 12},
        {"problem": "11 + 2", "answer": 13}, {"problem": "11 + 3", "answer": 14}, {"problem": "11 + 4", "answer": 15},
        {"problem": "11 + 5", "answer": 16}, {"problem": "12 + 1", "answer": 13}, {"problem": "12 + 2", "answer": 14},
        {"problem": "12 + 3", "answer": 15}, {"problem": "12 + 4", "answer": 16}, {"problem": "12 + 5", "answer": 17},
        {"problem": "13 + 1", "answer": 14}, {"problem": "13 + 2", "answer": 15}, {"problem": "13 + 3", "answer": 16},
        {"problem": "13 + 4", "answer": 17}, {"problem": "13 + 5", "answer": 18}, {"problem": "14 + 1", "answer": 15},
        {"problem": "14 + 2", "answer": 16}, {"problem": "14 + 3", "answer": 17}, {"problem": "14 + 4", "answer": 18},
        {"problem": "14 + 5", "answer": 19}, {"problem": "15 + 1", "answer": 16}, {"problem": "15 + 2", "answer": 17},
        {"problem": "15 + 3", "answer": 18}, {"problem": "15 + 4", "answer": 19}, {"problem": "16 + 1", "answer": 17}
    ],
    5: [ # Level 5: 2-digit (10-20) +/- 1-digit mixed
        {"problem": "10 + 6", "answer": 16}, {"problem": "11 + 6", "answer": 17}, {"problem": "12 + 6", "answer": 18},
        {"problem": "13 + 6", "answer": 19}, {"problem": "10 + 7", "answer": 17}, {"problem": "11 + 7", "answer": 18},
        {"problem": "12 + 7", "answer": 19}, {"problem": "10 + 8", "answer": 18}, {"problem": "11 + 8", "answer": 19},
        {"problem": "10 + 9", "answer": 19}, {"problem": "11 - 1", "answer": 10}, {"problem": "12 - 2", "answer": 10},
        {"problem": "13 - 3", "answer": 10}, {"problem": "14 - 4", "answer": 10}, {"problem": "15 - 5", "answer": 10},
        {"problem": "16 - 6", "answer": 10}, {"problem": "17 - 7", "answer": 10}, {"problem": "18 - 8", "answer": 10},
        {"problem": "19 - 9", "answer": 10}, {"problem": "20 - 1", "answer": 19}, {"problem": "15 - 2", "answer": 13},
        {"problem": "16 - 3", "answer": 13}, {"problem": "17 - 4", "answer": 13}, {"problem": "18 - 5", "answer": 13},
        {"problem": "19 - 6", "answer": 13}, {"problem": "12 - 1", "answer": 11}, {"problem": "13 - 2", "answer": 11},
        {"problem": "14 - 3", "answer": 11}, {"problem": "15 - 4", "answer": 11}, {"problem": "16 - 5", "answer": 11}
    ]
}

def populate():
    print("🧹 Clearing existing problems...")
    docs = db.collection("problems").limit(500).stream()
    for doc in docs:
        doc.reference.delete()
        
    total_added = 0
    
    for level, problems in HARDCODED_PROBLEMS.items():
        batch = db.batch()
        for p in problems:
            doc_ref = db.collection("problems").document()
            batch.set(doc_ref, {
                "level": level,
                "problem": p["problem"],
                "answer": p["answer"],
                "created_at": firestore.SERVER_TIMESTAMP
            })
            total_added += 1
            
        batch.commit()
        print(f"✅ Level {level}: Added {len(problems)} problems")
        time.sleep(1) # Avoid rate limits
        
    print(f"✨ Successfully populated {total_added} problems!")

if __name__ == "__main__":
    populate()
