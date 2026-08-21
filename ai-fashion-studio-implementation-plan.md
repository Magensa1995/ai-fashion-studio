# AI Fashion Studio — Implementation Plan

> **For agentic workers:** Thực hiện tuần tự theo checkbox. Mỗi task là một review gate độc lập; không bắt đầu task phụ thuộc khi task trước chưa đạt Definition of Done. Khi triển khai bằng Codex, dùng `superpowers:subagent-driven-development` hoặc `superpowers:executing-plans` và `superpowers:verification-before-completion`.

**Goal:** Xây dựng web app cá nhân giúp quản lý sản phẩm/người mẫu, tạo và chỉnh ảnh thời trang bằng AI, quản lý thư viện ảnh, rồi tạo và lưu bài viết/caption từ kết quả.

**Architecture:** Modular monolith trong một Next.js App Router application. Business logic được tách theo feature và application service; PostgreSQL/Prisma, Cloudflare R2 và OpenAI được truy cập qua adapter phía server. V1 chạy đồng bộ có kiểm soát, chưa có Redis/worker; schema và service boundary cho phép bổ sung queue và social publishing khi có bằng chứng cần thiết.

**Tech stack:** Next.js, TypeScript strict, Tailwind CSS, shadcn/ui, PostgreSQL, Prisma, Auth.js Credentials, Cloudflare R2, OpenAI Responses/Image API, Vitest, React Testing Library, Playwright.

**Spec source:** Cuộc trò chuyện “Lập kế hoạch AI Fashion Studio”, ngày 21-08-2026.

**Plan status:** Chờ chủ dự án phê duyệt. Tài liệu này không chứa implementation code.

## Global constraints và quyết định đã chốt

- Đây là project mới, một owner duy nhất; không multi-tenant, team, billing, subscription hay RBAC phức tạp.
- Đăng nhập bằng email + password; không có đăng ký công khai.
- Ba workflow ảnh V1: Product → AI Model, Model + Product → Virtual Try-On, và chỉnh ảnh/thay background.
- Mỗi generation cho chọn 1 hoặc 2 ảnh; mặc định 2.
- Product Library và Model Library tách riêng; một entity có thể có nhiều ảnh tham chiếu.
- Có Generation History, favorite, download, retry, generate similar và preset ở mức V1 hợp lý.
- Có Post CRUD, trạng thái Draft/Published/Archived, editor gọn nhẹ và AI hỗ trợ title/description/caption/hashtags. Không xây page builder hoặc CMS phức tạp.
- Chuẩn bị data model cho Facebook/Instagram/Zalo nhưng V1 không đăng trực tiếp ra social.
- Desktop-first, responsive đầy đủ; đường đi chính vẫn sử dụng được trên mobile.
- Không thêm Redux/Zustand nếu Server Components, URL state và React local state đã đủ.
- Không thêm Redis/BullMQ, microservice, event bus hay worker riêng trước khi spike chứng minh request đồng bộ không đáp ứng được.
- Không lưu binary trong PostgreSQL; ảnh nằm ở R2, database chỉ giữ metadata và quan hệ.
- Không gọi SDK AI hoặc R2 trực tiếp từ page/component; mọi I/O đi qua service/adapter phía server.
- Sau mỗi phase, app phải build, migration chạy được và các test liên quan phải pass.
- Không rewrite phần không liên quan, không thêm dependency nếu nền tảng hoặc dependency hiện có giải quyết được.

## Deployment decision record

**Target V1:** Railway Hobby, gồm một Next.js web service và một Railway PostgreSQL service trong cùng project; Cloudflare R2 tiếp tục là object storage; domain tùy chỉnh là tùy chọn. Railway Hobby hiện có mức cam kết tối thiểu 5 USD/tháng và khoản đó được tính vào resource usage. R2 có free tier 10 GB-month/tháng, 1 triệu Class A và 10 triệu Class B operations/tháng. Chi phí AI là usage-based và dự kiến lớn hơn hosting nếu generate thường xuyên.

**Lý do chọn:** một dashboard cho deploy, database, secret và logs; runtime Node tương thích trực tiếp với Prisma/Auth.js/Next.js; không cần vận hành VPS; không phải xử lý khác biệt edge runtime trong V1; có thể scale service hoặc tách worker sau này.

**Không chọn làm mặc định:**

- Vercel + Neon: vận hành khá đơn giản nhưng thêm một nhà cung cấp và giới hạn/runtime cần đánh giá riêng cho job AI dài; chi phí production có thể cao hơn nhu cầu một người dùng.
- Cloudflare Workers + Neon: có khả năng rất rẻ, nhưng tăng rủi ro tương thích Node/Prisma/OpenNext và phân tán vận hành; chỉ đánh giá lại nếu mục tiêu bắt buộc là gần 0 USD/tháng.
- VPS tự quản: giá thấp nhưng phát sinh patching, backup, monitoring và phục hồi sự cố.

