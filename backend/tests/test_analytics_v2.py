"""Backend tests for the EXTENDED GET /api/admin/analytics endpoint.

Covers the new fields introduced in iteration 3:
- previous_period {start, end}
- previous_totals {activities, employees, departments_active}
- deltas {activities, employees, departments_active}  (percentage vs prior window)
- exclude_admin (bool) query param
"""
import os
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://maintenance-crew-3.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"username": "admin", "password": "12345"}
EMP_C = {"username": "TEST_anly_c", "password": "pwc1", "full_name": "موظف ج تحليلات"}


# ---------- Helpers ----------
def shift_month(y: int, m: int, delta: int):
    m2 = m + delta
    while m2 <= 0:
        m2 += 12
        y -= 1
    while m2 > 12:
        m2 -= 12
        y += 1
    return y, m2


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
def employee_c(s, admin_headers):
    _delete_emp_by_username(s, admin_headers, EMP_C["username"])
    r = s.post(f"{API}/admin/employees", headers=admin_headers, json=EMP_C)
    assert r.status_code == 200, r.text
    emp_id = r.json()["id"]
    r = s.post(f"{API}/auth/login", json={"username": EMP_C["username"], "password": EMP_C["password"]})
    assert r.status_code == 200
    token = r.json()["access_token"]
    emp_headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    yield {"id": emp_id, "headers": emp_headers}
    s.delete(f"{API}/admin/employees/{emp_id}", headers=admin_headers)


@pytest.fixture(scope="module")
def seeded_v2(s, admin_headers, employee_c):
    """Seed: 2 admin activities + 3 employee activities in current month,
    and 1 employee activity exactly 3 months ago (for delta tests at months=3)."""
    today = datetime.now(timezone.utc).date()

    def date_n_months_ago(n: int) -> str:
        y, m = shift_month(today.year, today.month, -n)
        return f"{y:04d}-{m:02d}-05"

    emp_h = employee_c["headers"]

    plan = [
        # (headers, dept, months_back)
        (admin_headers, "التدقيق", 0),       # admin activity #1 - current
        (admin_headers, "التدقيق", 0),       # admin activity #2 - current
        (emp_h, "التخطيط", 0),                # emp activity #1 - current
        (emp_h, "التخطيط", 0),                # emp activity #2 - current
        (emp_h, "الإعلام", 0),                # emp activity #3 - current
        # Activity exactly 3 months ago: for months=3, current window = [m-2..m],
        # previous window = [m-5..m-3]; the activity at m-3 falls in previous window.
        (emp_h, "التخطيط", 3),
    ]
    created = []
    for headers, dept, n in plan:
        payload = {
            "date": date_n_months_ago(n),
            "nature_of_work": f"TEST_anly2 {dept} {n}",
            "department": dept,
            "notes": "v2 seed",
        }
        r = s.post(f"{API}/activities", headers=headers, json=payload)
        assert r.status_code == 200, r.text
        created.append((r.json()["id"], headers))

    yield {
        "ids": [c[0] for c in created],
        "emp_id": employee_c["id"],
    }

    # teardown via admin
    admin_login = s.post(f"{API}/auth/login", json=ADMIN).json()
    admin_h = {"Authorization": f"Bearer {admin_login['access_token']}", "Content-Type": "application/json"}
    for aid in [c[0] for c in created]:
        s.delete(f"{API}/activities/{aid}", headers=admin_h)


# ---------- Tests ----------
class TestAnalyticsV2Shape:
    def test_new_fields_present(self, s, admin_headers):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("previous_period", "previous_totals", "deltas", "exclude_admin"):
            assert k in d, f"missing key {k}"
        # previous_period
        pp = d["previous_period"]
        assert "start" in pp and "end" in pp
        datetime.fromisoformat(pp["start"])
        datetime.fromisoformat(pp["end"])
        # previous_totals
        pt = d["previous_totals"]
        for k in ("activities", "employees", "departments_active"):
            assert k in pt and isinstance(pt[k], int)
        # deltas
        de = d["deltas"]
        for k in ("activities", "employees", "departments_active"):
            assert k in de
            assert (de[k] is None) or isinstance(de[k], (int, float))
        # exclude_admin
        assert d["exclude_admin"] is False
        # no _id leak
        assert '"_id"' not in r.text

    def test_previous_period_alignment_default(self, s, admin_headers):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers)
        d = r.json()
        cur_start = datetime.fromisoformat(d["period"]["start"]).date()
        months = d["period"]["months"]
        prev_start = datetime.fromisoformat(d["previous_period"]["start"]).date()
        prev_end = datetime.fromisoformat(d["previous_period"]["end"]).date()
        # prev_end = day before cur_start
        assert prev_end == cur_start - timedelta(days=1)
        # prev_start = exact same months count before cur_start (first day)
        exp_y, exp_m = shift_month(cur_start.year, cur_start.month, -months)
        assert prev_start.year == exp_y and prev_start.month == exp_m
        assert prev_start.day == 1

    @pytest.mark.parametrize("months", [1, 3, 6, 12])
    def test_previous_period_alignment_param(self, s, admin_headers, months):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": months})
        d = r.json()
        cur_start = datetime.fromisoformat(d["period"]["start"]).date()
        prev_start = datetime.fromisoformat(d["previous_period"]["start"]).date()
        prev_end = datetime.fromisoformat(d["previous_period"]["end"]).date()
        assert prev_end == cur_start - timedelta(days=1)
        exp_y, exp_m = shift_month(cur_start.year, cur_start.month, -months)
        assert (prev_start.year, prev_start.month, prev_start.day) == (exp_y, exp_m, 1)


