# Faculty Portal Session Context Flow - Complete Analysis

**Date:** 2026-05-08  
**Scope:** Understanding how `/my/preferences` and `/my/dashboard` load and hydrate session context  
**Key Discovery:** Full end-to-end token-based authentication flow with JWT verification

---

## Executive Summary

The faculty portal pages (`/my/preferences`, `/my/dashboard`) use a **JWT-based token authentication** system. Here's the flow:

1. **Login:** Faculty logs in with email/password → Server returns JWT token
2. **Token Storage:** Token stored in `sessionStorage` as `'atlas_local_token'` (or `localStorage` if "remember me")
3. **Session Hydration:** On page load, component fetches token → injects into `Authorization: Bearer TOKEN` header
4. **Token Validation:** Every API request goes through `authenticate` middleware that verifies JWT signature
5. **Faculty Mapping:** After token verified, server maps user to faculty record via `FacultyMirror` table (externalId match)

**Error Message:** "Failed to load session context." appears when the `/faculty/me` endpoint fails (401/403), which typically means:
- Token missing from storage
- Token invalid/expired
- Faculty not linked to user account

---

## Key Files and Responsibilities

### Client-Side (React)

| File | Responsibility |
|------|-----------------|
| [atlas-client/src/pages/Login.tsx](atlas-client/src/pages/Login.tsx) | Login form, token generation, storage after successful login |
| [atlas-client/src/pages/FacultyPreferences.tsx](atlas-client/src/pages/FacultyPreferences.tsx) | **[PRIMARY]** Loads session context on mount via `/faculty/me`, then loads preferences |
| [atlas-client/src/pages/MyDashboard.tsx](atlas-client/src/pages/MyDashboard.tsx) | **[PRIMARY]** Loads session context + dashboard via `/faculty-portal/.../dashboard` |
| [atlas-client/src/lib/auth.ts](atlas-client/src/lib/auth.ts) | Token storage/retrieval helpers: `setLocalToken`, `getLocalToken`, `getPreferredAccessToken` |
| [atlas-client/src/lib/api.ts](atlas-client/src/lib/api.ts) | Axios config that injects token into every request via interceptor |

### Server-Side (Express + Prisma)

| File | Responsibility |
|------|-----------------|
| [atlas-server/src/middleware/authenticate.ts](atlas-server/src/middleware/authenticate.ts) | **[CRITICAL]** JWT verification; extracts & validates token; populates `req.user` |
| [atlas-server/src/routes/auth.router.ts](atlas-server/src/routes/auth.router.ts) | `/auth/login` endpoint; calls `loginWithEmailPassword` to create token |
| [atlas-server/src/services/local-auth.service.ts](atlas-server/src/services/local-auth.service.ts) | Token creation (`jwt.sign`), password verification, rate limiting |
| [atlas-server/src/routes/faculty.router.ts](atlas-server/src/routes/faculty.router.ts) | `GET /faculty/me` handler; maps userId to FacultyMirror; returns faculty.id |
| [atlas-server/src/routes/preference.router.ts](atlas-server/src/routes/preference.router.ts) | `GET /preferences/:schoolId/:schoolYearId/faculty/:facultyId` handler |
| [atlas-server/src/routes/faculty-portal.router.ts](atlas-server/src/routes/faculty-portal.router.ts) | `GET /faculty-portal/:schoolId/:schoolYearId/dashboard` handler |

---

## 1. Token Generation (POST /auth/login)

### Endpoint: `POST /api/v1/auth/login`

**Request:**
```json
{
  "email": "teacher@example.com",
  "password": "SecurePassword123"
}
```

**Server Processing** ([local-auth.service.ts](atlas-server/src/services/local-auth.service.ts)):
1. Normalize email (trim, lowercase)
2. Check rate limiting (IP + email, max 5 failed attempts in window)
3. Look up user by email in database
4. Verify password hash with bcrypt
5. If valid, create JWT token:

```typescript
// From local-auth.service.ts
function createToken(user: LocalAuthUser): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return jwt.sign(user, secret, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}
```

