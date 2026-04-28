import os
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()

MODEL_NAME = os.getenv("MODEL") or os.getenv("model") or "llama-3.3-70B-instruct-quantized"
DEFAULT_BASE_URL = "https://llm-api.cyverse.ai/v1"

BASE_SYSTEM_PROMPT = """
You are a patient KQL tutor for students.

Your goal is to improve student accuracy and efficiency in answering KQL questions.

General rules:
- Be beginner-friendly unless asked otherwise.
- Do not invent schema details; state assumptions clearly.
- Prefer clear, correct, efficient KQL.
- Explain mistakes and improvements clearly.
- Use plain, clean formatting.
- Prefer short paragraphs over heavy markdown.
- Only use numbered lists when the order matters, and put each item on its own line.
- Only use bullet lists when they improve clarity, and put each item on its own line.
- Do not wrap normal prose in **bold** markers.
- Only use fenced code blocks for actual KQL or code snippets.
- When showing KQL, always use triple backticks with `kusto`.
"""

MODE_PROMPTS = {
    "hint": """
Current mode: Hint Mode.
Do not give the full answer immediately.
Give small nudges, ask guiding questions, and help the student think through the problem.
Only provide the full query if the student asks for it.
""",
    "tutor": """
Current mode: Tutor Mode.
Provide a helpful explanation, a correct KQL query, and one efficiency improvement tip.
""",
    "quiz": """
Current mode: Quiz Mode.
Act like a tutor who wants the student to try first.
If the student asks a question, encourage them to write their own query attempt.
If they provide an attempt, grade it, explain errors, and show an improved answer.
""",
}

DRILL_SYSTEM_PROMPT = """
You create short KQL practice drills for students.

Return exactly one practice prompt with:
1. A realistic analytics scenario.
2. The target skill being practiced.
3. 2-4 success criteria.
4. An optional hint that does not reveal the full answer.

Keep the prompt concise and classroom-friendly.
"""

REVIEW_SYSTEM_PROMPT = """
You review a student's KQL answer.

Return feedback in markdown with these sections:
## Accuracy Score
Provide a score from 1-10.
## Efficiency Score
Provide a score from 1-10.
## What Works
Call out what is correct.
## What To Fix
Explain mistakes or risks.
## Improved Query
Show a cleaner answer if needed.
## Next Speed Tip
Give one concise efficiency habit to practice.
"""

ModeName = Literal["hint", "tutor", "quiz"]


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    mode: ModeName = "tutor"
    prompt: str = Field(min_length=1)
    history: list[ChatTurn] = Field(default_factory=list)


class DrillRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=120)
    difficulty: Literal["beginner", "intermediate", "advanced"] = "beginner"
    focus: str = Field(default="accuracy and efficiency", max_length=200)


class ReviewRequest(BaseModel):
    question: str = Field(min_length=1)
    student_answer: str = Field(min_length=1)
    mode: ModeName = "tutor"


def get_env(name: str, fallback: str | None = None) -> str | None:
    return os.getenv(name) or os.getenv(name.lower()) or fallback


def get_client() -> OpenAI:
    base_url = get_env("LLM_BASE_URL", DEFAULT_BASE_URL)
    api_key = get_env("LLM_API_KEY") or get_env("API_KEY")

    if not api_key:
        raise ValueError(
            "Missing API key. Please set LLM_API_KEY or api_key in your environment."
        )

    return OpenAI(base_url=base_url, api_key=api_key)


def build_system_prompt(mode: str) -> str:
    mode_prompt = MODE_PROMPTS.get(mode, MODE_PROMPTS["tutor"])
    return BASE_SYSTEM_PROMPT + "\n" + mode_prompt


