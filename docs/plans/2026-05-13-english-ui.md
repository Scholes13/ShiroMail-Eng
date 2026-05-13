# English UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make ShiroMail default to English and replace visible hardcoded Chinese text in the frontend pages currently leaking through English mode.

**Architecture:** Keep the existing React/i18next architecture. Change the default language to `en-US`, keep the existing locale switch, and replace hardcoded Chinese literals in affected page components with English strings to avoid broad refactors.

**Tech Stack:** React, TypeScript, Vite, i18next, Docker.

---

### Task 1: Default Language

**Files:**
- Modify: `frontend/src/lib/preferences.ts`
- Modify: `frontend/src/lib/i18n.ts`

**Step 1: Change language normalization defaults**

Set unknown or missing language values to `en-US`.

**Step 2: Change i18n fallback**

Set `fallbackLng` to `en-US` and ensure lazy fallback loading references `en-US`.

**Step 3: Type check/build frontend**

Run: `cd frontend && npm run build`

Expected: build succeeds.

---

### Task 2: Replace Hardcoded Chinese In Domain Page

**Files:**
- Modify: `frontend/src/features/user/pages/domains-page.tsx`

**Step 1: Replace visible labels and messages**

Translate hardcoded Chinese dialog titles, labels, buttons, validation messages, notices, and placeholders in the domain management page.

**Step 2: Search page for remaining Chinese**

Run: `rg "[\u4e00-\u9fff]" frontend/src/features/user/pages/domains-page.tsx`

Expected: no user-facing Chinese remains, except comments if any.

---

### Task 3: Replace Other Hardcoded Chinese UI Strings

**Files:**
- Modify: `frontend/src/features/user/pages/*.tsx`
- Modify: `frontend/src/features/admin/**/*.tsx`

**Step 1: Search for hardcoded Chinese**

Run: `rg "[\u4e00-\u9fff]" frontend/src/features frontend/src/components`

Expected: list of remaining hardcoded Chinese strings.

**Step 2: Translate user-facing literals**

Replace visible hardcoded Chinese strings with English. Avoid changing tests unless assertions require updates.

**Step 3: Re-run search**

Run: `rg "[\u4e00-\u9fff]" frontend/src/features frontend/src/components`

Expected: remaining matches are locale files, tests, or non-visible comments only.

---

### Task 4: Rebuild And Restart Local Docker Image

**Files:**
- Inspect: `Dockerfile`
- Inspect: `.env`

**Step 1: Build frontend and image**

Run: `docker build -t shiromail:local .`

Expected: image builds successfully.

**Step 2: Restart compose**

Run: `docker compose up -d`

Expected: app, worker, mysql, and redis are running.

**Step 3: Verify endpoint**

Run: `Invoke-WebRequest http://127.0.0.1:5173 -UseBasicParsing`

Expected: HTTP 200.

---
