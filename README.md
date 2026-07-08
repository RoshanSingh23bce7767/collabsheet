# Collabsheet — Real-Time Collaborative Spreadsheet

Collabsheet is a lightweight, real-time, collaborative spreadsheet application—*Google Sheets, stripped to its bones.* It is designed with a premium, minimal SaaS interface inspired by modern tools like Linear, Notion, and Airtable.

Built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Firebase**.

---

## 1. Core Architectural Decisions

### State Placement & Storage
To achieve low latency, real-time multiplayer coordination, and high build safety, state is segregated into distinct layers based on its persistence requirements:

| Concern | Database / Tech | Rationale & Justification |
| :--- | :--- | :--- |
| **Persisted cell data** | **Cloud Firestore** | Structured, per-cell subcollections enable fine-grained, independent document writes. |
| **Presence & Cursors** | **Realtime Database** | Ephemeral, low-latency syncing. Leverages the native `onDisconnect()` hook to auto-delete cursor indicators on window close. |
| **Local edit buffer** | **React State (Cell)** | Permits instantaneous optimistic UI renders as the user types, isolating cell renders before database commit. |
| **Derived values** | **Client-side Engine** | Cell formula evaluations are calculated deterministically on the client to avoid server call costs and round-trip delays. |
| **User Identity** | **Firebase Auth + Cookies** | Synchronized client-to-server auth tokens to support Server Action mutations and SSR listing. |

### The Core Decision: One Firestore Document Per Cell
Instead of storing the entire spreadsheet grid as a single JSON matrix inside one database document, **each cell is stored as an independent document** under the subcollection path:
`documents/{docId}/cells/{cellId}` (e.g., `documents/my-sheet-123/cells/A1`).

* **Zero Contention**: Two users editing `A1` and `B3` concurrently will write to separate documents. There is no risk of overwriting each other's cell contents, eliminating grid-wide collision errors.
* **Fewer Re-renders**: Using real-time snapshot filters (`docChanges()`), the client listener only receives the delta of modified cells. Only the affected `Cell` components re-render, optimizing performance.
* **Trade-off**: Higher document read/write counts. We mitigate this by only querying and subscribing to used cells. Empty cells are not created in the database and are deleted if cleared.

---

## 2. Conflict Handling & Resolution

**Model: Last-Write-Wins (LWW) per cell**

* **Edits on different cells**: Merged immediately.
* **Concurrent edits on the same cell**: The write that arrives last on the Firebase server wins, ordered by `serverTimestamp()`. 
* **Optimistic Local States**: When typing, changes are rendered instantly in the local cell buffer. When committed, the cell transitions to `saving` and then `saved`. If an authoritative server snapshot returns a different value, the local cell reconciles to the server state.

---

## 3. Custom Formula Engine (`src/lib/formula.ts`)

The formula engine parses cell equations client-side and recalculates dynamically whenever cell values are updated.

### Supported Grammar
* **References**: Direct cell coordinates (e.g. `=A1`, `=B12`), case-insensitive.
* **Arithmetic**: Basic math operations (`+`, `-`, `*`, `/`) with nested parentheses `( )`, respecting PEMDAS order of operations.
* **Functions**: `=SUM(A1:A3)` range queries.

### Implementation Details
* **Recursive Evaluation & Cycle Detection**: Cell references are evaluated recursively. The resolver tracks visited cells in a recursion stack. If a cycle is detected (e.g., `A1` contains `=B1` and `B1` contains `=A1`), it returns `#CIRC!` and terminates safely.
* **Error Handling**: Math errors (like dividing by zero) or syntax issues return `#ERR!`.
* **Zero `eval()` Usage**: The arithmetic parser is written as a custom **Recursive-Descent Parser**. Sanitizing tokens into distinct numbers and operators avoids execution vectors, resolving potential security concerns.

---

## 4. What Was Deliberately Left Out

To focus on concurrency correctness, architectural isolation, and build safety, several features were left out:
* **Character-Level Operational Transformation (OT) / CRDTs**: Spreadsheet cells are typically short strings committed atomically. Character-level merging (like Google Docs) is an overkill that increases system complexity without matching utility. LWW per-cell is the industry standard for lightweight cells.
* **Offline Sync Queue**: The app prioritizes active, real-time collaboration. Queueing edits while offline can lead to massive merge conflicts once a user reconnects.
* **Cross-User Undo/Redo History**: Implementing global undo history across concurrent users adds a significant state-machine cost that is outside the scope of this lightweight sheet.
* **Extensive Excel Library**: We only built `=SUM` and PEMDAS arithmetic to focus on robust implementation rather than shallow library breadth.

---

## 5. Local Setup

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* A **Firebase Project** with Firestore and Realtime Database enabled

### Installation Steps
1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd collabsheet
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local` and enter your Firebase SDK details:
   ```bash
   cp .env.example .env.local
   ```

4. **Run the local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Deployment

This application is deployed on **Vercel**:

* **Website URL**: [https://spreadsheet-eight-sage.vercel.app](https://spreadsheet-eight-sage.vercel.app)