**JWT Payload:**
```typescript
{
  userId: number,           // From user record
  role: 'faculty' | 'officer' | 'admin',
  mustChangePassword?: boolean,
  authSource: 'local',      // Can be 'bridge' for EnrollPro tokens
  schoolId: number,
  accountId: number,
  email: string,
  iat: number,              // Issued at (auto)
  exp: number               // Expiration (default 8h)
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": 42,
    "role": "faculty",
    "mustChangePassword": false,
    "authSource": "local"
  }
}
```

---

## 2. Token Storage (Client-Side)

### After Successful Login ([Login.tsx](atlas-client/src/pages/Login.tsx))

```typescript
// Line ~177 in Login.tsx
const response = await atlasApi.post<LoginResponse>('/auth/login', {
  email: email.trim(),
  password,
});
setLocalToken(response.data.token, rememberMe);
localStorage.setItem('userRole', response.data.user.role);
```

### Token Storage Strategy ([auth.ts](atlas-client/src/lib/auth.ts))

```typescript
export function setLocalToken(token: string, remember = false): void {
  writeSessionStorage(ATLAS_LOCAL_TOKEN_KEY, token);  // Always session
  if (remember) {
    writeLocalStorage(ATLAS_LOCAL_TOKEN_KEY, token);  // Also persistent
  } else {
    removeLocalStorage(ATLAS_LOCAL_TOKEN_KEY);        // Remove if exists
  }
}
```

**Storage Keys:**
- `atlas_local_token` = local login token (sessionStorage + optionally localStorage)
- `atlas_bridge_token` = EnrollPro bridge token (sessionStorage only)
- `userRole` = cached user role (localStorage)

---

## 3. Token Injection into Requests ([api.ts](atlas-client/src/lib/api.ts))

**Axios Configuration:**
```typescript
const atlasApi = axios.create({
  baseURL: apiBaseUrl,  // /api/v1
});

// Inject bridge token on every request
atlasApi.interceptors.request.use((config) => {
  const token = getPreferredAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Priority for Token Selection** ([auth.ts](atlas-client/src/lib/auth.ts)):
```typescript
export function getPreferredAccessToken(): string | null {
  return getLocalToken() ?? getBridgeToken();
}

export function getLocalToken(): string | null {
  // 1. Try sessionStorage (fresh local login)
  const sessionToken = readSessionStorage(ATLAS_LOCAL_TOKEN_KEY);
  if (sessionToken) return sessionToken;

  // 2. Try localStorage (remembered local login)
  const rememberedToken = readLocalStorage(ATLAS_LOCAL_TOKEN_KEY);
  if (rememberedToken) {
    writeSessionStorage(ATLAS_LOCAL_TOKEN_KEY, rememberedToken);
    return rememberedToken;
  }

  return null;
}

