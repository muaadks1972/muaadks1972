"""Backend tests for the new GET /api/admin/analytics endpoint."""
import os
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = "https://maintenance-crew-3.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN = {"username": "admin", "password": "12345"}
EMP_A = {"username": "TEST_anly_a", "password": "pwa1", "full_name": "موظف أ تحليلات"}
EMP_B = {"username": "TEST_anly_b", "password": "pwb1", "full_name": "موظف ب تحليلات"}


# ---------- Helpers / fixtures ----------
@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def admin_headers(s):
    r = s.post(f"{API}/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _delete_emp_by_username(s, admin_headers, username):
    r = s.get(f"{API}/admin/employees", headers=admin_headers)
    if r.status_code == 200:
        for e in r.json():
            if e["username"] == username:
                s.delete(f"{API}/admin/employees/{e['id']}", headers=admin_headers)


@pytest.fixture(scope="module")
def two_employees(s, admin_headers):
    """Create two test employees with login tokens, plus cleanup."""
    created_ids = []
    headers_map = {}
    for emp in (EMP_A, EMP_B):
        _delete_emp_by_username(s, admin_headers, emp["username"])
        r = s.post(f"{API}/admin/employees", headers=admin_headers, json=emp)
        assert r.status_code == 200, r.text
        emp_id = r.json()["id"]
        created_ids.append(emp_id)
        r = s.post(f"{API}/auth/login", json={"username": emp["username"], "password": emp["password"]})
        assert r.status_code == 200
        token = r.json()["access_token"]
        headers_map[emp["username"]] = (
            emp_id,
            {"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )

    yield headers_map

    # teardown
    for emp_id in created_ids:
        s.delete(f"{API}/admin/employees/{emp_id}", headers=admin_headers)


@pytest.fixture(scope="module")
def seeded_activities(s, two_employees):
    """Create deterministic activities across departments, employees and months.
    Returns list of activity ids for cleanup."""
    (a_id, a_h) = two_employees[EMP_A["username"]]
    (b_id, b_h) = two_employees[EMP_B["username"]]

    today = datetime.now(timezone.utc).date()
    # use the 5th of the month to be safe in all months (avoids month-boundary issues)
    def date_n_months_ago(n: int) -> str:
        y, m = today.year, today.month - n
        while m <= 0:
            m += 12
            y -= 1
        return f"{y:04d}-{m:02d}-05"

    plan = [
        # (headers, department, months_back)
        (a_h, "الفني", 0),
        (a_h, "الفني", 0),
        (a_h, "الفني", 1),
        (a_h, "المالي", 2),
        (b_h, "السلامة", 0),
        (b_h, "السلامة", 3),
        (b_h, "الجودة", 4),
    ]

    created = []
    for headers, dept, n in plan:
        payload = {
            "date": date_n_months_ago(n),
            "nature_of_work": f"TEST_anly {dept} {n}",
            "department": dept,
            "notes": "analytics seed",
        }
        r = s.post(f"{API}/activities", headers=headers, json=payload)
        assert r.status_code == 200, r.text
        created.append((r.json()["id"], headers))

    yield {
        "ids": created,
        "emp_a_id": a_id,
        "emp_b_id": b_id,
        "depts_used": {"الفني", "المالي", "السلامة", "الجودة"},
    }

    # teardown: delete activities (admin can delete any)
    admin_login = s.post(f"{API}/auth/login", json=ADMIN).json()
    admin_h = {"Authorization": f"Bearer {admin_login['access_token']}", "Content-Type": "application/json"}
    for aid, _ in created:
        s.delete(f"{API}/activities/{aid}", headers=admin_h)


# ---------- Tests ----------
class TestAnalyticsAuth:
    def test_unauthenticated_returns_401_or_403(self, s):
        r = s.get(f"{API}/admin/analytics")
        assert r.status_code in (401, 403)

    def test_employee_forbidden(self, s, two_employees):
        _, hdrs = two_employees[EMP_A["username"]]
        r = s.get(f"{API}/admin/analytics", headers=hdrs)
        assert r.status_code == 403


class TestAnalyticsShape:
    def test_default_months_is_6_and_structure(self, s, admin_headers, seeded_activities):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()

        # top-level keys
        for k in ("period", "totals", "by_department", "by_employee", "by_month"):
            assert k in d, f"missing key {k}"

        # period
        p = d["period"]
        assert p["months"] == 6
        assert "start" in p and "end" in p
        # validate ISO date
        datetime.fromisoformat(p["start"])
        datetime.fromisoformat(p["end"])

        # totals
        t = d["totals"]
        for k in ("activities", "employees", "departments_active"):
            assert k in t
            assert isinstance(t[k], int)

        # by_month length must equal months
        assert len(d["by_month"]) == 6

        # no _id leak anywhere
        raw = r.text
        assert '"_id"' not in raw, "MongoDB _id leaked in analytics response"

    def test_by_department_sorted_desc_and_only_positive(self, s, admin_headers, seeded_activities):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers)
        d = r.json()
        depts = d["by_department"]
        # sorted desc
        counts = [x["count"] for x in depts]
        assert counts == sorted(counts, reverse=True), f"by_department not sorted desc: {counts}"
        # only positives
        assert all(x["count"] > 0 for x in depts)
        # each entry shape
        for x in depts:
            assert set(x.keys()) >= {"department", "count"}
            assert isinstance(x["department"], str)
            assert isinstance(x["count"], int)

    def test_by_employee_sorted_desc_and_aggregated(self, s, admin_headers, seeded_activities):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers)
        d = r.json()
        emps = d["by_employee"]
        counts = [x["count"] for x in emps]
        assert counts == sorted(counts, reverse=True), f"by_employee not sorted desc: {counts}"

        # Our seed: emp_a has 4 activities in last 6 months, emp_b has 4 (0,3,4 months back -> 3 inside window of 6)
        # Within 6-month window, emp_a contributes 4, emp_b contributes 4 as well (months back: 0,3,4 all <6)
        emp_a_entries = [e for e in emps if e["user_id"] == seeded_activities["emp_a_id"]]
        emp_b_entries = [e for e in emps if e["user_id"] == seeded_activities["emp_b_id"]]
        assert len(emp_a_entries) == 1
        assert len(emp_b_entries) == 1
        assert emp_a_entries[0]["count"] >= 4
        assert emp_b_entries[0]["count"] >= 3
        # employee_name & username populated
        for e in (emp_a_entries[0], emp_b_entries[0]):
            assert e["employee_name"]
            assert e["username"]

    def test_by_month_chronological_and_yyyymm(self, s, admin_headers, seeded_activities):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers)
        d = r.json()
        months = [x["month"] for x in d["by_month"]]
        # chronological asc
        assert months == sorted(months), f"by_month not chronological: {months}"
        # format YYYY-MM
        for m in months:
            assert len(m) == 7 and m[4] == "-"
            datetime.strptime(m, "%Y-%m")
        # last entry must be current month
        today = datetime.now(timezone.utc).date()
        assert months[-1] == f"{today.year:04d}-{today.month:02d}"

    def test_totals_employees_matches_by_employee_length(self, s, admin_headers, seeded_activities):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers)
        d = r.json()
        assert d["totals"]["employees"] == len(d["by_employee"])
        assert d["totals"]["departments_active"] == len(d["by_department"])
        # totals activities equals sum across departments
        assert d["totals"]["activities"] == sum(x["count"] for x in d["by_department"])
        # also equals sum across employees
        assert d["totals"]["activities"] == sum(x["count"] for x in d["by_employee"])
        # also equals sum across months
        assert d["totals"]["activities"] == sum(x["count"] for x in d["by_month"])