def prepare_messages_for_aiverde(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    """AI-VERDE's Bedrock-backed models may reject conversations that start with a
    system message. Fold the system prompt into the first user turn instead.
    """
    if not messages:
        return messages

    first_message = messages[0]
    if first_message["role"] != "system":
        return messages

    system_prompt = first_message["content"].strip()
    remaining_messages = messages[1:]

    if not remaining_messages:
        return [{"role": "user", "content": system_prompt}]

    first_non_system = remaining_messages[0]
    if first_non_system["role"] == "user":
        merged_content = (
            "Follow these tutoring instructions for this conversation:\n"
            f"{system_prompt}\n\n"
            "Student request:\n"
            f"{first_non_system['content']}"
        )
        return [
            {"role": "user", "content": merged_content},
            *remaining_messages[1:],
        ]

    return [
        {
            "role": "user",
            "content": (
                "Follow these tutoring instructions for this conversation:\n"
                f"{system_prompt}"
            ),
        },
        *remaining_messages,
    ]


def chat_completion(messages: list[dict[str, str]], temperature: float = 0.3) -> str:
    client = get_client()
    prepared_messages = prepare_messages_for_aiverde(messages)
    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=prepared_messages,
        temperature=temperature,
    )
    content = response.choices[0].message.content
    return content or ""


def build_chat_messages(request: ChatRequest) -> list[dict[str, str]]:
    messages = [{"role": "system", "content": build_system_prompt(request.mode)}]
    messages.extend(turn.model_dump() for turn in request.history)
    messages.append({"role": "user", "content": request.prompt})
    return messages


def create_drill(request: DrillRequest) -> str:
    prompt = f"""
Topic: {request.topic}
Difficulty: {request.difficulty}
Learning focus: {request.focus}

Generate one KQL practice drill for this student.
"""
    return chat_completion(
        [
            {"role": "system", "content": DRILL_SYSTEM_PROMPT},
            {"role": "user", "content": prompt.strip()},
        ],
        temperature=0.6,
    )


def review_attempt(request: ReviewRequest) -> str:
    prompt = f"""
Question:
{request.question}

Student answer:
{request.student_answer}

Tutoring mode:
{request.mode}
"""
    return chat_completion(
        [
            {"role": "system", "content": REVIEW_SYSTEM_PROMPT},
            {"role": "user", "content": prompt.strip()},
        ],
        temperature=0.2,
    )


def choose_mode() -> str:
    print("Choose a mode:")
    print("1. hint")
    print("2. tutor")
    print("3. quiz")

    while True:
        choice = input("Mode: ").strip().lower()

        if choice in ["1", "hint"]:
            return "hint"
        if choice in ["2", "tutor"]:
            return "tutor"
        if choice in ["3", "quiz"]:
            return "quiz"

        print("Please choose hint, tutor, or quiz.")


def chat() -> None:
    mode = choose_mode()
    messages: list[dict[str, str]] = [{"role": "system", "content": build_system_prompt(mode)}]

    print(f"\nKQL Tutor CLI [{mode} mode]")
    print("Type 'exit' to quit.")
    print("Type 'reset' to clear history.")
    print("Type 'mode' to switch tutoring mode.\n")

    while True:
        user_input = input("You: ").strip()

        if not user_input:
            continue

        if user_input.lower() == "exit":
            print("Goodbye.")
            break

        if user_input.lower() == "reset":
            messages = [{"role": "system", "content": build_system_prompt(mode)}]
            print("Conversation reset.\n")
            continue

        if user_input.lower() == "mode":
            mode = choose_mode()
            messages = [{"role": "system", "content": build_system_prompt(mode)}]
            print(f"\nSwitched to {mode} mode.\n")
            continue

        messages.append({"role": "user", "content": user_input})

        try:
            assistant_reply = chat_completion(messages)
            print(f"\nTutor:\n{assistant_reply}\n")
            messages.append({"role": "assistant", "content": assistant_reply})
        except Exception as error:
            print(f"\nError: {error}\n")


app = FastAPI(
    title="KQL Tutor API",
    description="AI-VERDE powered tutoring backend for KQL practice.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "model": MODEL_NAME}


@app.get("/api/modes")
def get_modes() -> dict[str, Any]:
    return {"modes": list(MODE_PROMPTS.keys())}


@app.post("/api/chat")
def chat_api(request: ChatRequest) -> dict[str, Any]:
    try:
        reply = chat_completion(build_chat_messages(request))
        return {"reply": reply}
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/api/drills")
def drills_api(request: DrillRequest) -> dict[str, Any]:
    try:
        drill = create_drill(request)
        return {"drill": drill}
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/api/review")
def review_api(request: ReviewRequest) -> dict[str, Any]:
    try:
        feedback = review_attempt(request)
        return {"feedback": feedback}
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


if __name__ == "__main__":
    chat()