**Tài liệu kiểm chứng tại thời điểm lập plan:** [Railway pricing](https://docs.railway.com/pricing/plans), [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), [OpenAI GPT Image 2](https://developers.openai.com/api/docs/models/gpt-image-2).

---

# 1. Architecture summary

## 1.1 System context

```text
Browser
  → Next.js App Router
    → Server Components / Server Actions / Route Handlers
      → Feature application services
        → Prisma → Railway PostgreSQL
        → StorageAdapter → Cloudflare R2
        → ImageGenerationProvider → OpenAI
        → TextGenerationProvider → OpenAI
```

`src/app` chỉ routing, layout và composition. Business rules nằm trong `src/features`; integration code nằm trong `src/server`. Client component chỉ dùng khi có tương tác thực sự.

## 1.2 Domain modules

| Module      | Responsibility                                                 | Không chịu trách nhiệm          |
| ----------- | -------------------------------------------------------------- | ------------------------------- |
| Auth        | Owner login, session, route protection                         | Registration, roles, teams      |
| Products    | Product CRUD, category/status, product reference images        | File binary, AI call            |
| Models      | Model profile CRUD, reference images                           | Virtual try-on execution        |
| Media       | Upload metadata, signed access, lifecycle, orphan cleanup      | Product/post business rules     |
| Generations | Workflow validation, prompt snapshot, lifecycle, retry/results | Provider-specific request shape |
| Presets     | Reusable generation settings                                   | Provider credentials            |
| Posts       | Draft/editor/status/media relationships                        | Direct social publishing        |
| AI adapters | Translate canonical requests to provider APIs                  | UI state, database presentation |

## 1.3 Data model

All primary keys use CUID/UUID consistently; timestamps stored UTC; owner scope retained through `userId` even with one user to avoid ambiguous ownership.

| Entity           | Key fields and constraints                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User             | id, unique normalized email, passwordHash, name, createdAt, updatedAt                                                                                                                                                                                                                                                                                                    |
| Product          | id, userId, name, unique slug per user, description, category, status ACTIVE/ARCHIVED, createdAt, updatedAt, deletedAt nullable                                                                                                                                                                                                                                          |
| ProductImage     | id, productId, mediaId, type FRONT/BACK/DETAIL/OTHER, sortOrder; unique productId+mediaId                                                                                                                                                                                                                                                                                |
| ModelProfile     | id, userId, name, description, status ACTIVE/ARCHIVED, createdAt, updatedAt, deletedAt nullable                                                                                                                                                                                                                                                                          |
| ModelImage       | id, modelProfileId, mediaId, sortOrder; unique modelProfileId+mediaId                                                                                                                                                                                                                                                                                                    |
| Media            | id, userId, kind UPLOAD/PRODUCT/MODEL/GENERATED/POST, storageKey unique, originalFilename, mimeType, sizeBytes, width, height, checksum nullable, metadata JSON, createdAt, deletedAt nullable                                                                                                                                                                           |
| Generation       | id, userId, type PRODUCT_TO_MODEL/VIRTUAL_TRY_ON/IMAGE_EDIT/BACKGROUND_REPLACE/VARIATION, status PENDING/PROCESSING/COMPLETED/FAILED, productId nullable, modelProfileId nullable, sourceMediaId nullable, presetId nullable, promptData JSON, provider, providerModel, aspectRatio, imageCount 1..2, providerRequestId nullable, errorCode/message nullable, timestamps |
| GeneratedImage   | id, generationId, mediaId, sortOrder, isFavorite, createdAt; unique generationId+sortOrder                                                                                                                                                                                                                                                                               |
| GenerationPreset | id, userId, name, type, settings JSON, isDefault, createdAt, updatedAt; unique name per user                                                                                                                                                                                                                                                                             |
| Post             | id, userId, title, unique slug per user, excerpt, content, status DRAFT/PUBLISHED/ARCHIVED, coverMediaId nullable, sourceGenerationId nullable, socialMetadata JSON nullable, createdAt, updatedAt, publishedAt nullable, deletedAt nullable                                                                                                                             |
| PostMedia        | postId, mediaId, sortOrder; composite key postId+mediaId                                                                                                                                                                                                                                                                                                                 |

Hard delete chỉ dùng cho join record hoặc orphan chưa bao giờ được tham chiếu. Product, model, post và media dùng soft delete để tránh phá lịch sử. Xóa object R2 được thực hiện sau khi xác nhận không còn tham chiếu và phải idempotent.

## 1.4 API and application interfaces

CRUD nội bộ dùng Server Actions gọi application service. Route Handlers dành cho upload, generation lifecycle, download và endpoint cần polling.

| Method/path                        | Purpose                                      | Response behavior                                       |
| ---------------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| POST `/api/media/upload-url`       | Validate metadata, tạo signed upload intent  | media draft + signed URL/fields                         |
| POST `/api/media/complete`         | Verify R2 object và finalize Media           | finalized media summary                                 |
| POST `/api/generations`            | Validate canonical request, persist, execute | generation summary; không lộ provider config            |
| GET `/api/generations/[id]`        | Poll status và results                       | owner-scoped snapshot                                   |
| POST `/api/generations/[id]/retry` | Retry failed generation idempotently         | generation mới liên kết nguồn cũ                        |
| POST `/api/posts/ai-draft`         | Generate text suggestions                    | structured title/caption/hashtags; không tự ghi đè post |
| GET `/api/media/[id]/download`     | Authorize và redirect/sign download          | short-lived access                                      |

Mọi mutation cần authentication, owner scoping, schema validation, normalized application errors và audit-friendly server logs. Không nhận `provider`, API key, storage key hoặc userId từ client làm nguồn tin cậy.

## 1.5 AI design

Canonical provider boundary gồm `generate`, `edit`, `supports` và normalized result/error. Initial provider là OpenAI; image model cấu hình server-side, mặc định `gpt-image-2`. Text caption dùng một model tiết kiệm được cấu hình qua environment, mặc định `gpt-5-mini`; model name không hard-code trong feature logic.

AI spike phải test riêng ba capability: product fidelity, model identity/pose fidelity, background replacement. “Virtual try-on” trong V1 là generative try-on, không cam kết đo size/fit hoặc giữ tuyệt đối từng pixel. Nếu OpenAI không đạt acceptance set, thay adapter/provider trước khi xây UI hoàn chỉnh, không che lỗi bằng prompt phức tạp.

Mỗi generation lưu prompt/settings snapshot, provider/model, input references và output metadata để retry/reproduce. API key chỉ ở server. Log không chứa ảnh base64, signed URL dài hạn, password hoặc raw secrets.

## 1.6 Authentication and authorization

Auth.js Credentials + password hash mạnh. Không có `/register`; owner được tạo bằng seed/bootstrap command dùng biến môi trường một lần. Session cookie HttpOnly, Secure ở production, SameSite=Lax; CSRF protection theo framework; mọi query bắt buộc lọc `userId` từ session. Thay đổi password ở V1 qua owner bootstrap/rotation procedure, không xây email reset.

## 1.7 State management and UI structure

- Server state: Server Components, Prisma queries, revalidation, URL search params cho search/filter/page.
- Form state: native form/server action hoặc React local state; validation schema dùng chung server/client khi phù hợp.
- Studio draft: local state trong page; chỉ preset được persist. Không thêm global store.
- Generation progress: polling có backoff và dừng khi terminal state; không WebSocket ở V1.

```text
AppShell
├─ Sidebar: Dashboard, Studio, Products, Models, Generations, Media, Presets, Posts
├─ TopBar: quick actions, owner menu
└─ MainContent

StudioPage
├─ WorkflowSelector
├─ InputPanel: product/model/source/preset/scene/style/settings
└─ ResultPanel: status, output grid, favorite/download/edit/create-post
```

Desktop dùng hai cột controls/result. Mobile xếp preview/result trước, controls sau, generate action luôn dễ truy cập. Tất cả control có label, keyboard focus, empty/loading/error states và contrast phù hợp.

## 1.8 Error handling and observability

Error taxonomy: VALIDATION_ERROR, UNAUTHORIZED, NOT_FOUND, CONFLICT, INVALID_IMAGE, FILE_TOO_LARGE, UPLOAD_FAILED, STORAGE_ERROR, AI_PROVIDER_ERROR, AI_PROVIDER_TIMEOUT, AI_CONTENT_REJECTED, GENERATION_FAILED, DATABASE_ERROR. UI chỉ nhận code, message an toàn và `retryable`; server log giữ request/generation ID và nguyên nhân đã redact.

Generation transition hợp lệ: PENDING → PROCESSING → COMPLETED hoặc FAILED. Retry tạo generation mới để giữ lịch sử; không biến FAILED trở lại PROCESSING. Thao tác complete upload và provider callback/result persistence phải idempotent.

## 1.9 Testing strategy

- Unit: validation, slug, storage key, prompt builder, provider mapper, status transition, deletion reference checks.
- Integration: auth scoping, Prisma CRUD/relations, upload finalize, generation lifecycle, post lifecycle.
- Contract: fake AI/storage adapter cho success, timeout, rejection, malformed result, partial result.
- E2E: login → product → model → generation → favorite/edit → create post → AI caption → save.
- Manual visual QA: desktop widths 1440/1024 và mobile 390; keyboard navigation; large/portrait/landscape images.
- Không snapshot-test toàn bộ UI; ưu tiên behavior và risk.

---

# 2. Phase overview

| Phase | Goal                               | Exit gate                                                      |
| ----- | ---------------------------------- | -------------------------------------------------------------- |
| 0     | Foundation và deploy skeleton      | Build/test/migration/deploy smoke pass                         |
| 1     | Owner auth và shell                | Anonymous bị chặn; owner login/logout được                     |
| 2     | Media foundation                   | Upload/finalize/read/delete an toàn với R2                     |
| 3     | Products và Models                 | Hai library CRUD hoàn chỉnh, responsive                        |
| 4     | AI technical spike                 | Capability report + provider go/no-go                          |
| 5     | Generation core                    | Lifecycle, adapter, retry, history hoạt động với fake provider |
| 6     | Product-to-model và virtual try-on | Hai workflow chạy end-to-end với provider thật                 |
| 7     | Editing, presets và media UX       | Background/edit/variation/preset/favorite/download hoạt động   |
| 8     | Posts và AI copy                   | CRUD/editor/create-from-image/AI suggestions hoạt động         |
| 9     | Dashboard, hardening và release    | Critical E2E, security, backup/restore, production smoke pass  |

Mỗi phase kết thúc bằng build, typecheck, lint và test liên quan. Chỉ Phase 4 được phép dùng spike code tạm; code tạm không merge nếu không đạt conventions production.

---

# 3. Detailed task list

## Phase 0 — Foundation

### Task 0.1 — Project foundation and quality gates

- [ ] **Objective:** Tạo skeleton Next.js có conventions rõ, chưa có business feature.
- [ ] **Implementation description:** Khởi tạo App Router, TypeScript strict, Tailwind, shadcn/ui, import alias, lint/format, test runners, environment validation, route groups và feature/server folders. Ghi README cho local setup và lệnh kiểm tra.
- [ ] **Files affected:** `package.json`, lockfile, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/ui/*`, `src/config/env.ts`, `src/lib/*`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `README.md`.
- [ ] **Dependencies:** Không.
- [ ] **Edge cases:** Secret vô tình có prefix public; config thiếu khi build; test và app dùng alias khác nhau; hydration từ component không cần client.
- [ ] **Verification method:** clean install; lint; typecheck; unit test sample; production build; dev smoke.
- [ ] **Definition of Done:** Repository mới clone có thể setup bằng README, mọi quality gate pass, landing route render không lỗi.

### Task 0.2 — Database schema and migration baseline

- [ ] **Objective:** Thiết lập persistence reproducible cho toàn bộ V1.
- [ ] **Implementation description:** Tạo Prisma schema theo data model, indexes cho owner/status/createdAt/slug, DB singleton, migration đầu tiên, seed framework và test database workflow. Kiểm tra relation delete behavior trước khi migrate.
- [ ] **Files affected:** `prisma/schema.prisma`, `prisma/migrations/*`, `prisma/seed.ts`, `src/server/db/client.ts`, `src/server/db/test-client.ts`, `.env.example`, database test setup.
- [ ] **Dependencies:** 0.1.
- [ ] **Edge cases:** Dev hot reload mở nhiều connection; migration drift; JSON portability; unique slug với soft-deleted record; cascade làm mất history.
- [ ] **Verification method:** migrate từ database rỗng; seed; integration query tất cả relation; reset test DB; inspect generated SQL.
- [ ] **Definition of Done:** Migration chạy lặp lại được trên local/CI/Railway; schema và indexes đúng; không cascade phá dữ liệu lịch sử.

### Task 0.3 — Deployment skeleton and CI

- [ ] **Objective:** Chứng minh target Railway trước khi feature phụ thuộc platform.
- [ ] **Implementation description:** Cấu hình Railway build/start/health check, PostgreSQL binding, migration-on-release procedure, CI quality gates, environment inventory và production health endpoint không lộ secret. R2/OpenAI chỉ khai báo secret names ở phase này.
- [ ] **Files affected:** `railway.json` hoặc platform config tương đương, `Dockerfile` chỉ nếu native build không đủ, `.github/workflows/ci.yml`, `src/app/api/health/route.ts`, `.env.example`, `docs/deployment.md`.
- [ ] **Dependencies:** 0.1, 0.2.
- [ ] **Edge cases:** migration chạy đồng thời; health route phụ thuộc AI; preview dùng production DB; deploy thành công nhưng app không bind port.
- [ ] **Verification method:** CI từ clean checkout; deploy staging; health response; migration staging; rollback deployment thử nghiệm.
- [ ] **Definition of Done:** Staging URL hoạt động, DB kết nối, CI chặn build lỗi, deploy/rollback procedure được ghi rõ.

## Phase 1 — Authentication and app shell

### Task 1.1 — Owner bootstrap and credentials authentication

- [ ] **Objective:** Chỉ owner hợp lệ có session.
- [ ] **Implementation description:** Cấu hình Auth.js Credentials, email normalization, password verification, session, login/logout và bootstrap command idempotent. Không có registration route/action.
- [ ] **Files affected:** `src/server/auth/config.ts`, `src/server/auth/password.ts`, `src/server/auth/session.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/actions.ts`, `src/components/auth/login-form.tsx`, `scripts/bootstrap-owner.ts`, Prisma migration nếu auth yêu cầu.
- [ ] **Dependencies:** 0.2.
- [ ] **Edge cases:** owner chưa tồn tại; email khác hoa/thường; password sai; duplicate bootstrap; session hết hạn; timing leak cơ bản.
- [ ] **Verification method:** unit password/email; integration valid/invalid login; bootstrap hai lần; cookie security ở production.
- [ ] **Definition of Done:** Owner login/logout được, password không lưu/log plaintext, không có đường đăng ký công khai.

### Task 1.2 — Route protection and application shell

- [ ] **Objective:** Bảo vệ toàn bộ workspace và tạo navigation desktop/mobile.
- [ ] **Implementation description:** Protected dashboard route group, server-side redirect, AppShell, sidebar/topbar, mobile navigation, active state, error/not-found/loading boundaries.
- [ ] **Files affected:** `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/page.tsx`, `src/components/layout/*`, `src/app/error.tsx`, `src/app/not-found.tsx`, auth guard tests.
- [ ] **Dependencies:** 1.1.
- [ ] **Edge cases:** deep link anonymous; redirect loop; expired session khi mutation; mobile menu giữ focus; unauthorized API call.
- [ ] **Verification method:** integration guard; Playwright anonymous/authenticated paths; keyboard/mobile visual QA.
- [ ] **Definition of Done:** Mọi route/API private đều dựa trên session; navigation dùng được ở desktop và mobile.

## Phase 2 — Media foundation

### Task 2.1 — Storage adapter and key policy

- [ ] **Objective:** Tách R2 khỏi domain và chuẩn hóa object lifecycle.
- [ ] **Implementation description:** Định nghĩa StorageAdapter, R2 implementation, fake implementation, key format không chứa filename tin cậy, signed upload/read, content-type/size allowlist, metadata verification và normalized errors.
- [ ] **Files affected:** `src/server/storage/types.ts`, `src/server/storage/r2-adapter.ts`, `src/server/storage/fake-adapter.ts`, `src/server/storage/keys.ts`, `src/server/storage/index.ts`, `.env.example`, unit/contract tests.
- [ ] **Dependencies:** 0.1.
- [ ] **Edge cases:** traversal filename; MIME giả; duplicate complete; object thiếu; signed URL hết hạn; partial upload; provider trả image quá lớn.
- [ ] **Verification method:** contract suite chạy cho fake và R2 test bucket; key/property tests; unauthorized access test.
- [ ] **Definition of Done:** Feature code chỉ phụ thuộc interface; upload/read/delete idempotent và không lộ bucket credential.

### Task 2.2 — Media service and upload flow

- [ ] **Objective:** Tạo Media record nhất quán với object R2.
- [ ] **Implementation description:** Implement upload-intent/finalize flow, image dimension extraction phù hợp runtime, Media repository/service, signed preview/download và orphan cleanup command dry-run-first.
- [ ] **Files affected:** `src/features/media/schemas.ts`, `src/features/media/service.ts`, `src/features/media/repository.ts`, `src/app/api/media/upload-url/route.ts`, `src/app/api/media/complete/route.ts`, `src/app/api/media/[id]/download/route.ts`, `scripts/cleanup-orphan-media.ts`, integration tests.
- [ ] **Dependencies:** 0.2, 1.2, 2.1.
- [ ] **Edge cases:** DB commit thất bại sau upload; client finalize hai lần; zero-byte/corrupt image; HEIC/SVG không hỗ trợ; image dimension bomb; soft-deleted media.
- [ ] **Verification method:** upload ảnh hợp lệ; reject loại/kích thước sai; finalize retry; DB failure simulation; cleanup dry-run không xóa referenced object.
- [ ] **Definition of Done:** Owner upload và xem ảnh; database/object không lệch trong happy path; orphan có cách phát hiện an toàn.

### Task 2.3 — Reusable media UI

- [ ] **Objective:** Cung cấp uploader/picker/card dùng chung.
- [ ] **Implementation description:** Xây ImageUploader với progress/retry, MediaPicker, ImageCard, empty/loading/error states, responsive grid và accessible delete confirmation.
- [ ] **Files affected:** `src/features/media/components/*`, `src/components/shared/confirm-dialog.tsx`, `src/components/shared/empty-state.tsx`, component tests.
- [ ] **Dependencies:** 2.2.
- [ ] **Edge cases:** upload trùng; người dùng đóng modal giữa upload; network retry; ảnh portrait cực dài; broken signed URL.
- [ ] **Verification method:** component behavior tests; keyboard QA; throttled-network manual test; 390/1024/1440 visual QA.
- [ ] **Definition of Done:** Các feature sau có thể reuse upload/pick/display mà không biết R2.

## Phase 3 — Product and Model libraries

### Task 3.1 — Product domain and actions

- [ ] **Objective:** Product CRUD với nhiều ảnh tham chiếu.
- [ ] **Implementation description:** Validation, repository/service, slug collision policy, create/update/archive/restore, attach/detach/reorder ProductImage và owner-scoped actions.
- [ ] **Files affected:** `src/features/products/schemas.ts`, `repository.ts`, `service.ts`, `actions.ts`, `queries.ts`, related integration tests.
- [ ] **Dependencies:** 0.2, 1.2, 2.2.
- [ ] **Edge cases:** duplicate slug; ảnh đã attach; xóa ảnh đang dùng bởi generation; reorder duplicate; archived product được chọn generate.
- [ ] **Verification method:** CRUD integration; ownership denial; relation/deletion tests; validation table tests.
- [ ] **Definition of Done:** Business API product ổn định, soft delete giữ generation history, mọi mutation owner-scoped.

### Task 3.2 — Product library UI

- [ ] **Objective:** Quản lý product nhanh trên desktop và dùng được trên mobile.
- [ ] **Implementation description:** List/grid, search/filter/status pagination bằng URL, create/edit detail form, multi-image types FRONT/BACK/DETAIL/OTHER, reorder và archive confirmation.
- [ ] **Files affected:** `src/app/(dashboard)/products/*`, `src/features/products/components/*`, E2E/component tests.
- [ ] **Dependencies:** 2.3, 3.1.
- [ ] **Edge cases:** empty library; long name/description; unsaved form; stale edit; no FRONT image; pagination sau archive.
- [ ] **Verification method:** Playwright create/edit/filter/archive/restore; responsive and keyboard QA.
- [ ] **Definition of Done:** Owner hoàn thành Product CRUD và phân loại nhiều ảnh không cần thao tác DB/storage thủ công.

### Task 3.3 — Model domain and library UI

- [ ] **Objective:** Quản lý reusable model profiles và ảnh reference.
- [ ] **Implementation description:** Tạo schema/service/actions/query tương tự conventions Product nhưng không copy business logic mù quáng; list/detail/create/edit/archive, attach/reorder reference images.
- [ ] **Files affected:** `src/features/models/*`, `src/app/(dashboard)/models/*`, integration/E2E tests.
- [ ] **Dependencies:** 2.3 và conventions đã review ở 3.1/3.2.
- [ ] **Edge cases:** model không có ảnh; nhiều góc mặt/cơ thể; archived model trong generation cũ; detach reference đang dùng.
- [ ] **Verification method:** CRUD/ownership/relation tests; E2E; responsive visual QA.
- [ ] **Definition of Done:** Model Library hoàn chỉnh, component chung được reuse đúng mức, generation có thể query model active.

## Phase 4 — AI technical spike

### Task 4.1 — Acceptance dataset and evaluation rubric

- [ ] **Objective:** Định nghĩa “đủ tốt” trước khi tích hợp provider.
- [ ] **Implementation description:** Chuẩn bị bộ 5–10 sản phẩm đại diện (màu trơn, họa tiết, logo/chữ, nhiều chi tiết, set đồ), 2–3 model reference và rubric: garment identity, color/pattern/detail, body/face identity, artifact, composition, policy rejection, latency, cost. Không dùng ảnh không có quyền sử dụng.
- [ ] **Files affected:** `docs/ai/acceptance-rubric.md`, `docs/ai/test-cases.md`; asset test riêng không commit nếu nhạy cảm.
- [ ] **Dependencies:** Requirement và quyền dùng asset; không phụ thuộc UI.
- [ ] **Edge cases:** logo/text; translucent garment; multiple garments; occlusion; non-standard aspect; real-person consent.
- [ ] **Verification method:** Rubric có threshold định lượng/định tính và owner ký duyệt sample set.
- [ ] **Definition of Done:** Mọi provider có thể được chấm cùng tiêu chí; không còn khái niệm mơ hồ “ảnh đẹp”.

### Task 4.2 — OpenAI provider feasibility spike

- [ ] **Objective:** Kiểm chứng OpenAI đáp ứng ba workflow, 1/2 outputs, latency và cost.
- [ ] **Implementation description:** Dùng `gpt-image-2` qua official API để chạy matrix prompt/reference; ghi request constraints, output handling, lỗi/policy, latency p50/p95 mẫu nhỏ và cost per accepted output. Test tạo 2 ảnh bằng hai request nếu endpoint/model không bảo đảm hai output trong một call.
- [ ] **Files affected:** `work/ai-spike/*` (không production), `docs/ai/openai-spike-report.md`.
- [ ] **Dependencies:** 4.1, OpenAI API access/billing.
- [ ] **Edge cases:** rate limit Tier 1; content rejection; model tạo đúng phong cách nhưng sai sản phẩm; output malformed; timeout; hai output giống nhau.
- [ ] **Verification method:** Chạy toàn bộ matrix ít nhất hai lần ở sample khó; owner review contact sheet; so cost/latency với thresholds.
- [ ] **Definition of Done:** Quyết định GO, GO-with-limitations hoặc NO-GO có bằng chứng. NO-GO bắt buộc đánh giá provider thay thế trước Phase 5; không tiếp tục bằng giả định.

## Phase 5 — Generation core

### Task 5.1 — Canonical AI contracts and prompt builder

- [ ] **Objective:** Feature logic độc lập provider.
- [ ] **Implementation description:** Định nghĩa canonical inputs/results/capabilities, normalized error mapping, prompt builder theo workflow, reference ordering, fidelity constraints và model config server-side. Tạo fake provider deterministic.
- [ ] **Files affected:** `src/server/ai/types.ts`, `src/server/ai/provider.ts`, `src/server/ai/fake-provider.ts`, `src/features/generations/prompt-builder.ts`, `src/config/ai.ts`, unit/contract tests.
- [ ] **Dependencies:** 4.2 GO hoặc provider replacement decision.
- [ ] **Edge cases:** missing required model/source; incompatible preset; unknown aspect ratio; 2 outputs partial success; prompt injection trong description.
- [ ] **Verification method:** table-driven unit tests từng workflow; capability mismatch; safe prompt snapshot; fake provider contract.
- [ ] **Definition of Done:** Không feature nào cần biết SDK payload; canonical contract đủ cho cả generate/edit.

### Task 5.2 — Generation lifecycle service

- [ ] **Objective:** Persist và điều phối generation an toàn.
- [ ] **Implementation description:** Repository/service, request validation theo type, immutable prompt snapshot, transition guard, inline executor boundary, output ingestion R2/Media, retry-as-new-record và idempotency key.
- [ ] **Files affected:** `src/features/generations/schemas.ts`, `repository.ts`, `service.ts`, `executor.ts`, `transitions.ts`, integration tests.
- [ ] **Dependencies:** 2.2, 3.1, 3.3, 5.1.
- [ ] **Edge cases:** double submit; provider success nhưng R2 fail; output 1/2 fail; process crash giữa state; archived inputs; retry non-retryable error.
- [ ] **Verification method:** failure injection tại mỗi boundary; transition tests; idempotency concurrency test; DB/storage reconciliation check.
- [ ] **Definition of Done:** Fake provider chạy lifecycle end-to-end, terminal state luôn có dữ liệu hoặc error an toàn, retry không phá lịch sử.

### Task 5.3 — Generation API, polling and history

- [ ] **Objective:** Expose lifecycle cho UI và xem lại kết quả.
- [ ] **Implementation description:** Create/status/retry route handlers, polling backoff, history list/detail, type/status/product filters và shared GenerationCard/StatusBadge.
- [ ] **Files affected:** `src/app/api/generations/*`, `src/app/(dashboard)/generations/*`, `src/features/generations/components/*`, API/E2E tests.
- [ ] **Dependencies:** 1.2, 5.2.
- [ ] **Edge cases:** refresh khi PROCESSING; polling tab background; record không thuộc owner; deleted input; stale signed output URL.
- [ ] **Verification method:** API auth/schema tests; E2E fake generation refresh/retry/filter; network interruption test.
- [ ] **Definition of Done:** Owner tạo/poll/xem/retry generation fake; polling dừng đúng; history giữ đủ provenance.

### Task 5.4 — Production OpenAI adapters

- [ ] **Objective:** Thay fake bằng provider đã đạt spike mà không đổi domain.
- [ ] **Implementation description:** Image generate/edit adapter, text adapter, timeout/abort, retry policy chỉ cho lỗi transient, provider request ID, normalized usage/cost metadata và redacted logging.
- [ ] **Files affected:** `src/server/ai/openai-image-provider.ts`, `src/server/ai/openai-text-provider.ts`, `src/server/ai/error-map.ts`, `src/server/ai/index.ts`, contract tests, `.env.example`.
- [ ] **Dependencies:** 4.2, 5.1.
- [ ] **Edge cases:** 429; 5xx; timeout; policy rejection; response thiếu image; output URL hết hạn; API key invalid; duplicate retry gây tốn tiền.
- [ ] **Verification method:** mocked SDK contract suite và opt-in sandbox smoke với spend cap; log inspection không có secret/base64.
- [ ] **Definition of Done:** Adapter pass contract suite; một sandbox generation thật lưu được R2 và metadata/cost traceable.

## Phase 6 — Core Studio workflows

### Task 6.1 — Shared Studio shell and request composer

- [ ] **Objective:** Một UI nhất quán cho ba workflow, không tạo mega-form khó bảo trì.
- [ ] **Implementation description:** Workflow selector, product/model/source pickers, preset hook point, scene/style/lighting/composition, aspect ratios được provider hỗ trợ, count 1/2 mặc định 2, additional prompt, validation summary và result panel.
- [ ] **Files affected:** `src/app/(dashboard)/studio/page.tsx`, `src/features/generations/components/studio/*`, component tests.
- [ ] **Dependencies:** 3.2, 3.3, 5.3.
- [ ] **Edge cases:** đổi workflow giữ state không hợp lệ; product/model archived sau khi chọn; submit hai lần; mobile keyboard; empty libraries.
- [ ] **Verification method:** component state matrix; accessibility; responsive visual QA; API request snapshot không chứa provider config.
- [ ] **Definition of Done:** Shell compose canonical request hợp lệ cho từng workflow; count default/choice chính xác.

### Task 6.2 — Product → AI Model workflow

- [ ] **Objective:** Tạo fashion image từ product-only.
- [ ] **Implementation description:** Enforce product image selection/reference priority, model description generated by prompt controls (không ModelProfile), launch generation, display 1/2 outputs và actions follow-up.
- [ ] **Files affected:** Studio workflow components, generation schemas/prompt tests nếu acceptance yêu cầu, E2E spec.
- [ ] **Dependencies:** 5.4, 6.1.
- [ ] **Edge cases:** product chỉ có detail image; background transparent; output không giữ pattern; partial two-output failure.
- [ ] **Verification method:** fake-provider E2E và acceptance smoke provider thật trên 3 sample; compare prompt snapshot.
- [ ] **Definition of Done:** Owner chọn product, tạo 1 hoặc 2 ảnh, refresh vẫn xem được kết quả/error và retry hợp lệ.

### Task 6.3 — Model + Product virtual try-on workflow

- [ ] **Objective:** Ghép product lên reusable model reference.
- [ ] **Implementation description:** Chọn model/product và reference subset, prompt ưu tiên identity/garment fidelity, hiển thị disclosure giới hạn generative try-on, launch/result flow giống 6.2.
- [ ] **Files affected:** Studio virtual-try-on components, prompt builder/tests, E2E spec, user-facing help copy.
- [ ] **Dependencies:** 6.1, 5.4, spike threshold đạt.
- [ ] **Edge cases:** multiple people; crop thiếu thân; pose che garment; conflicting references; face drift; sensitive/real-person policy.
- [ ] **Verification method:** fake E2E; provider acceptance set; manual comparison garment/model rubric.
- [ ] **Definition of Done:** Workflow end-to-end và đạt threshold đã phê duyệt; giới hạn không bị mô tả sai như fitting chính xác.

## Phase 7 — Editing, presets and media experience

### Task 7.1 — Image edit, background replace and variation

- [ ] **Objective:** Dùng generated/uploaded image làm nguồn cho chỉnh sửa tiếp.
- [ ] **Implementation description:** Source picker, operation-specific controls, edit prompt, optional product/model context, new Generation linked by sourceMediaId; “Generate similar” map sang VARIATION.
- [ ] **Files affected:** Studio edit components, generation validation/prompt builder, history actions, E2E tests.
- [ ] **Dependencies:** 6.2, 6.3.
- [ ] **Edge cases:** source deleted; edit làm đổi garment; unsupported transparency/aspect; recursive chain; invalid source ownership.
- [ ] **Verification method:** background/variation fake E2E; provider smoke; provenance chain query.
- [ ] **Definition of Done:** Edit không ghi đè ảnh gốc; output/history liên kết nguồn; error/retry nhất quán.

### Task 7.2 — Presets

- [ ] **Objective:** Lưu và reuse cấu hình thường dùng.
- [ ] **Implementation description:** Preset CRUD, JSON schema version, type compatibility, default per workflow, apply-to-Studio và copy-on-generation snapshot.
- [ ] **Files affected:** `src/features/presets/*`, `src/app/(dashboard)/presets/*`, Studio integration, tests.
- [ ] **Dependencies:** 5.1, 6.1.
- [ ] **Edge cases:** schema version cũ; preset incompatible workflow; rename collision; deleted preset trong history; default duplicate.
- [ ] **Verification method:** CRUD/integration; apply preset; migration/unknown-field test; E2E default behavior.
- [ ] **Definition of Done:** Preset có thể thay đổi/xóa mà generation cũ vẫn reproducible từ snapshot.

### Task 7.3 — Favorites, Media Library and safe deletion

- [ ] **Objective:** Quản lý, chọn và tải lại asset đã tạo/upload.
- [ ] **Implementation description:** Favorite toggle, media filters/kind/search, detail/provenance, signed download, reference-aware delete/archive và orphan report.
- [ ] **Files affected:** `src/app/(dashboard)/media/*`, media/generation actions/components, deletion service, tests.
- [ ] **Dependencies:** 2.3, 5.3.
- [ ] **Edge cases:** media dùng làm post cover; concurrent favorite; broken R2 object; delete generated output; large history.
- [ ] **Verification method:** ownership/reference integration tests; E2E favorite/download/delete blocked; pagination performance smoke.
- [ ] **Definition of Done:** Owner tìm, favorite, tải và reuse ảnh; không thể xóa vật lý asset còn tham chiếu.

## Phase 8 — Posts and AI copy

### Task 8.1 — Post domain and CRUD

- [ ] **Objective:** Lưu bài viết theo lifecycle đơn giản, sẵn metadata social sau này.
- [ ] **Implementation description:** Validation/repository/service/actions, unique slug, DRAFT/PUBLISHED/ARCHIVED transitions, cover/gallery relations, sourceGenerationId, soft delete và socialMetadata versioned JSON nhưng không publisher.
- [ ] **Files affected:** `src/features/posts/schemas.ts`, `repository.ts`, `service.ts`, `actions.ts`, `queries.ts`, integration tests.
- [ ] **Dependencies:** 0.2, 2.2.
- [ ] **Edge cases:** publish content rỗng; slug collision; cover deleted; unpublish policy; source generation deleted; metadata malformed.
- [ ] **Verification method:** CRUD/status/ownership/relation tests; deletion protection.
- [ ] **Definition of Done:** Domain post có lifecycle rõ, không chứa API/token social, history media an toàn.

### Task 8.2 — Post list and lightweight editor

- [ ] **Objective:** Create/edit/delete/archive post dễ dùng mà không thêm rich-text framework nặng.
- [ ] **Implementation description:** List/filter/search, form title/excerpt/content, Markdown hoặc plain-text preview, cover/gallery picker, autosave chỉ khi có acceptance rõ; mặc định explicit Save để tránh race. Create Post from generated image pre-fills source/cover.
- [ ] **Files affected:** `src/app/(dashboard)/posts/*`, `src/features/posts/components/*`, E2E/component tests.
- [ ] **Dependencies:** 7.3, 8.1.
- [ ] **Edge cases:** unsaved navigation; long caption; malicious Markdown/HTML; stale concurrent tab; mobile textarea; archived media.
- [ ] **Verification method:** E2E create/edit/status/archive/delete/create-from-image; XSS sanitization test; responsive/keyboard QA.
- [ ] **Definition of Done:** Owner hoàn thành Post CRUD và tạo post từ image; rendered content không thực thi HTML nguy hiểm.

### Task 8.3 — AI copy assistant

- [ ] **Objective:** Tạo suggestion title, description, Facebook/Instagram/Zalo caption và hashtag từ product/generation context.
- [ ] **Implementation description:** Structured request/result schema, prompt templates tiếng Việt, channel/tone/length controls, text provider call, cost/error handling; suggestion hiển thị preview và chỉ chèn khi owner xác nhận.
- [ ] **Files affected:** `src/features/posts/ai-copy-service.ts`, `ai-copy-prompts.ts`, `src/app/api/posts/ai-draft/route.ts`, editor assistant components, tests.
- [ ] **Dependencies:** 5.4 text adapter, 8.2.
- [ ] **Edge cases:** hallucinated price/material; duplicate hashtag; provider refusal/timeout; overwrite manual edit; prompt injection từ product description; channel limit.
- [ ] **Verification method:** unit prompt/schema; mocked provider; E2E generate/reject/apply; manual Vietnamese quality set.
- [ ] **Definition of Done:** Suggestions grounded in supplied fields, không tự publish/overwrite, failure không làm mất draft.

## Phase 9 — Dashboard, hardening and release

### Task 9.1 — Dashboard and quick actions

- [ ] **Objective:** Mở app là thấy trạng thái và bắt đầu workflow trong 1–2 click.
- [ ] **Implementation description:** Counts Products/Models/AI Images/Posts, recent generations/products/posts, quick Generate/Create Post, empty states; query giới hạn và chạy song song hợp lý.
- [ ] **Files affected:** `src/app/(dashboard)/page.tsx`, `src/features/dashboard/queries.ts`, dashboard components/tests.
- [ ] **Dependencies:** Phases 3, 5, 8.
- [ ] **Edge cases:** empty DB; failed recent generation; soft-deleted counts; large table scan; broken thumbnail.
- [ ] **Verification method:** query correctness fixtures; explain/index smoke; responsive visual QA.
- [ ] **Definition of Done:** Dashboard đúng dữ liệu, không N+1 rõ ràng, quick actions đến đúng context.

### Task 9.2 — Security, reliability and cost controls

- [ ] **Objective:** Giảm rủi ro mất dữ liệu, lộ secret và chi phí ngoài ý muốn.
- [ ] **Implementation description:** Review auth/CSRF/owner scope, upload allowlist and max size, AI concurrency per owner, idempotency, request timeout, rate limit hợp lý, redaction, secure headers, spend alerts, R2 CORS, Railway usage limit/alerts và secret rotation runbook.
- [ ] **Files affected:** security/config/middleware files, services, `docs/security.md`, `docs/operations.md`, tests.
- [ ] **Dependencies:** Tất cả feature mutation hoàn tất.
- [ ] **Edge cases:** double-click tốn hai calls; signed URL leak; oversized decompression; brute-force login; log chứa prompt nhạy cảm; retry storm.
- [ ] **Verification method:** abuse-case integration tests; dependency audit; manual headers/cookie/CORS check; controlled concurrent requests.
- [ ] **Definition of Done:** Không có known high-severity issue; cost guard/alerts bật; runbook chứa rotate/revoke/recover.

### Task 9.3 — Backup, restore and data reconciliation

- [ ] **Objective:** Có thể phục hồi database và phát hiện lệch DB–R2.
- [ ] **Implementation description:** Chọn Railway backup policy phù hợp ngân sách, document/export backup, restore rehearsal vào staging, Media↔R2 reconciliation dry-run, retention/orphan policy và recovery order.
- [ ] **Files affected:** `scripts/reconcile-media.ts`, `docs/backup-restore.md`, operational config/tests.
- [ ] **Dependencies:** 2.2, 9.2.
- [ ] **Edge cases:** DB restored nhưng R2 đã xóa; backup chứa password hash; cleanup chạy trên sai environment; timezone/timestamp mismatch.
- [ ] **Verification method:** restore staging từ backup; reconciliation report fixture; destructive mode yêu cầu explicit environment/confirmation.
- [ ] **Definition of Done:** Restore rehearsal thành công, RPO/RTO thực tế được ghi, cleanup không chạy destructive mặc định.

### Task 9.4 — V1 end-to-end release gate

- [ ] **Objective:** Xác nhận workflow V1 hoàn chỉnh trên production-like environment.
- [ ] **Implementation description:** Chạy quality gates, critical E2E, AI acceptance subset, mobile/desktop QA, accessibility smoke, failure/retry, deploy staging→production, production smoke và rollback rehearsal. Ghi known limitations/release notes.
- [ ] **Files affected:** `tests/e2e/v1-critical-path.spec.ts`, remaining test fixtures, `docs/release-checklist.md`, `CHANGELOG.md`.
- [ ] **Dependencies:** 9.1–9.3 và toàn bộ phase trước.
- [ ] **Edge cases:** production env thiếu; seed owner sai; provider quota; migration partial; stale cache; signed URL domain/CORS.
- [ ] **Verification method:** Critical path: Login → Product → Model → Virtual Try-On (2 ảnh) → chọn/favorite → Background Replace → Create Post → Zalo caption → edit → save/publish; sau đó smoke download/history/relogin.
- [ ] **Definition of Done:** Tất cả gate pass có bằng chứng; owner xác nhận output; rollback và restore path đã kiểm chứng; known limitations được chấp nhận.

---

# 4. Risks

| Risk                                              | Impact     | Mitigation / trigger                                                                                                                                          |
| ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI không giữ đúng họa tiết/logo/cấu trúc sản phẩm | Rất cao    | Phase 4 trước UI; acceptance dataset; provider adapter; mô tả giới hạn; NO-GO nếu dưới threshold                                                              |
| Model identity/pose drift                         | Cao        | Multiple references có kiểm soát; rubric; không hứa identity tuyệt đối; review real-person consent                                                            |
| Request AI dài hoặc client disconnect             | Cao        | Persist PENDING trước call; polling; timeout; reconciliation. Nếu tỷ lệ timeout/process interruption vượt ngưỡng vận hành, thêm queue/worker trong plan riêng |
| Provider success nhưng lưu R2/DB thất bại         | Cao        | Idempotency, staged persistence, checksum/verification, orphan/reconciliation job                                                                             |
| Chi phí AI tăng do double submit/retry            | Cao        | Disable duplicate submit, idempotency key, per-owner concurrency, retry transient only, usage metadata và spend alerts                                        |
| Xóa media phá post/generation history             | Cao        | Reference graph, soft delete, block physical deletion, cleanup dry-run                                                                                        |
| Credentials brute force hoặc secret leak          | Cao        | Strong hash, login throttling, secure cookies, server-only env, log redaction, rotation runbook                                                               |
| Ảnh upload độc hại/quá lớn                        | Cao        | Allowlist MIME/extension/signature, byte/dimension limit, không render SVG active, signed direct upload, metadata verify                                      |
| Railway resource cost vượt 5 USD                  | Trung bình | Usage alerts/limits, đo memory/CPU/DB, image không proxy qua app, R2 direct delivery; review monthly                                                          |
| Railway single region/vendor outage               | Trung bình | Backup/restore, documented redeploy, R2 tách storage; chấp nhận downtime V1 vì one-user                                                                       |
| Migration drift/data loss                         | Cao        | Forward-only reviewed migrations, staging restore rehearsal, backup trước destructive migration                                                               |
| Free/low-cost tier terms thay đổi                 | Trung bình | Không dựa vào free tier như correctness requirement; kiểm tra pricing trước launch và hàng quý                                                                |
| Post AI bịa thông tin sản phẩm                    | Trung bình | Grounding fields, instruction không invent, structured output, human apply step, không auto-publish                                                           |
| Social schema over-engineering                    | Trung bình | Chỉ `socialMetadata` versioned + channel suggestions; không token/account/publisher tables ở V1                                                               |
| UI phức tạp trên mobile                           | Trung bình | Desktop-first; critical path mobile; controls progressive disclosure; visual QA widths cố định                                                                |
| Dependency churn                                  | Trung bình | Pin lockfile; ưu tiên platform primitives; upgrade riêng, không trộn feature; audit trước release                                                             |

Queue/worker là migration risk lớn nhất sau V1. Trigger rõ ràng để lập plan riêng: provider request thường xuyên vượt runtime/reliability target; cần background completion khi client đóng; cần concurrency/retry scheduling; hoặc generation volume tăng. Khi trigger xảy ra, giữ GenerationService và thay InlineExecutor bằng durable executor, không rewrite domain/UI.

---

# 5. Open questions

Không còn câu hỏi nào chặn kiến trúc hoặc bắt đầu Phase 0 sau khi plan được phê duyệt. Các mục sau là acceptance/configuration decisions, giải quyết đúng review gate thay vì tự mở rộng scope:

1. **AI quality threshold:** owner phê duyệt rubric và sample set ở Task 4.1; đây là điều kiện trước khi khóa provider.
2. **Provider fallback:** nếu OpenAI `gpt-image-2` NO-GO cho virtual try-on, chọn provider chuyên dụng bằng một spike/decision record mới; không âm thầm đổi provider.
3. **Post content format:** mặc định Markdown/plain text có sanitized preview, không rich-text page builder. Nếu bắt buộc WYSIWYG, phê duyệt dependency và task riêng trước 8.2.
4. **Image limits:** implementation đề xuất ban đầu JPEG/PNG/WebP, tối đa 20 MB/file và giới hạn dimension an toàn; owner có thể hạ mức theo ảnh thực tế trước Task 2.2.
5. **Published semantics:** V1 `PUBLISHED` là trạng thái nội bộ, không đồng nghĩa đã đăng social. Cần giữ wording này trong UI.
6. **Custom domain:** không chặn release; có thể dùng Railway domain trước, thêm domain sau khi production smoke pass.
7. **Backup retention/RPO:** chốt theo khả năng của Railway plan và giá tại Task 9.3; tối thiểu phải có export/restore rehearsal trước release.

Out of scope V1: public registration, password reset email, multi-user/team/RBAC, billing, campaign entity, batch generation, direct social OAuth/publishing/scheduling, analytics marketing, brand kit, advanced image canvas/masking, real-time collaboration, mobile-native app.

---

# 6. Recommended implementation order

1. **0.1 → 0.2 → 0.3:** Chứng minh project, schema và Railway deployment ngay; tránh hoàn thành feature rồi mới phát hiện platform mismatch.
2. **1.1 → 1.2:** Thiết lập owner/session trước mọi dữ liệu riêng tư và mutation.
3. **2.1 → 2.2 → 2.3:** Media là dependency chung của Product, Model, Generation và Post.
4. **3.1 → 3.2 → 3.3:** Hoàn tất hai input library và conventions CRUD.
5. **4.1 → 4.2:** Giải quyết rủi ro lớn nhất — chất lượng/cost/latency AI — trước khi đầu tư Studio UI.
6. **5.1 và 5.4 có thể chuẩn bị song song sau GO; sau đó 5.2 → 5.3:** Contract trước orchestration và UI; fake provider giữ test deterministic.
7. **6.1 → 6.2 → 6.3:** Shared shell trước, product-only đơn giản hơn trước virtual try-on.
8. **7.1 → 7.2 → 7.3:** Mở rộng từ kết quả đã ổn định sang edit/preset/library actions.
9. **8.1 → 8.2 → 8.3:** Post domain/editor trước AI copy; AI suggestion luôn là optional human-in-the-loop.
10. **9.1 → 9.2 → 9.3 → 9.4:** Dashboard sau khi có dữ liệu thật; security/operations/restore trước final release gate.

Sau mỗi task: review diff theo đúng scope, chạy verification được liệt kê, cập nhật checkbox và commit nhỏ có ý nghĩa. Sau mỗi phase: chạy full lint/typecheck/build/test, deploy staging smoke, ghi lại limitation mới; không chuyển phase nếu Definition of Done chưa đạt hoặc nếu Phase 4 trả NO-GO mà chưa có provider decision thay thế.