class TestAnalyticsExcludeAdmin:
    def test_default_includes_admin(self, s, admin_headers, seeded_v2):
        """Default (no exclude_admin) -> admin's own activities are counted."""
        r = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 1})
        d = r.json()
        assert d["exclude_admin"] is False
        depts = {x["department"]: x["count"] for x in d["by_department"]}
        # admin seeded 2 activities in التدقيق this month
        assert depts.get("التدقيق", 0) >= 2, f"admin activities missing in default: {depts}"
        # by_employee should include admin user
        emp_usernames = [e["username"] for e in d["by_employee"]]
        assert "admin" in emp_usernames

    def test_exclude_admin_true_filters_everywhere(self, s, admin_headers, seeded_v2):
        r = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 1, "exclude_admin": "true"})
        assert r.status_code == 200
        d = r.json()
        assert d["exclude_admin"] is True
        # by_employee must NOT contain admin
        for e in d["by_employee"]:
            assert e["username"] != "admin"
        # by_department: التدقيق contribution from admin (2 activities) should be gone.
        # We can't assert ==0 if other tests inserted, but compare vs default call.
        r_def = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 1})
        d_def = r_def.json()
        def_total = d_def["totals"]["activities"]
        excl_total = d["totals"]["activities"]
        assert excl_total <= def_total
        # Our specific seed adds exactly 2 admin activities in current month, so diff >= 2
        assert def_total - excl_total >= 2

    def test_exclude_admin_previous_totals_also_excludes(self, s, admin_headers, seeded_v2):
        """previous_totals must also respect exclude_admin (no admin activity counted in prev window)."""
        # Seed an admin activity in the previous window of months=1 (i.e., last month, day 15).
        today = datetime.now(timezone.utc).date()
        py, pm = shift_month(today.year, today.month, -1)
        prev_date = f"{py:04d}-{pm:02d}-15"
        payload = {
            "date": prev_date,
            "nature_of_work": "TEST_anly2 admin prev",
            "department": "التدقيق",
            "notes": "v2 prev admin",
        }
        r = s.post(f"{API}/activities", headers=admin_headers, json=payload)
        assert r.status_code == 200
        admin_prev_id = r.json()["id"]
        try:
            # default: admin counted in prev
            r_def = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 1})
            prev_def = r_def.json()["previous_totals"]["activities"]
            # exclude_admin: that admin activity should NOT count
            r_excl = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 1, "exclude_admin": "true"})
            prev_excl = r_excl.json()["previous_totals"]["activities"]
            assert prev_def - prev_excl >= 1, f"admin not excluded in previous_totals: def={prev_def} excl={prev_excl}"
        finally:
            s.delete(f"{API}/activities/{admin_prev_id}", headers=admin_headers)

    def test_exclude_admin_only_employee_count_with_isolated_seed(self, s, admin_headers, employee_c):
        """Targeted seed: create exactly 1 admin and 1 employee activity in current month,
        verify exclude_admin=true totals.activities counts only employee (subtract baseline)."""
        today = datetime.now(timezone.utc).date()
        date_today = today.isoformat()
        # baseline (exclude_admin) before our seed
        r0 = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 1, "exclude_admin": "true"})
        base_emp_total = r0.json()["totals"]["activities"]
        r0d = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 1})
        base_def_total = r0d.json()["totals"]["activities"]

        # add 1 admin + 1 employee activity
        a1 = s.post(f"{API}/activities", headers=admin_headers, json={
            "date": date_today, "nature_of_work": "TEST_anly2 iso admin",
            "department": "الجودة", "notes": "iso"}).json()
        a2 = s.post(f"{API}/activities", headers=employee_c["headers"], json={
            "date": date_today, "nature_of_work": "TEST_anly2 iso emp",
            "department": "الجودة", "notes": "iso"}).json()
        try:
            r1 = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 1, "exclude_admin": "true"})
            new_emp_total = r1.json()["totals"]["activities"]
            # exclude_admin should grow by exactly 1 (the employee one)
            assert new_emp_total - base_emp_total == 1, f"expected +1 employee, got {new_emp_total - base_emp_total}"

            r1d = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 1})
            new_def_total = r1d.json()["totals"]["activities"]
            # default should grow by 2 (admin + employee)
            assert new_def_total - base_def_total == 2, f"expected +2 default, got {new_def_total - base_def_total}"
        finally:
            s.delete(f"{API}/activities/{a1['id']}", headers=admin_headers)
            s.delete(f"{API}/activities/{a2['id']}", headers=admin_headers)


