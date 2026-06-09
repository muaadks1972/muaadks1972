"""Backend API tests for Air Navigation Maintenance app.
Covers: auth, departments, employee admin CRUD, activities, weekly report.
"""
import os
import pytest
import requests
from datetime import datetime, timedelta, timezone

# Use public backend URL from frontend .env
BASE_URL = "https://maintenance-crew-3.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN = {"username": "admin", "password": "12345"}
EMPLOYEE = {"username": "TEST_emp_pytest", "password": "emp123", "full_name": "موظف اختبار"}

ALLOWED_DEPARTMENTS = [
    "الموارد البشرية", "المالي", "التدقيق", "التخطيط",
    "مكتب المدير العام", "الفني", "الاتصالات", "الحركة الجوية",
    "السلامة", "معلومات الطيران", "التدريب", "الجودة",
    "تمكين المرأة", "الإعلام",
]


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json=ADMIN)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def employee_setup(s, admin_headers):
    """Create a fresh test employee (delete first if exists by listing). Returns (emp_id, token)."""
    # cleanup possibly-existing employee with same username
    r = s.get(f"{API}/admin/employees", headers=admin_headers)
    assert r.status_code == 200
    for e in r.json():
        if e["username"] == EMPLOYEE["username"]:
            s.delete(f"{API}/admin/employees/{e['id']}", headers=admin_headers)

    r = s.post(f"{API}/admin/employees", headers=admin_headers, json=EMPLOYEE)
    assert r.status_code == 200, f"Create employee failed: {r.status_code} {r.text}"
    emp = r.json()
    assert emp["username"] == EMPLOYEE["username"]
    assert emp["role"] == "employee"
    emp_id = emp["id"]

    # login as employee
    r = s.post(f"{API}/auth/login", json={"username": EMPLOYEE["username"], "password": EMPLOYEE["password"]})
    assert r.status_code == 200, f"Employee login failed: {r.text}"
    token = r.json()["access_token"]
    yield emp_id, token

    # teardown
    s.delete(f"{API}/admin/employees/{emp_id}", headers=admin_headers)


