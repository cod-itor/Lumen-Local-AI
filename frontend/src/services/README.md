# Services (data access layer)

Every page and component gets data **only** through the async functions in this
folder. Right now they return mock data from `src/mocks`. To hook up the real
API, change the function body, keep the signature, and leave the components
alone:

```ts
// before
export async function getChatHistory(): Promise<ChatSummary[]> {
  return mockChatHistory;
}

// after
export async function getChatHistory(): Promise<ChatSummary[]> {
  return apiFetch<ChatSummary[]>("/chats");
}
```

`apiFetch` in `./api.ts` is the single place to add the base URL, auth headers,
and error handling.
