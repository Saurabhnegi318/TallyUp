# TallyUp — Group Expense & Trip Split System

A lightweight, zero-paywall group expense splitting and debt simplification platform inspired by Tricount and Splitwise.

## Tech Stack

- **Backend:** Java 21, Spring Boot 3.3.5, Spring Cloud Gateway, Spring Data JPA, Spring Data Redis, Spring Kafka, OpenFeign, JJWT
- **Databases & Messaging:** PostgreSQL (Database-per-service: `group_db`, `expense_db`, `settlement_db`), Redis Cache, Apache Kafka (KRaft mode)
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Axios, Lucide React
- **Containerization & CI/CD:** Multi-stage Docker, Docker Compose, GitHub Actions, GHCR

---

## Architecture & Monorepo Structure

```text
TallyUp/
├── .github/workflows/ci-cd.yml      # CI/CD: Maven test, Docker build & push to GHCR
├── docker-compose.yml              # Local Postgres, Redis, Kafka (KRaft), & 4 services
├── docker/
│   └── init-databases.sql          # Multi-DB bootstrap script for Postgres
├── pom.xml                         # Root parent POM managing all microservices
├── mvnw / mvnw.cmd                 # Maven wrapper
├── api-gateway/                    # Port 8080: Spring Cloud Gateway (JWT validation, CORS)
├── group-service/                  # Port 8081: Users, Auth (BCrypt+JWT), Groups, Virtual Members
├── expense-service/                # Port 8082: Expense Ledger, BigDecimal split math, Kafka Producer
├── settlement-service/             # Port 8083: Net Balance Engine, Min-Cash-Flow graph reduction, Redis Cache
└── frontend/                       # Port 5173: React + TypeScript + Vite + Tailwind CSS
```

---

## Getting Started

### Prerequisites

- **Java 21** (`java -version`)
- **Maven 3.9+** (or use `./mvnw`)
- **Node.js 20+ & npm**
- **Docker & Docker Compose**

---

### 1. Build and Run Tests Locally

Test all 4 Spring Boot microservices simultaneously from the root:

```bash
./mvnw clean test
```

Build the React frontend:

```bash
cd frontend
npm install
npm run build
```

---

### 2. Run Entire Stack with Docker Compose

To spin up all databases, Kafka, Redis, the 4 microservices, and the React frontend in one command:

```bash
docker compose up --build
```

#### Exposed Ports & Services:

| Service | Port | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | `http://localhost:5173` | React Dashboard UI |
| **API Gateway** | `http://localhost:8080` | Public API Entrypoint |
| **Group Service** | `http://localhost:8081` | Auth, Groups, Members |
| **Expense Service** | `http://localhost:8082` | Expenses, Splits, Kafka Producer |
| **Settlement Service** | `http://localhost:8083` | Balances, Debt Simplifier, Redis |
| **PostgreSQL** | `5432` | `group_db`, `expense_db`, `settlement_db` |
| **Redis** | `6379` | Fast balance cache (`group:balances:{groupId}`) |
| **Kafka (KRaft)** | `9092` | Event bus (`tallyup.expense.events`) |

---

### 3. Run Locally for Active Development

1. **Start Infrastructure Only:**
   ```bash
   docker compose up -d postgres redis kafka
   ```

2. **Run Backend Services (in separate terminals or IntelliJ IDEA):**
   ```bash
   # Terminal 1: Group Service
   cd group-service && ../mvnw spring-boot:run

   # Terminal 2: Expense Service
   cd expense-service && ../mvnw spring-boot:run

   # Terminal 3: Settlement Service
   cd settlement-service && ../mvnw spring-boot:run

   # Terminal 4: API Gateway
   cd api-gateway && ../mvnw spring-boot:run
   ```

3. **Run Frontend Dev Server:**
   ```bash
   cd frontend
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## Core Algorithms Implemented

1. **Penny-Exact Equal Split (`expense-service`):**
   * Uses `BigDecimal` with `RoundingMode.DOWN`.
   * Remainder pennies are deterministically allocated to the first participant so $\sum (\text{owed\_amount}) \equiv \text{total\_amount}$ to the cent.
2. **Greedy Min-Cash-Flow Debt Simplification (`settlement-service`):**
   * Computes Net Balance per member across expenses and settlements.
   * Creditors and Debtors are matched using two `PriorityQueue`s (Max-Heaps).
   * Reduces $N$ participants' cross-debts down to at most $N - 1$ direct transactions.
3. **Sub-10ms Balance Read Path:**
   * Recalculations triggered asynchronously via Kafka (`ExpenseChangedEvent`).
   * Final simplified balance reports cached in Redis under `group:balances:{groupId}`.
