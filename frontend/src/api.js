const headers = {
  "Content-Type": "application/json",
};

async function request(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = "Request failed.";

    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return response.json();
}

export function createDrill(payload) {
  return request("/api/drills", payload);
}

export function reviewAttempt(payload) {
  return request("/api/review", payload);
}

export function sendChat(payload) {
  return request("/api/chat", payload);
}
