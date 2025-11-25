# Math AI Tutor for Kids 🎓

7세 아이들을 위한 AI 산수 퀴즈 앱입니다.
Google Cloud Vertex AI (Gemini)를 활용하여 아이가 문제를 틀렸을 때 상황에 맞는 애니메이션 원리를 설명해줍니다.

## Project Structure

- **/backend**: Python FastAPI application (deployed on Cloud Run)
  - Uses Vertex AI for generating explanations
- **/frontend**: Next.js application (deployed on Firebase Hosting)
  - Uses Tailwind CSS and Framer Motion for UI/UX

## Getting Started

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the server:
   ```bash
   uvicorn main:app --reload
   ```

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

Check `.env` files in both directories for required configuration (Google Cloud Project ID, Firebase Config, etc.).
