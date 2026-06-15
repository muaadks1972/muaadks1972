from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me-in-production-' + uuid.uuid4().hex)
JWT_ALGORITHM = 'HS256'
JWT_EXPIRES_MINUTES = 60 * 24 * 7  # 1 week

ALLOWED_DEPARTMENTS = [
    "الموارد البشرية", "المالي", "التدقيق", "التخطيط",
    "مكتب المدير العام", "الفني", "الاتصالات", "الحركة الجوية",
    "السلامة", "معلومات الطيران", "التدريب", "الجودة",
    "تمكين المرأة", "الإعلام",
]

app = FastAPI()
api_router = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Models ----------
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class EmployeeCreate(BaseModel):
    username: str
    password: str
    full_name: str


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None


class EmployeePublic(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    created_at: str


class ActivityCreate(BaseModel):
    date: str  # ISO date YYYY-MM-DD
    nature_of_work: str
    department: str
    notes: Optional[str] = ""


class Activity(BaseModel):
    id: str
    user_id: str
    employee_name: str
    username: str
    date: str
    nature_of_work: str
    department: str
    notes: str
    created_at: str


# ---------- Helpers ----------
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_access_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRES_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="انتهت صلاحية الجلسة")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="رمز غير صالح")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="المستخدم غير موجود")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="صلاحيات المدير مطلوبة")
    return user


def user_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "username": u["username"],
        "full_name": u.get("full_name", ""),
        "role": u["role"],
        "created_at": u.get("created_at", ""),
    }


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Air Navigation Maintenance API"}


@api_router.get("/departments")
async def get_departments():
    return {"departments": ALLOWED_DEPARTMENTS}


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"username": req.username}, {"_id": 0})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="اسم المستخدم أو كلمة المرور غير صحيحة")
    token = create_access_token(user["id"], user["username"], user["role"])
    return TokenResponse(access_token=token, user=user_public(user))


@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user_public(user)


