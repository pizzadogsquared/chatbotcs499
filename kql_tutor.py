from langchain_litellm import ChatLiteLLM
from sys import *
import os

from dotenv import load_dotenv;
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

load_dotenv()

messages = [
    SystemMessage(""),
    HumanMessage(""),
    AIMessage("")
]
#response = model.invoke(messages)

my_api_key = os.getenv("API_KEY")

llm = ChatLiteLLM(
    model="litellm_proxy/llama-3.3-70b-instruct-quantized",
	api_key = my_api_key,
    api_base="https://llm-api.cyverse.ai")


history = [SystemMessage(content="You are a helpful assistant. "
            "Use prior conversation only as background context. "
            "Do NOT mention previous messages, earlier questions, or conversation history "
            "unless the user explicitly asks you to. "
            "Answer the current question directly and concisely.")]


print("How can I help you today? Type EXIT to exit conversation.")
while True:
	user_input = input("Me >>> ")
	if user_input.lower() == "exit":
		break
	history.append(HumanMessage(content=user_input))
	ai_response = llm.invoke(history)
	print(f"Robot >>> {ai_response.content}")

print("Goodbye!")
