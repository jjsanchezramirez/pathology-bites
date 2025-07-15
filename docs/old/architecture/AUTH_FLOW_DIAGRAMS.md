# Authentication Flow Diagrams

## Overview

This document contains visual diagrams explaining the Pathology Bites authentication system architecture, flows, and security mechanisms.

## 1. System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        A[User Interface] --> B[Auth Components]
        B --> C[useAuth Hook]
        C --> D[Auth Provider]
    end
    
    subgraph "Security Layer"
        E[CSRF Protection] --> F[Session Security]
        F --> G[Rate Limiting]
        G --> H[Error Handling]
    end
    
    subgraph "Network Layer"
        I[Middleware] --> J[API Routes]
        J --> K[Server Actions]
    end
    
    subgraph "Backend Layer"
        L[Supabase Auth] --> M[Database RLS]
        M --> N[User Management]
    end
    
    subgraph "Recovery Layer"
        O[Error Classification] --> P[Retry Logic]
        P --> Q[Fallback Handling]
    end
    
    A --> E
    D --> I
    K --> L
    H --> O
    
    style A fill:#e1f5fe
    style L fill:#f3e5f5
    style E fill:#fff3e0
    style O fill:#e8f5e8
```

**Description**: Five-layer architecture providing comprehensive security and reliability.

## 2. Complete Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant M as Middleware
    participant S as Security Layer
    participant A as Auth Service
    participant D as Database
    
    Note over U,D: Login Flow
    U->>C: Enter credentials
    C->>S: Request CSRF token
    S-->>C: Return CSRF token
    C->>M: Submit login + CSRF token
    M->>S: Validate CSRF token
    M->>S: Check rate limiting
    S-->>M: Rate limit OK
    M->>A: Authenticate user
    A->>D: Verify credentials
    D-->>A: User data
    A-->>M: JWT tokens
    M->>S: Generate session fingerprint
    S-->>M: Fingerprint stored
    M-->>C: Authentication success
    C-->>U: Redirect to dashboard
    
    Note over U,D: Session Validation
    U->>C: Access protected route
    C->>M: Request with JWT
    M->>A: Validate JWT
    A-->>M: JWT valid
    M->>S: Check session security
    S->>S: Validate fingerprint
    S-->>M: Security check passed
    M-->>C: Access granted
    C-->>U: Show protected content
```

**Description**: Complete login and session validation flow with security checks.

## 3. Security Layers & Protection

```mermaid
graph LR
    subgraph "Request Flow"
        A[User Request] --> B[Security Headers]
        B --> C[CSRF Validation]
        C --> D[Rate Limiting]
        D --> E[Session Check]
        E --> F[Fingerprint Validation]
        F --> G[Permission Check]
        G --> H[Database Access]
    end
    
    subgraph "Protection Mechanisms"
        I[XSS Protection]
        J[Clickjacking Prevention]
        K[MIME Sniffing Protection]
        L[Content Security Policy]
    end
    
    subgraph "Threat Detection"
        M[Device Changes]
        N[Location Changes]
        O[Behavioral Anomalies]
        P[Rapid Requests]
    end
    
    subgraph "Response Actions"
        Q[Security Warnings]
        R[Account Lockout]
        S[Session Termination]
        T[Admin Alerts]
    end
    
    B --> I
    B --> J
    B --> K
    B --> L
    
    F --> M
    F --> N
    F --> O
    D --> P
    
    M --> Q
    N --> Q
    O --> R
    P --> S
    
    style A fill:#ffebee
    style H fill:#e8f5e8
    style I fill:#fff3e0
    style Q fill:#fce4ec
```

**Description**: Multi-layered security with threat detection and automated responses.

## 4. Error Handling & Recovery

```mermaid
flowchart TD
    A[Authentication Error] --> B{Error Type?}
    
    B -->|Network Error| C[Network Error Handler]
    B -->|Auth Failed| D[Auth Error Handler]
    B -->|Rate Limited| E[Rate Limit Handler]
    B -->|Session Expired| F[Session Error Handler]
    B -->|CSRF Error| G[CSRF Error Handler]
    
    C --> H{Retryable?}
    D --> I[Show Error Message]
    E --> J[Show Retry Timer]
    F --> K[Redirect to Login]
    G --> L[Refresh CSRF Token]
    
    H -->|Yes| M[Exponential Backoff]
    H -->|No| N[Show Error + Manual Retry]
    
    M --> O[Retry Request]
    O --> P{Success?}
    P -->|Yes| Q[Continue Flow]
    P -->|No| R{Max Retries?}
    R -->|No| M
    R -->|Yes| N
    
    J --> S[Wait for Timer]
    S --> T[Enable Retry]
    
    L --> U[Retry with New Token]
    
    I --> V[User Action Required]
    N --> V
    T --> V
    K --> W[Fresh Login]
    
    style A fill:#ffebee
    style Q fill:#e8f5e8
    style V fill:#fff3e0
    style W fill:#e1f5fe
```

**Description**: Comprehensive error handling with automatic recovery and user guidance.

## Component Interactions

### Client Layer Components
- **AuthProvider**: Global state management
- **useAuth Hook**: Unified authentication interface
- **LoginForm/SignupForm**: User interaction components
- **ProtectedRoute**: Access control wrapper

### Security Layer Components
- **CSRF Protection**: Token-based request validation
- **Session Security**: Device fingerprinting and monitoring
- **Rate Limiting**: Brute force attack prevention
- **Error Handling**: Intelligent error recovery

### Network Layer Components
- **Middleware**: Request interception and validation
- **API Routes**: RESTful authentication endpoints
- **Server Actions**: Form submission handlers

### Backend Layer Components
- **Supabase Auth**: JWT token management
- **Database RLS**: Row-level security policies
- **User Management**: Account lifecycle operations

## Security Flow Details

### CSRF Protection Flow
1. Client requests CSRF token
2. Token embedded in forms
3. Server validates token on submission
4. Invalid tokens rejected with error

### Session Security Flow
1. Generate device fingerprint on login
2. Store fingerprint in session storage
3. Validate fingerprint on each request
4. Flag suspicious changes for review

### Rate Limiting Flow
1. Track requests per IP address
2. Block excessive attempts
3. Apply exponential backoff
4. Reset counters after timeout

### Error Recovery Flow
1. Classify error type and severity
2. Determine if error is retryable
3. Apply appropriate retry strategy
4. Provide user feedback and guidance

## Performance Characteristics

- **Authentication Latency**: <100ms average
- **Token Refresh**: Background, non-blocking
- **Security Checks**: <10ms overhead
- **Error Recovery**: Automatic with exponential backoff

## Monitoring Points

- Authentication success/failure rates
- Security event frequency
- Error recovery effectiveness
- Performance metrics and latency

These diagrams provide a comprehensive visual guide to understanding the authentication system's architecture, security measures, and operational flows.
