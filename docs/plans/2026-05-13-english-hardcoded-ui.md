# English Hardcoded UI Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove hardcoded Chinese from ShiroMail frontend source outside the Chinese locale file.

**Architecture:** Keep the existing app structure and translate strings in-place for pages, shared components, and tests. Leave `frontend/src/locales/zh-CN.ts` intact because it is the intentional Chinese translation source.

**Tech Stack:** React, TypeScript, Vite, Vitest, Docker Compose.

---

### Task 1: Inventory Remaining Chinese

**Files:**
- Inspect: `frontend/src/**/*.ts`
- Inspect: `frontend/src/**/*.tsx`
- Exclude: `frontend/src/locales/zh-CN.ts`

**Step 1: Search for Chinese text**

Run a Unicode Han character search over `frontend/src`.

**Step 2: Classify matches**

Keep `frontend/src/locales/zh-CN.ts` unchanged. Translate all other runtime source and test matches unless a match is required as compatibility input parsing.

### Task 2: Translate Source and Tests

**Files:**
- Modify matching non-locale files under `frontend/src/features`
- Modify matching non-locale files under `frontend/src/components`
- Modify matching non-locale test files under `frontend/src`

**Step 1: Translate user-facing labels**

Replace titles, descriptions, button labels, placeholders, empty states, validation labels, and feedback messages with concise English.

**Step 2: Preserve behavior strings when needed**

If a Chinese string is used to recognize backend/external data, keep it only when removing it would change behavior.

**Step 3: Update tests**

Update test expectations and queries to match translated UI labels.

### Task 3: Verify Cleanup

**Step 1: Search again**

Run the Chinese text search again and verify remaining matches are only in `frontend/src/locales/zh-CN.ts` or documented compatibility checks.

**Step 2: Build frontend**

Run `npm run build` from `frontend` and fix any TypeScript or build failures.

### Task 4: Rebuild Local Docker App

**Step 1: Rebuild image**

Run `docker build -t shiromail:local .` from `J:\Project\ShiroMail`.

**Step 2: Restart stack**

Run `docker compose down` then `docker compose up -d`.

**Step 3: Smoke test**

Verify `http://127.0.0.1:5173` returns HTTP 200.
