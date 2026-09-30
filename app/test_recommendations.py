"""Synthetic rule boundary and validation checks (stdlib unittest)."""
import unittest

from app.recommendations import InvalidAnswers, recommend


def patient(age=42, **changes):
    return {"sex": "F", "birth_date": f"{2026-age}-01-01", "urgent": "none",
            "checkup_year": 2026, **changes}


class RecommendationTests(unittest.TestCase):
    def test_package_boundaries_and_sex(self):
        for age, package_id in [(1, "prime_child"), (17, "prime_child"), (18, "prime_basic"),
                                (39, "prime_basic"), (40, "prime_extended"), (106, "prime_extended")]:
            for sex in ("M", "F"):
                with self.subTest(age=age, sex=sex):
                    result = recommend(patient(age, sex=sex))
                    self.assertEqual(result["package"]["id"], package_id)
                    if age >= 18:
                        self.assertIn("Женский" if sex == "F" else "Мужской", result["package"]["name"])

    def test_urgent_never_offers_package(self):
        for urgent in ("chest_pain", "dyspnea", "stroke_signs"):
            result = recommend(patient(urgent=urgent))
            self.assertIsNone(result["package"])
            self.assertEqual(result["items"], [])
            self.assertTrue(result["red_flags"])

    def test_uncovered_age_has_no_fallback_package(self):
        result = recommend(patient(birth_date="2025-01-01", checkup_year=2025))
        self.assertIsNone(result["package"])
        self.assertTrue(result["warnings"])

    def test_pregnancy_excludes_imaging_and_hepatitis(self):
        for pregnant in ("yes", "unsure"):
            result = recommend(patient(pregnant=pregnant))
            for item in result["items"]:
                self.assertFalse(any(word in item["exam"].lower() for word in ("кт", "маммограф", "рентген")))
            self.assertNotIn("scr_hepatitis", [item["id"] for item in result["screenings"]])
            self.assertTrue(result["warnings"])

    def test_registered_and_repeat_exclusions(self):
        result = recommend(patient(registered=["hypertension"], last_screening={"scr_breast": 2025}))
        ids = [item["id"] for item in result["screenings"]]
        self.assertNotIn("scr_cvd", ids)
        self.assertNotIn("scr_breast", ids)
        self.assertIn("scr_cervix", ids)
        self.assertIn("scr_breast", [item["id"] for item in recommend(patient(last_screening={"scr_breast": 2024}))["screenings"]])

    def test_lung_risk_thresholds_and_missing_values(self):
        for smoking, work, expected in [({}, False, False), ({"pack_years": 20}, False, False),
                                        ({"pack_years": 20, "quit_years_ago": 0}, False, True),
                                        ({"pack_years": 20, "quit_years_ago": 15}, False, True),
                                        ({"pack_years": 20, "quit_years_ago": 16}, False, False),
                                        ({"pack_years": 19.5, "quit_years_ago": 0}, False, False),
                                        ({}, True, True)]:
            result = recommend(patient(50, smoking=smoking, hazardous_work_10y=work))
            self.assertEqual("scr_lung" in [item["id"] for item in result["screenings"]], expected)

    def test_additions_deduplicate_and_keep_validation_labels(self):
        result = recommend(patient(conditions=["lungs", "tb", "diabetes", "glaucoma"]))
        self.assertEqual([item["id"] for item in result["additions"]], ["c_endo", "c_pulmo"])
        self.assertEqual(len(result["additions"][1]["why"]), 2)
        self.assertTrue(all(item["needs_doctor_validation"] for item in result["additions"]))

    def test_free_and_paid_overlap_are_preserved(self):
        result = recommend(patient())
        mammograms = [item for item in result["items"] if "Маммограф" in item["exam"]]
        self.assertEqual({item["payment"] for item in mammograms}, {"free_gobmp", "paid_prime"})

    def test_conditional_answers_are_ignored(self):
        result = recommend(patient(sex="M", pregnant="yes", discharge="yes", last_screening={"scr_breast": 2025}))
        self.assertEqual(result["warnings"], [])
        self.assertEqual(result["additions"], [])

    def test_invalid_input(self):
        for payload in [[], {}, patient(sex="X"), patient(urgent="unknown"), patient(conditions="diabetes"),
                        patient(checkup_year=True), patient(smoking=[]), patient(birth_date="1984-02-30"),
                        patient(last_screening={"scr_breast": 2027}), patient(smoking={"pack_years": -1}),
                        patient(smoking={"pack_years": float("inf")})]:
            with self.subTest(payload=payload), self.assertRaises(InvalidAnswers):
                recommend(payload)

    def test_birth_year_is_derived_and_preparation_matches(self):
        result = recommend(patient(birth_year=2000, blood_thinners="yes"))
        self.assertEqual(result["age_year"], 42)
        self.assertIn("pr_thinners", [item["id"] for item in result["preparation"]])
        child = recommend(patient(10))
        self.assertNotIn("pr_colon", [item["id"] for item in child["preparation"]])


if __name__ == "__main__":
    unittest.main()