class TestAnalyticsDeltas:
    def test_delta_formula_correctness(self, s, admin_headers, seeded_v2):
        """Verify (cur - prev) / prev * 100, rounded to 1 decimal."""
        r = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 6})
        d = r.json()
        t, pt, de = d["totals"], d["previous_totals"], d["deltas"]
        for k in ("activities", "employees", "departments_active"):
            cur, prev = t[k], pt[k]
            if prev == 0 and cur == 0:
                assert de[k] is None, f"expected null delta for {k} when both 0"
            elif prev == 0:
                assert de[k] == 100.0, f"expected 100.0 delta for {k} when prev=0 and cur>0"
            else:
                exp = round(((cur - prev) / prev) * 100.0, 1)
                assert de[k] == exp, f"delta[{k}] expected {exp}, got {de[k]}"

    def test_delta_null_when_both_zero(self, s, admin_headers):
        """months=24 ensures the previous window is far in the past (likely empty);
        with exclude_admin=true and no test data there, deltas may be null.
        Just assert the null/100.0 contract using a synthetic scenario via params."""
        r = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 24, "exclude_admin": "true"})
        d = r.json()
        t, pt, de = d["totals"], d["previous_totals"], d["deltas"]
        for k in ("activities", "employees", "departments_active"):
            if t[k] == 0 and pt[k] == 0:
                assert de[k] is None
            elif pt[k] == 0 and t[k] > 0:
                assert de[k] == 100.0

    def test_delta_reflects_seeded_change_months3(self, s, admin_headers, seeded_v2):
        """seeded_v2 places 1 employee activity exactly 3 months ago (previous window for months=3)
        and 3 employee activities in current month. With exclude_admin=true the contribution
        from our seed: current=+3, previous=+1 -> delta should be positive."""
        r_excl = s.get(f"{API}/admin/analytics", headers=admin_headers, params={"months": 3, "exclude_admin": "true"})
        d = r_excl.json()
        # We can't compute exact value because other data exists, but verify formula self-consistency.
        cur = d["totals"]["activities"]
        prev = d["previous_totals"]["activities"]
        if prev == 0 and cur == 0:
            assert d["deltas"]["activities"] is None
        elif prev == 0:
            assert d["deltas"]["activities"] == 100.0
        else:
            assert d["deltas"]["activities"] == round(((cur - prev) / prev) * 100.0, 1)
        # And our seed must be visible: at least 3 employee activities in التخطيط + الإعلام current
        depts = {x["department"]: x["count"] for x in d["by_department"]}
        assert depts.get("التخطيط", 0) >= 2
        assert depts.get("الإعلام", 0) >= 1


class TestAnalyticsV2NoIdLeak:
    def test_no_id_in_any_field_with_exclude_admin(self, s, admin_headers, seeded_v2):
        for params in (
            {"months": 6},
            {"months": 6, "exclude_admin": "true"},
            {"months": 1, "exclude_admin": "false"},
            {"months": 24, "exclude_admin": "true"},
        ):
            r = s.get(f"{API}/admin/analytics", headers=admin_headers, params=params)
            assert r.status_code == 200
            assert '"_id"' not in r.text, f"_id leaked for params={params}"


class TestAnalyticsV2AuthUnchanged:
    def test_unauthenticated_still_blocked(self, s):
        r = s.get(f"{API}/admin/analytics", params={"exclude_admin": "true"})
        assert r.status_code in (401, 403)

    def test_non_admin_still_403(self, s, employee_c):
        r = s.get(f"{API}/admin/analytics", headers=employee_c["headers"], params={"exclude_admin": "true"})
        assert r.status_code == 403