export function getBridgeToken(): string | null {
  // 3. Try bridge token (from EnrollPro)
  return readSessionStorage(ATLAS_BRIDGE_TOKEN_KEY);
}
```

---

## 4. Token Verification Middleware ([authenticate.ts](atlas-server/src/middleware/authenticate.ts))

**Every protected endpoint uses this middleware:**

```typescript
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Step 1: Extract header
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ code: 'NO_TOKEN', message: 'Authorization header missing or malformed.' });
    return;
  }

  // Step 2: Extract token
  const token = header.slice(7);  // Remove 'Bearer '
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ code: 'SERVER_ERROR', message: 'JWT secret not configured.' });
    return;
  }

  // Step 3: Verify and decode
  try {
    const decoded = jwt.verify(token, secret) as AuthPayload;
    req.user = {
      ...decoded,
      authSource: decoded.authSource === 'local' ? 'local' : 'bridge',
    };
    next();
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Access token has expired.' });
      return;
    }
    res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid access token.' });
  }
}
```

**Possible Responses:**
- `401 NO_TOKEN` — Header missing or doesn't start with "Bearer "
- `401 TOKEN_EXPIRED` — Token exists but JWT exp claim has passed
- `401 INVALID_TOKEN` — Signature verification failed or malformed JWT
- `500 SERVER_ERROR` — JWT_SECRET env var not set

---

## 5. Session Context Loading: `/faculty/me` Endpoint

### Endpoint: `GET /api/v1/faculty/me?schoolId=1`

**Protected:** YES (requires `authenticate` middleware)

**Handler** ([faculty.router.ts](atlas-server/src/routes/faculty.router.ts)):

```typescript
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
      return;
    }
    const schoolId = Number(req.query.schoolId);
    if (!schoolId || Number.isNaN(schoolId)) {
      res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
      return;
    }

    // Look up faculty by userId (which comes from JWT) and schoolId
    const faculty = await prisma.facultyMirror.findFirst({
      where: { schoolId, externalId: userId },
    });
    if (!faculty) {
      res.status(404).json({ 
        code: 'FACULTY_NOT_LINKED', 
        message: 'No faculty profile is linked to this account for the selected school.' 
      });
      return;
    }

    res.json({ faculty });
  } catch (err) {
    next(err);
  }
});
```

**Response on Success:**
```json
{
  "faculty": {
    "id": 123,
    "firstName": "John",
    "lastName": "Doe",
    "externalId": 42,
    "schoolId": 1,
    ...
  }
}
```

**Possible Errors:**
- `401 NO_USER` — Shouldn't happen if middleware passed, but defensive check
- `400 INVALID_PARAM` — schoolId query param missing or invalid
- `404 FACULTY_NOT_LINKED` — **This causes "Failed to load session context."**
  - userId from JWT doesn't match any FacultyMirror.externalId for this school

---

## 6. Session Context Loading in Components

### [FacultyPreferences.tsx](atlas-client/src/pages/FacultyPreferences.tsx)

**Lines 141–159:**
```typescript
/* ── Resolve session context ── */
useEffect(() => {
  (async () => {
    try {
      // 1. Load active school year from public settings
      const settings = await fetchPublicSettings();
      if (!settings.activeSchoolYearId) {
        setError('No active school year configured. Contact your scheduling officer.');
        setLoading(false);
        return;
      }
      setActiveSchoolYearId(settings.activeSchoolYearId);

      // 2. Resolve faculty mapping from bridge identity
      const { data: facultyMe } = await atlasApi.get<{ faculty: { id: number } }>('/faculty/me', {
        params: { schoolId: DEFAULT_SCHOOL_ID },
      });
      if (!facultyMe?.faculty?.id) {
        setError('Your account is not linked to a faculty record in this school. Contact your scheduling officer.');
        setLoading(false);
        return;
      }
      setFacultyId(facultyMe.faculty.id);
    } catch {
      setError('Failed to load session context.');
      setLoading(false);
    }
  })();
}, []);
```

**Execution Flow:**
1. ✅ Fetch public settings (activeSchoolYearId from `/api/settings/public`)
2. ✅ Call `/faculty/me` with Authorization header (token injected by axios interceptor)
3. ✅ If successful: set facultyId state
4. ❌ If fails (401/403/404): set error "Failed to load session context."

### [MyDashboard.tsx](atlas-client/src/pages/MyDashboard.tsx)

**Lines 55–75:**
```typescript
const loadDashboard = async () => {
  setLoading(true);
  try {
    const settings = await fetchPublicSettings();
    if (!settings.activeSchoolYearId) {
      setError('No active school year configured.');
      setLoading(false);
      return;
    }
    const { data } = await atlasApi.get<MyDashboardResponse>(
      `/faculty-portal/${DEFAULT_SCHOOL_ID}/${settings.activeSchoolYearId}/dashboard`
    );
    setDashboard(data);
    setError(null);
  } catch (err) {
    const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    setError(message ?? 'Unable to load your faculty dashboard.');
  } finally {
    setLoading(false);
  }
};
```

**Key Differences from Preferences:**
- Combines session context + dashboard data in one endpoint
- Calls `/faculty-portal/.../dashboard` instead of separate `/faculty/me`
- Returns faculty name, phase, schedule preview, statuses

---

## 7. The "Failed to load session context." Error

**Where it appears:** [Line 153 in FacultyPreferences.tsx](atlas-client/src/pages/FacultyPreferences.tsx#L153)

```typescript
catch {
  setError('Failed to load session context.');
  setLoading(false);
}
```

**Root Causes (in priority order):**

1. **Token not in storage** (most common)
   - User closed browser tab before page fully loaded
   - Session storage cleared (browser history/privacy mode)
   - Token was in localStorage but browser didn't carry it to new tab
   - **Fix:** User needs to log in again

2. **Token invalid or expired** (401)
   - JWT signature doesn't match (different JWT_SECRET on server)
   - Token was tampered with
   - Token exp claim has passed (>8h old)
   - **Fix:** User needs to log in again; server JWT_SECRET must be consistent

3. **Faculty not linked to user** (404)
   - User logged in but FacultyMirror.externalId doesn't match JWT.userId
   - Faculty record deleted from database
   - Faculty record belongs to different school
   - **Fix:** Admin must create/link FacultyMirror record

4. **Network/Server error** (5xx or network timeout)
   - Server is down
   - Firewall blocking request
   - Database connection failed
   - **Fix:** Check server logs; verify connectivity

---

## 8. Debugging Checklist

### 1. **Verify Token Storage**
   - Open browser DevTools → Storage → SessionStorage
   - Look for `atlas_local_token` key
   - Should contain JWT starting with `eyJ...`
   - If absent → user not logged in or login failed

### 2. **Verify Token Injection**
   - Open DevTools → Network → Filter "faculty/me"
   - Check request Headers
   - Should see: `Authorization: Bearer eyJ...`
   - If absent → token storage empty or axios interceptor not working

### 3. **Verify JWT Validity**
   - Copy token to [jwt.io](https://jwt.io)
   - Verify payload contains: userId, role, authSource
   - Check exp claim (if < now, token expired)
   - Check iat claim (should be recent)

### 4. **Verify Server JWT Secret**
   - Check `atlas-server/.env` or `process.env.JWT_SECRET`
   - Must be **identical** to secret used when token was created
   - If different: all tokens invalid

### 5. **Verify Faculty Linking**
   - Run in `atlas-server` database:
     ```sql
     SELECT id, externalId, schoolId, firstName, lastName 
     FROM "FacultyMirror" 
     WHERE schoolId = 1 
     LIMIT 10;
     ```
   - Verify externalId matches user ID from JWT
   - If not found, admin must create FacultyMirror record

### 6. **Check API Response**
   - Open DevTools → Network → faculty/me request
   - Check Response tab
   - If 401: check token validity
   - If 404: check faculty linking
   - If 500: check server logs

---

## 9. Token Flow Diagram Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Login.tsx ─────────┐                                             │
│                     v                                             │
│              POST /auth/login                                     │
│              (email, password)                                    │
│                     │                                             │
│                     v                                             │
└─────────────────────────────────────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            v                     v
┌─────────────────────┐ ┌─────────────────────┐
│   Verify Password   │ │   jwt.sign(user)    │
│   Check Rate Limit  │ │   exp: 8h           │
└─────────────────────┘ └────────┬────────────┘
                                 │
                                 v
                        Return token to client
                                 │
                                 v
                        setLocalToken(token)
            ┌───────────────────┬────────────────────┐
            v                   v                    v
        Session Storage    Local Storage       userRole cache
        (always)      (if remember=true)      (localStorage)
            │                   │                    │
            └───────────────────┴────────────────────┘
                                 │
                    Navigate to /my/preferences
                                 │
                                 v
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  FacultyPreferences mounts                                        │
│       │                                                            │
│       v                                                            │
│  useEffect → getPreferredAccessToken()                            │
│       │                                                            │
│       v                                                            │
│  axios.get(/faculty/me)                                          │
│       │                                                            │
│       v                                                            │
│  axios interceptor                                               │
│  Authorization: Bearer <token>                                   │
│       │                                                            │
└───────┼──────────────────────────────────────────────────────────┘
        │
        v
┌──────────────────────────────────────────────────────────────────┐
│                      SERVER (Express)                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  authenticate middleware                                          │
│       │                                                            │
│       v                                                            │
│  Extract "Bearer <token>"                                        │
│  jwt.verify(token, JWT_SECRET)                                  │
│       │                                                            │
│  ┌────┴────┬──────────┬──────────┐                               │
│  v         v          v          v                               │
│ ✅Valid  401Expired  401Invalid  500Error                        │
│  │                                                                │
│  v                                                                │
│  req.user = {userId, role, ...}                                  │
│  next()                                                           │
│       │                                                            │
│       v                                                            │
│  /faculty/me handler                                             │
│       │                                                            │
│       v                                                            │
│  Query FacultyMirror                                             │
│  WHERE schoolId=1 AND externalId=req.user.userId               │
│       │                                                            │
│  ┌────┴──────┐                                                   │
│  v           v                                                   │
│ ✅Found    404 NOT_LINKED                                         │
│  │                                                                │
│  v                                                                │
│  res.json({faculty: {id, ...}})                                 │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
        │
        v
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ✅ setFacultyId(faculty.id)                                     │
│  ✅ useCallback loads preferences                                │
│  ✅ Session context hydrated                                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Key Configuration & Env Vars

| Env Var | Purpose | Default | Location |
|---------|---------|---------|----------|
| `JWT_SECRET` | Secret key for signing/verifying JWT | (required) | atlas-server/.env |
| `JWT_EXPIRES_IN` | Token expiration time | `8h` | atlas-server/.env |
| `ATLAS_AUTH_MAX_FAILED_ATTEMPTS` | Failed login attempts before lockout | `5` | atlas-server/.env |
| `ATLAS_AUTH_LOCKOUT_MINUTES` | Lockout duration after max failures | `15` | atlas-server/.env |
| `VITE_ATLAS_API` | Client API base URL | `/api/v1` | atlas-client/.env |

---

## 11. Related Endpoints

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|-----------------|
| POST | `/api/v1/auth/login` | Faculty/officer login | NO |
| GET | `/api/v1/auth/me` | Verify current token & get user info | YES |
| GET | `/api/v1/faculty/me` | Get faculty record linked to user | YES |
| GET | `/api/v1/preferences/:schoolId/:schoolYearId/faculty/:facultyId` | Get preferences | YES |
| GET | `/api/v1/faculty-portal/:schoolId/:schoolYearId/dashboard` | Get dashboard | YES |
| PUT | `/api/v1/preferences/:schoolId/:schoolYearId/faculty/:facultyId` | Save draft preferences | YES |
| POST | `/api/v1/preferences/:schoolId/:schoolYearId/faculty/:facultyId/submit` | Submit preferences | YES |

---

## Summary Table: Who Calls What?

```
┌──────────────────────────────────┬─────────────────────┬──────────────────────┐
│ Component                        │ API Endpoint        │ Purpose              │
├──────────────────────────────────┼─────────────────────┼──────────────────────┤
│ Login.tsx                        │ POST /auth/login    │ Get initial token    │
│ FacultyPreferences.tsx (mount)   │ GET /faculty/me     │ Resolve faculty ID   │
│ FacultyPreferences.tsx (mount)   │ GET /preferences/.. │ Load preferences     │
│ MyDashboard.tsx (mount)          │ GET /faculty-...    │ Load dashboard data  │
│ Any protected page               │ (any endpoint)      │ Token in header      │
└──────────────────────────────────┴─────────────────────┴──────────────────────┘
```

---

## Recommended Next Steps for Investigation

1. **Check DevTools Storage** after local faculty login:
   - Verify `atlas_local_token` exists in sessionStorage
   - If absent, login process is not storing token correctly

2. **Monitor Network Tab** on /my/preferences load:
   - Look for `/faculty/me` request
   - Verify Authorization header present
   - Check response status code (200 vs 401 vs 404)

3. **Check Server Logs** for:
   - JWT_SECRET configuration
   - Authenticate middleware errors
   - Faculty mirror lookup failures

4. **Verify Database** for faculty records:
   - Ensure FacultyMirror.externalId matches user.id in auth system

5. **Test Token Manually**:
   - Decode token at jwt.io
   - Verify exp > now
   - Verify userId, role fields present