# ---------- Admin: employees ----------
@api_router.post("/admin/employees", response_model=EmployeePublic)
async def create_employee(req: EmployeeCreate, admin: dict = Depends(require_admin)):
    existing = await db.users.find_one({"username": req.username})
    if existing:
        raise HTTPException(status_code=400, detail="اسم المستخدم موجود مسبقًا")
    new_user = {
        "id": str(uuid.uuid4()),
        "username": req.username,
        "password_hash": hash_password(req.password),
        "full_name": req.full_name,
        "role": "employee",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(new_user)
    return EmployeePublic(**user_public(new_user))


@api_router.get("/admin/employees", response_model=List[EmployeePublic])
async def list_employees(admin: dict = Depends(require_admin)):
    cursor = db.users.find({"role": "employee"}, {"_id": 0}).sort("created_at", -1)
    users = await cursor.to_list(1000)
    return [EmployeePublic(**user_public(u)) for u in users]


@api_router.patch("/admin/employees/{employee_id}", response_model=EmployeePublic)
async def update_employee(employee_id: str, req: EmployeeUpdate, admin: dict = Depends(require_admin)):
    update_doc = {}
    if req.full_name is not None:
        update_doc["full_name"] = req.full_name
    if req.password:
        update_doc["password_hash"] = hash_password(req.password)
    if not update_doc:
        raise HTTPException(status_code=400, detail="لا يوجد شيء للتحديث")
    result = await db.users.update_one({"id": employee_id, "role": "employee"}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    user = await db.users.find_one({"id": employee_id}, {"_id": 0})
    return EmployeePublic(**user_public(user))


@api_router.delete("/admin/employees/{employee_id}")
async def delete_employee(employee_id: str, admin: dict = Depends(require_admin)):
    result = await db.users.delete_one({"id": employee_id, "role": "employee"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    return {"success": True}


# ---------- Activities ----------
@api_router.post("/activities", response_model=Activity)
async def create_activity(req: ActivityCreate, user: dict = Depends(get_current_user)):
    if req.department not in ALLOWED_DEPARTMENTS:
        raise HTTPException(status_code=400, detail="القسم غير صالح")
    if not req.nature_of_work.strip():
        raise HTTPException(status_code=400, detail="طبيعة العمل مطلوبة")
    activity = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "employee_name": user.get("full_name") or user["username"],
        "username": user["username"],
        "date": req.date,
        "nature_of_work": req.nature_of_work.strip(),
        "department": req.department,
        "notes": (req.notes or "").strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.activities.insert_one(activity)
    activity.pop("_id", None)
    return Activity(**activity)


@api_router.get("/activities/me", response_model=List[Activity])
async def my_activities(user: dict = Depends(get_current_user)):
    cursor = db.activities.find({"user_id": user["id"]}, {"_id": 0}).sort("date", -1)
    items = await cursor.to_list(1000)
    return [Activity(**i) for i in items]


@api_router.delete("/activities/{activity_id}")
async def delete_my_activity(activity_id: str, user: dict = Depends(get_current_user)):
    query = {"id": activity_id}
    if user["role"] != "admin":
        query["user_id"] = user["id"]
    result = await db.activities.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="النشاط غير موجود")
    return {"success": True}


@api_router.get("/admin/activities", response_model=List[Activity])
async def all_activities(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    employee_id: Optional[str] = None,
    department: Optional[str] = None,
    admin: dict = Depends(require_admin),
):
    query: dict = {}
    if start_date or end_date:
        date_q: dict = {}
        if start_date:
            date_q["$gte"] = start_date
        if end_date:
            date_q["$lte"] = end_date
        query["date"] = date_q
    if employee_id:
        query["user_id"] = employee_id
    if department:
        query["department"] = department
    cursor = db.activities.find(query, {"_id": 0}).sort("date", -1)
    items = await cursor.to_list(5000)
    return [Activity(**i) for i in items]


@api_router.get("/admin/analytics")
async def admin_analytics(
    months: int = 6,
    exclude_admin: bool = False,
    admin: dict = Depends(require_admin),
):
    """Aggregated analytics for the last N months (default 6).
    If exclude_admin is true, activities created by admin users are excluded."""
    months = max(1, min(months, 24))
    today = datetime.now(timezone.utc).date()

    # start = first day of month, (months-1) months back
    def shift_month(y: int, m: int, delta: int):
        m2 = m + delta
        while m2 <= 0:
            m2 += 12
            y -= 1
        while m2 > 12:
            m2 -= 12
            y += 1
        return y, m2

    cur_y, cur_m = shift_month(today.year, today.month, -(months - 1))
    start = datetime(cur_y, cur_m, 1).date()
    start_str = start.isoformat()
    end_str = today.isoformat()

    # Previous comparable window: months back of equal length, ending the day before `start`.
    prev_end = start - timedelta(days=1)
    prev_y, prev_m = shift_month(cur_y, cur_m, -months)
    prev_start = datetime(prev_y, prev_m, 1).date()

    # Admin user ids (for exclude_admin)
    admin_ids: set = set()
    if exclude_admin:
        async for u in db.users.find({"role": "admin"}, {"_id": 0, "id": 1}):
            admin_ids.add(u["id"])

    base_query: dict = {}
    if admin_ids:
        base_query["user_id"] = {"$nin": list(admin_ids)}

    # Current window
    cur_q = {**base_query, "date": {"$gte": start_str, "$lte": end_str}}
    items = await db.activities.find(cur_q, {"_id": 0}).to_list(5000)

    # Previous window
    prev_q = {**base_query, "date": {"$gte": prev_start.isoformat(), "$lte": prev_end.isoformat()}}
    prev_items = await db.activities.find(prev_q, {"_id": 0}).to_list(5000)

    # by department (current)
    by_dept: dict = {d: 0 for d in ALLOWED_DEPARTMENTS}
    for a in items:
        by_dept[a["department"]] = by_dept.get(a["department"], 0) + 1
    by_department = [
        {"department": d, "count": c}
        for d, c in sorted(by_dept.items(), key=lambda x: -x[1])
        if c > 0
    ]

    # by employee (current)
    by_emp: dict = {}
    for a in items:
        uid = a["user_id"]
        if uid not in by_emp:
            by_emp[uid] = {
                "user_id": uid,
                "employee_name": a["employee_name"],
                "username": a["username"],
                "count": 0,
            }
        by_emp[uid]["count"] += 1
    by_employee = sorted(by_emp.values(), key=lambda x: -x["count"])

    # by month YYYY-MM (current window)
    months_list: List[str] = []
    yy, mm = start.year, start.month
    cur = datetime(yy, mm, 1).date()
    while cur <= today:
        months_list.append(f"{cur.year:04d}-{cur.month:02d}")
        ny, nm = shift_month(cur.year, cur.month, 1)
        cur = datetime(ny, nm, 1).date()
    counts_by_month: dict = {m: 0 for m in months_list}
    for a in items:
        key = a["date"][:7] if len(a["date"]) >= 7 else ""
        if key in counts_by_month:
            counts_by_month[key] += 1
    by_month = [{"month": m, "count": counts_by_month[m]} for m in months_list]

    # totals (current)
    departments_active = len([d for d in by_dept.values() if d > 0])
    totals = {
        "activities": len(items),
        "employees": len(by_emp),
        "departments_active": departments_active,
    }

    # totals (previous window)
    prev_by_dept: dict = {}
    prev_by_emp: set = set()
    for a in prev_items:
        prev_by_dept[a["department"]] = prev_by_dept.get(a["department"], 0) + 1
        prev_by_emp.add(a["user_id"])
    previous_totals = {
        "activities": len(prev_items),
        "employees": len(prev_by_emp),
        "departments_active": len(prev_by_dept),
    }

    def pct(current: int, previous: int) -> Optional[float]:
        if previous == 0:
            return None if current == 0 else 100.0
        return round(((current - previous) / previous) * 100.0, 1)

    deltas = {
        "activities": pct(totals["activities"], previous_totals["activities"]),
        "employees": pct(totals["employees"], previous_totals["employees"]),
        "departments_active": pct(totals["departments_active"], previous_totals["departments_active"]),
    }

    return {
        "period": {"start": start_str, "end": end_str, "months": months},
        "previous_period": {
            "start": prev_start.isoformat(),
            "end": prev_end.isoformat(),
        },
        "exclude_admin": exclude_admin,
        "totals": totals,
        "previous_totals": previous_totals,
        "deltas": deltas,
        "by_department": by_department,
        "by_employee": by_employee,
        "by_month": by_month,
    }


@api_router.get("/admin/report/weekly")
async def weekly_report(
    week_start: Optional[str] = None,
    end_date: Optional[str] = None,
    admin: dict = Depends(require_admin),
):
    """Returns activities grouped by employee for a custom period.
    - week_start: period start (YYYY-MM-DD). Defaults to the most recent Saturday.
    - end_date: period end (YYYY-MM-DD). Defaults to start + 6 days (one week)."""
    if week_start:
        start = datetime.fromisoformat(week_start).date()
    else:
        today = datetime.now(timezone.utc).date()
        offset = (today.weekday() - 5) % 7
        start = today - timedelta(days=offset)

    if end_date:
        end = datetime.fromisoformat(end_date).date()
        if end < start:
            raise HTTPException(status_code=400, detail="نهاية الفترة قبل البداية")
    else:
        end = start + timedelta(days=6)

    start_str = start.isoformat()
    end_str = end.isoformat()

    cursor = db.activities.find(
        {"date": {"$gte": start_str, "$lte": end_str}}, {"_id": 0}
    ).sort("date", 1)
    items = await cursor.to_list(5000)

    # Group by user
    groups: dict = {}
    for a in items:
        uid = a["user_id"]
        if uid not in groups:
            groups[uid] = {
                "user_id": uid,
                "employee_name": a["employee_name"],
                "username": a["username"],
                "activities": [],
            }
        groups[uid]["activities"].append(a)

    return {
        "week_start": start_str,
        "week_end": end_str,
        "total_activities": len(items),
        "total_employees": len(groups),
        "groups": list(groups.values()),
    }


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    # Seed default admin
    admin = await db.users.find_one({"username": "admin"})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "username": "admin",
            "password_hash": hash_password("12345"),
            "full_name": "المدير العام",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded default admin (admin/12345)")
    # Indexes
    await db.users.create_index("username", unique=True)
    await db.activities.create_index("user_id")
    await db.activities.create_index("date")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
