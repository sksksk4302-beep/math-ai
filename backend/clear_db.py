import os
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud import firestore as google_firestore

# Initialize Firestore (same logic as main.py)
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
KEY_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

if not firebase_admin._apps:
    if KEY_PATH and os.path.exists(KEY_PATH):
        cred = credentials.Certificate(KEY_PATH)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized successfully (Key File)")
    else:
        try:
            firebase_admin.initialize_app(options={'projectId': PROJECT_ID})
            print(f"✅ Firebase initialized successfully (ADC) - Project: {PROJECT_ID}")
        except Exception as e:
            print(f"⚠️ Warning: Firebase init failed: {e}")

try:
    db = google_firestore.Client(project=PROJECT_ID, database='math-ai')
    print("✅ Connected to Firestore database: math-ai")
except Exception as e:
    print(f"❌ Firestore connection failed: {e}")
    exit(1)

def delete_collection(coll_ref, batch_size):
    docs = coll_ref.limit(batch_size).stream()
    deleted = 0

    for doc in docs:
        print(f'Deleting doc {doc.id} => {doc.to_dict()}')
        doc.reference.delete()
        deleted = deleted + 1

    if deleted >= batch_size:
        return delete_collection(coll_ref, batch_size)

def clear_data():
    print("🗑️ Clearing 'users' collection...")
    delete_collection(db.collection("users"), 10)
    
    print("🗑️ Clearing 'history' collection...")
    delete_collection(db.collection("history"), 10)
    
    # Also clear sessions if any exist from testing
    print("🗑️ Clearing 'sessions' collection...")
    delete_collection(db.collection("sessions"), 10)

    print("✨ All specified collections cleared!")

if __name__ == "__main__":
    clear_data()
