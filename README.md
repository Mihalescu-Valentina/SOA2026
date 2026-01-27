# SOA2026
---

# MicroStore System Documentation

This repository contains **MicroStore**, a distributed e-commerce system implemented as multiple **NestJS** microservices, fronted by **NGINX** and a **React** Single Page Application.

The system demonstrates:

* **Hybrid Architecture:** Synchronous HTTP + Asynchronous Messaging.
* **Microservices:** Listing Service, Transaction Service, Auth Service.
* **Event-Driven Communication:** Async messaging via **RabbitMQ** (Order Processing) and **Kafka** (Analytics/Views).
* **Real-Time Updates:** WebSockets via **Socket.io**.
* **Serverless Integration:** External Fee Calculation via **AWS Lambda**.
* **Containerized Deployment:** Docker Compose.

---

## 1. System Overview

The MicroStore system is designed as a set of independently deployable services:

* **Listing Service (NestJS):** Manages item inventory, handles "Buy" requests optimistically, and hosts the **Socket.io Gateway** for real-time `item_sold` broadcasts.
* **Transaction Service (NestJS):** Background worker that consumes orders, calculates fees via **AWS Lambda**, and saves permanent financial records.
* **Auth Service (NestJS):** Issues JWT tokens (login/register) to secure the API.
* **NGINX:** Reverse proxy acting as the API Gateway, routing traffic to backend services (`/api/listings`) and handling WebSocket upgrades.
* **Frontend (React/Vite):** The user interface for browsing and buying items.

---

## 2. C4 Model: System Context

This diagram shows how a user interacts with the MicroStore system and how the system relies on external cloud functions.

```mermaid
C4Context
	title System Context Diagram - MicroStore

	Person(user, "User", "Browses listings, buys items, sees real-time updates.")
	System(microstore, "MicroStore System", "Microservices backend + React frontend.")
	System_Ext(awsLambda, "AWS Lambda", "Calculates dynamic transaction fees (FaaS).")

	Rel(user, microstore, "Uses", "HTTPS + WSS")
	Rel(microstore, awsLambda, "Delegates fee calculation", "HTTPS/JSON")

	UpdateLayoutConfig($c4ShapeInRow="3")

```

---

## 3. C4 Model: Container Diagram

This diagram breaks down the internal containers in the `docker-compose` stack.

```mermaid
C4Container
	title Container Diagram - MicroStore Architecture

	Person(user, "User", "Web Browser")

	Container_Boundary(edge, "Edge Layer") {
		Container(nginx, "NGINX", "nginx", "Reverse proxy + API Gateway. Routes /api/* and handles WebSocket upgrades.")
		Container(spa, "Frontend", "React / Vite", "Single Page Application.")
	}

	Container_Boundary(services, "Microservices") {
		Container(listing, "Listing Service", "NestJS", "Manages inventory, emits RabbitMQ events, broadcasts via Socket.io.")
		Container(transaction, "Transaction Service", "NestJS", "Consumes orders, calls AWS Lambda, persists transactions.")
		Container(auth, "Auth Service", "NestJS", "Handles User Authentication & JWT generation.")
	}

	Container_Boundary(infra, "Infrastructure") {
		ContainerDb(mariadb, "MariaDB", "MariaDB 10", "Stores listings, users, and transaction history.")
		ContainerQueue(rabbitmq, "RabbitMQ", "rabbitmq:3-management", "Message broker for 'orders_queue'.")
		ContainerQueue(kafka, "Kafka", "Confluent Kafka", "Event streaming for 'listing_viewed' analytics.")
	}

	System_Ext(aws, "AWS Lambda", "External Fee Service")

	%% Relationships
	Rel(user, spa, "Loads UI", "HTTPS")
	Rel(spa, nginx, "API Requests", "HTTPS/WSS")
	
	Rel(nginx, listing, "Proxies /listings & Sockets", "HTTP/WS")
	Rel(nginx, transaction, "Proxies /transactions", "HTTP")
	Rel(nginx, auth, "Proxies /auth", "HTTP")

	Rel(listing, mariadb, "Reads/Writes Listings", "TypeORM")
	Rel(transaction, mariadb, "Reads/Writes Transactions", "TypeORM")

	%% Async Communication
	Rel(listing, rabbitmq, "Produces: order_created", "AMQP")
	Rel(transaction, rabbitmq, "Consumes: order_created", "AMQP")
	Rel(transaction, rabbitmq, "Produces: item_sold (Reply)", "AMQP")
	Rel(listing, rabbitmq, "Consumes: item_sold", "AMQP")

	Rel(listing, kafka, "Produces: listing_viewed", "TCP")
	
	%% External
	Rel(transaction, aws, "Calculate Fee", "HTTPS")

	UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")

```

---

## 4. UML Sequence Diagram: The "Buy Item" Flow

This diagram describes the **Hybrid Sync/Async** pattern used when a user purchases an item.

```mermaid
sequenceDiagram
	autonumber
	actor User
	participant UI as Frontend (React)
	participant LS as Listing Service
	participant DB as MariaDB
	participant RMQ as RabbitMQ
	participant TS as Transaction Service
	participant AWS as AWS Lambda

	Note over UI,LS: User is Authenticated (JWT)

	User->>UI: Click "Buy"
	UI->>LS: POST /api/listings/:id/buy
	
	activate LS
	LS->>DB: UPDATE listings SET isSold = true
	
	par Optimistic Updates
	    LS-->>UI: 200 OK "Purchase Successful"
	    LS->>UI: Socket.io Emit "item_sold" (Broadcast)
	end

	LS->>RMQ: Emit Event "order_created"
	deactivate LS

	Note over RMQ,TS: Async Background Process
	RMQ->>TS: Consume "order_created"
	activate TS
	TS->>AWS: POST /calculate-fee
	AWS-->>TS: Return { total, fee }
	TS->>DB: INSERT INTO transactions
	
	TS->>RMQ: Emit Event "item_sold" (Confirmation)
	deactivate TS

	RMQ->>LS: Consume "item_sold"
	LS->>DB: Verify State Consistency

```

---

## 5. Technology Stack Summary

| Component | Technology | Role |
| --- | --- | --- |
| **Reverse Proxy** | NGINX | Single public entrypoint; routes requests; handles CORS. |
| **Backend Framework** | NestJS (Node.js) | Modular architecture for all microservices. |
| **Database** | MariaDB | Relational storage for all entities (Users, Listings, Transactions). |
| **Message Broker** | RabbitMQ | Handles the critical "Purchase" workflow (`orders_queue`). |
| **Event Streaming** | Kafka | Handles high-volume analytics events (`listing_viewed`). |
| **Real-time** | Socket.io | Bidirectional communication for live inventory updates. |
| **FaaS** | AWS Lambda | External serverless function for fee logic. |
| **Deployment** | Docker Compose | Orchestrates the entire stack locally. |

---

## 6. Run Locally (Quick Start)

From the root project folder:

```powershell
# Build and start all services
docker compose up -d --build

```

**Access Points:**

* **Frontend:** `http://localhost:8080` (Served via NGINX)
* **API Endpoint:** `http://localhost:8080/api/listings`
* **RabbitMQ Dashboard:** `http://localhost:15672` (User/Pass: guest/guest)