class TestAnalyticsMonthsParam:
    def test_months_3(self, s, admin_headers):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 3})
        assert r.status_code == 200
        d = r.json()
        assert d["period"]["months"] == 3
        assert len(d["by_month"]) == 3

    def test_months_12(self, s, admin_headers):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 12})
        assert r.status_code == 200
        d = r.json()
        assert d["period"]["months"] == 12
        assert len(d["by_month"]) == 12

    def test_months_clamped_high(self, s, admin_headers):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 999})
        assert r.status_code == 200
        d = r.json()
        assert d["period"]["months"] == 24
        assert len(d["by_month"]) == 24

    def test_months_clamped_low(self, s, admin_headers):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 0})
        assert r.status_code == 200
        d = r.json()
        assert d["period"]["months"] == 1
        assert len(d["by_month"]) == 1
        # period.start should be first day of current month
        today = datetime.now(timezone.utc).date()
        assert d["period"]["start"] == f"{today.year:04d}-{today.month:02d}-01"

    def test_months_negative_clamped(self, s, admin_headers):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": -5})
        assert r.status_code == 200
        d = r.json()
        assert d["period"]["months"] == 1
        assert len(d["by_month"]) == 1


class TestAnalyticsAggregation:
    def test_seeded_dept_counts_visible_within_window(self, s, admin_headers, seeded_activities):
        # months=6 should include all 7 seeded activities (months back: 0,0,1,2,0,3,4)
        r = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 6})
        d = r.json()
        depts = {x["department"]: x["count"] for x in d["by_department"]}
        # we expect at least these contributions from our seed
        assert depts.get("الفني", 0) >= 3       # 2 this month + 1 last
        assert depts.get("المالي", 0) >= 1
        assert depts.get("السلامة", 0) >= 2
        assert depts.get("الجودة", 0) >= 1

    def test_months_1_only_current_month(self, s, admin_headers, seeded_activities):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 1})
        d = r.json()
        assert len(d["by_month"]) == 1
        today = datetime.now(timezone.utc).date()
        assert d["by_month"][0]["month"] == f"{today.year:04d}-{today.month:02d}"
        # Our current-month seed: 2 (الفني) + 1 (السلامة) = at least 3 contributions exist
        depts = {x["department"]: x["count"] for x in d["by_department"]}
        assert depts.get("الفني", 0) >= 2
        assert depts.get("السلامة", 0) >= 1
        # المالي was 2 months back, should NOT show in 1-month window from our seed
        # (it may still be >0 if other tests created activities this month, but our seed didn't)
