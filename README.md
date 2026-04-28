# KQL Tutor

This project now includes:

- A Python FastAPI backend that wraps AI-VERDE's OpenAI-compatible API
- A React frontend for KQL drills, answer review, and tutoring chat
- The original CLI tutor flow, still available through `python kql_tutor.py`

## Why this setup

The AI-VERDE docs describe an API at `https://llm-api.cyverse.ai/v1` and a model listing endpoint at `https://llm-api.cyverse.ai/v1/models`. This app keeps the API key on the backend and lets the React client call a local tutoring API instead of exposing credentials in the browser.

## Environment

Your existing `.env` can use either uppercase or lowercase keys:

- `LLM_API_KEY` or `api_key`
- `LLM_BASE_URL` or `api_base`
- `MODEL` or `model`

If no base URL is provided, the backend defaults to:

`https://llm-api.cyverse.ai/v1`

## Run the backend

```bash
pip install -r requirements.txt
uvicorn kql_tutor:app --reload
```

The backend will be available at `http://localhost:8000`.

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs at `http://localhost:5173` and proxies `/api` requests to the backend.

## Main frontend features

- Generate topic-specific KQL drills
- Practice in `hint`, `tutor`, or `quiz` mode
- Submit answers for accuracy and efficiency feedback
- Track session attempts, average review time, and mode usage
- Continue a guided tutoring conversation for each drill