@pytest.fixture
def emp_headers(employee_setup):
    _, token = employee_setup
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_login_admin_success(self, s):
        r = s.post(f"{API}/auth/login", json=ADMIN)
        assert r.status_code == 200
        d = r.json()
        assert d["token_type"] == "bearer"
        assert d["user"]["username"] == "admin"
        assert d["user"]["role"] == "admin"
        assert "_id" not in d["user"]

    def test_login_wrong_credentials(self, s):
        r = s.post(f"{API}/auth/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_user(self, s):
        r = s.post(f"{API}/auth/login", json={"username": "nonexistent_xyz", "password": "x"})
        assert r.status_code == 401

    def test_me_with_token(self, s, admin_headers):
        r = s.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["username"] == "admin"
        assert d["role"] == "admin"
        assert "_id" not in d

    def test_me_without_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)

    def test_me_invalid_token(self, s):
        r = s.get(f"{API}/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
        assert r.status_code == 401


# ---------- Departments ----------
class TestDepartments:
    def test_departments_list(self, s):
        r = s.get(f"{API}/departments")
        assert r.status_code == 200
        depts = r.json()["departments"]
        assert len(depts) == 14
        for d in ALLOWED_DEPARTMENTS:
            assert d in depts


# ---------- Admin Employees ----------
class TestEmployeesAdmin:
    def test_create_and_list_employee(self, s, admin_headers, employee_setup):
        emp_id, _ = employee_setup
        r = s.get(f"{API}/admin/employees", headers=admin_headers)
        assert r.status_code == 200
        usernames = [e["username"] for e in r.json()]
        assert EMPLOYEE["username"] in usernames
        for e in r.json():
            assert "_id" not in e
            assert "password_hash" not in e

    def test_duplicate_username_returns_400(self, s, admin_headers, employee_setup):
        r = s.post(f"{API}/admin/employees", headers=admin_headers, json=EMPLOYEE)
        assert r.status_code == 400

    def test_employee_cannot_access_admin(self, s, emp_headers):
        r = s.get(f"{API}/admin/employees", headers=emp_headers)
        assert r.status_code == 403

    def test_delete_employee_flow(self, s, admin_headers):
        # create then delete an isolated employee
        u = {"username": "TEST_del_emp", "password": "x123", "full_name": "للحذف"}
        # cleanup
        r = s.get(f"{API}/admin/employees", headers=admin_headers).json()
        for e in r:
            if e["username"] == u["username"]:
                s.delete(f"{API}/admin/employees/{e['id']}", headers=admin_headers)
        r = s.post(f"{API}/admin/employees", headers=admin_headers, json=u)
        assert r.status_code == 200
        eid = r.json()["id"]
        r = s.delete(f"{API}/admin/employees/{eid}", headers=admin_headers)
        assert r.status_code == 200
        # verify gone
        r = s.get(f"{API}/admin/employees", headers=admin_headers).json()
        assert not any(e["id"] == eid for e in r)
        # second delete -> 404
        r = s.delete(f"{API}/admin/employees/{eid}", headers=admin_headers)
        assert r.status_code == 404


# ---------- Activities ----------
class TestActivities:
    def test_create_activity_valid(self, s, emp_headers):
        today = datetime.now(timezone.utc).date().isoformat()
        payload = {
            "date": today,
            "nature_of_work": "صيانة دورية",
            "department": "الفني",
            "notes": "اختبار",
        }
        r = s.post(f"{API}/activities", headers=emp_headers, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["department"] == "الفني"
        assert d["nature_of_work"] == "صيانة دورية"
        assert "_id" not in d
        assert d["employee_name"] == EMPLOYEE["full_name"]

    def test_create_activity_invalid_dept(self, s, emp_headers):
        today = datetime.now(timezone.utc).date().isoformat()
        r = s.post(f"{API}/activities", headers=emp_headers, json={
            "date": today, "nature_of_work": "test", "department": "Invalid Dept", "notes": ""
        })
        assert r.status_code == 400

    def test_my_activities_only_returns_own(self, s, emp_headers):
        r = s.get(f"{API}/activities/me", headers=emp_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        for it in items:
            assert it["username"] == EMPLOYEE["username"]
            assert "_id" not in it

    def test_delete_own_activity(self, s, emp_headers):
        today = datetime.now(timezone.utc).date().isoformat()
        r = s.post(f"{API}/activities", headers=emp_headers, json={
            "date": today, "nature_of_work": "حذف لاحقاً", "department": "السلامة"
        })
        assert r.status_code == 200
        aid = r.json()["id"]
        r = s.delete(f"{API}/activities/{aid}", headers=emp_headers)
        assert r.status_code == 200
        # Second delete -> 404
        r = s.delete(f"{API}/activities/{aid}", headers=emp_headers)
        assert r.status_code == 404

    def test_non_owner_cannot_delete(self, s, admin_headers, emp_headers):
        # Create another employee, login, then try to delete first emp's activity
        other = {"username": "TEST_other_emp", "password": "p1", "full_name": "آخر"}
        # cleanup
        existing = s.get(f"{API}/admin/employees", headers=admin_headers).json()
        for e in existing:
            if e["username"] == other["username"]:
                s.delete(f"{API}/admin/employees/{e['id']}", headers=admin_headers)
        r = s.post(f"{API}/admin/employees", headers=admin_headers, json=other)
        assert r.status_code == 200
        other_id = r.json()["id"]
        try:
            r = s.post(f"{API}/auth/login", json={"username": other["username"], "password": other["password"]})
            other_token = r.json()["access_token"]
            other_headers = {"Authorization": f"Bearer {other_token}", "Content-Type": "application/json"}

            # First emp creates activity
            today = datetime.now(timezone.utc).date().isoformat()
            r = s.post(f"{API}/activities", headers=emp_headers, json={
                "date": today, "nature_of_work": "مهم", "department": "الجودة"
            })
            assert r.status_code == 200
            aid = r.json()["id"]

            # Other emp tries to delete
            r = s.delete(f"{API}/activities/{aid}", headers=other_headers)
            assert r.status_code == 404

            # Cleanup activity
            s.delete(f"{API}/activities/{aid}", headers=emp_headers)
        finally:
            s.delete(f"{API}/admin/employees/{other_id}", headers=admin_headers)


# ---------- Admin Activities & Reports ----------
class TestAdminReports:
    def test_admin_activities_dept_filter(self, s, admin_headers, emp_headers):
        today = datetime.now(timezone.utc).date().isoformat()
        r = s.post(f"{API}/activities", headers=emp_headers, json={
            "date": today, "nature_of_work": "filter test", "department": "التدريب"
        })
        assert r.status_code == 200
        aid = r.json()["id"]
        try:
            r = s.get(f"{API}/admin/activities", headers=admin_headers, params={"department": "التدريب"})
            assert r.status_code == 200
            items = r.json()
            assert any(i["id"] == aid for i in items)
            for it in items:
                assert it["department"] == "التدريب"
                assert "_id" not in it
        finally:
            s.delete(f"{API}/activities/{aid}", headers=emp_headers)

    def test_weekly_report_default(self, s, admin_headers):
        r = s.get(f"{API}/admin/report/weekly", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("week_start", "week_end", "total_activities", "total_employees", "groups"):
            assert k in d
        assert isinstance(d["groups"], list)
        # Make sure no _id leaks in nested activities
        for g in d["groups"]:
            for a in g["activities"]:
                assert "_id" not in a

    def test_weekly_report_custom_week_start(self, s, admin_headers, emp_headers):
        # Use a known Saturday: pick the most recent Saturday string
        today = datetime.now(timezone.utc).date()
        offset = (today.weekday() - 5) % 7
        sat = today - timedelta(days=offset)
        ws = sat.isoformat()

        # Create an activity inside the week
        r = s.post(f"{API}/activities", headers=emp_headers, json={
            "date": ws, "nature_of_work": "weekly", "department": "المالي"
        })
        assert r.status_code == 200
        aid = r.json()["id"]
        try:
            r = s.get(f"{API}/admin/report/weekly", headers=admin_headers, params={"week_start": ws})
            assert r.status_code == 200
            d = r.json()
            assert d["week_start"] == ws
            expected_end = (sat + timedelta(days=6)).isoformat()
            assert d["week_end"] == expected_end
            assert d["total_activities"] >= 1
        finally:
            s.delete(f"{API}/activities/{aid}", headers=emp_headers)
