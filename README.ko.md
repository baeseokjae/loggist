# Loggist

Claude Code의 비용과 세션을 한눈에. OpenTelemetry 기반 모니터링 대시보드.

> **[English](./README.md)** | 한국어

---

## 목차

- [왜 Loggist인가](#왜-loggist인가)
- [주요 기능](#주요-기능)
- [Quick Start](#quick-start)
- [사전 요구사항](#사전-요구사항)
- [기술 스택](#기술-스택)
- [개발 환경 설정](#개발-환경-설정)
- [프로젝트 구조](#프로젝트-구조)
- [테스트](#테스트)
- [아키텍처](#아키텍처)
- [라이선스](#라이선스)

---

## 왜 Loggist인가

Claude Code를 쓰다 보면 "이번 달 얼마나 쓰고 있지?", "방금 세션이 왜 이렇게 비쌌지?" 같은 질문이 생긴다. Loggist는 이 질문에 답하기 위한 **3가지 핵심 기능**을 제공한다.

| 기능 | 설명 |
|------|------|
| **세션 기반 비용 분석** | "이 세션이 왜 $3인가?" — 세션별 API 호출, 도구 사용, 토큰 소비를 인과관계로 추적 |
| **비용 예산 + 선제 알림** | 일/주/월 예산 설정, 80%/100% 도달 시 알림. 대시보드를 열지 않아도 동작 |
| **원클릭 설치** | `docker compose up -d` 한 줄로 모든 인프라가 자동 구성 |

**타겟 사용자:** Claude Code를 일상적으로 사용하는 개발자 (1인 ~ 소규모 팀). "이번 달 얼마 쓰고 있는지"가 궁금한 사람.

---

## 주요 기능

**비용 예산 (Budget)**
일/주/월 단위 예산 설정, 게이지 차트로 현재 사용량 시각화, 임계값(80%/100%) 도달 시 알림.

**대시보드 개요 (Overview)**
KPI 카드로 총 비용, 토큰 사용량, 캐시 히트율을 한눈에 확인.

**세션 분석 (Sessions)**
세션 목록과 드릴다운 뷰. 세션별 비용, 토큰 소비, 도구 사용 내역을 인과관계로 추적.

**실시간 타임라인 (Timeline)**
SSE(Server-Sent Events) 기반 실시간 이벤트 스트림. Loki tail WebSocket에서 N명의 클라이언트로 fan-out.

**로그 검색 (Search)**
필터 패널과 결과 테이블. 시간 범위, 이벤트 타입, 프로필별 필터링 지원.

---

## Quick Start

### Step 1: Claude Code OTEL 설정

`~/.claude/settings.json` (또는 프로필별 `~/.claude-b/settings.json`)에 아래 내용을 추가한다.

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4317",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
    "OTEL_METRICS_INCLUDE_SESSION_ID": "true",
    "OTEL_LOG_USER_PROMPTS": "1",
    "OTEL_LOG_TOOL_DETAILS": "1"
  }
}
```

> **Warning**: `OTEL_METRICS_INCLUDE_SESSION_ID`가 `"true"`가 아니면 세션 기반 분석이 동작하지 않는다.

### Step 2: Loggist 실행

```bash
git clone https://github.com/<owner>/loggist.git
cd loggist
cp .env.example .env
# .env에서 LOGGIST_JWT_SECRET 수정
docker compose -f docker-compose.yml up -d
```

### Step 3: 접속

`http://localhost:3001`로 접속. 최초 접속 시 로그인 비밀번호 설정 화면이 표시된다.

---

## 사전 요구사항

- Docker & Docker Compose
- Claude Code (OTEL 텔레메트리 지원 버전)

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19, Vite 6, TanStack Query v5, zustand 5, Tailwind CSS v4, Radix UI |
| Backend | Hono 4, better-sqlite3, jose (JWT), ws |
| Infra | Docker Compose, OTel Collector, Prometheus, Loki |
| Dev Tools | TypeScript 5.7+, Vitest, Biome, tsup, pnpm |

---

## 개발 환경 설정

```bash
pnpm install
cp .env.example .env
# .env에서 LOGGIST_JWT_SECRET 수정

# 인프라(OTel Collector, Prometheus, Loki) + 앱 개발 서버 실행
docker compose up -d
pnpm dev
```

`docker compose up -d`는 `docker-compose.override.yml`이 자동 적용되어 인프라 서비스만 실행된다 (Loggist 앱 컨테이너는 비활성화). `pnpm dev`가 Vite(HMR) + Hono 서버를 로컬에서 띄운다.

- 클라이언트: http://localhost:5173 (Vite가 `/api` 요청을 서버로 프록시)
- 서버: http://localhost:3001

프로덕션 배포 시에는 override 없이 앱까지 컨테이너로 실행한다.

```bash
docker compose -f docker-compose.yml up -d
```

### 환경 변수

`.env.example`을 복사해 `.env`를 만들고 필요한 값을 수정한다.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `LOGGIST_JWT_SECRET` | `your-secret-key-here` | JWT 서명 시크릿 (반드시 변경) |
| `PROMETHEUS_URL` | `http://localhost:9090` | Prometheus 주소 |
| `LOKI_URL` | `http://localhost:3100` | Loki 주소 |

---

## 프로젝트 구조

```
loggist/
├── src/
│   ├── client/              # React SPA
│   │   ├── components/      # 공통 UI 컴포넌트 (layout, ui)
│   │   ├── hooks/           # 커스텀 React hooks
│   │   ├── pages/           # 페이지별 컴포넌트 (budget, overview, sessions, ...)
│   │   ├── stores/          # zustand 상태 스토어
│   │   └── lib/             # 유틸리티
│   └── server/              # Hono 서버
│       ├── db/              # SQLite 초기화 및 쿼리
│       ├── middleware/       # auth, rate-limit, security-headers
│       ├── realtime/        # Loki tail WebSocket + SSE fan-out
│       ├── routes/          # API 라우트 (budget, sessions, metrics, logs, events)
│       ├── services/        # Prometheus/Loki 클라이언트
│       └── workers/         # 백그라운드 워커 (budget-checker)
├── config/                  # OTel Collector, Prometheus, Loki 설정 파일
├── tests/                   # 서버 사이드 테스트 (Vitest)
├── docker-compose.yml
└── .env.example
```

---

## 테스트

```bash
pnpm test              # 전체 테스트
pnpm test:watch        # watch 모드
pnpm test:coverage     # 커버리지 리포트
pnpm lint              # Biome lint
```

138개 테스트, 91%+ 커버리지 (서버 사이드).

---

## 아키텍처

```
Claude Code CLI
  │ gRPC (:4317)
  ▼
OTel Collector
  ├──→ Prometheus (:9090) ── 메트릭
  └──→ Loki (:3100) ──────── 구조화 로그
          │
          ▼
     Loggist (:3001)
     ├── REST API (Prometheus/Loki 프록시)
     ├── SSE (Loki tail → 클라이언트 브로드캐스트)
     ├── SQLite (예산, 알림)
     └── React SPA
```

Prometheus와 Loki는 Docker internal network(`backend`)에만 노출되어 외부에서 직접 접근할 수 없다. Loggist 서버만 두 네트워크(`frontend`, `backend`)에 모두 속해 프록시 역할을 한다.

---

## 라이선스

MIT License
