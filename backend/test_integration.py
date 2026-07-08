import os
import json
import unittest
from app import app, DATA_FOLDER

class TestBackendIntegration(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True
        
        # Ensure we clear existing cache for a clean state
        self.app.post('/api/reset_session')
        
    def tearDown(self):
        # Clean up after test
        self.app.post('/api/reset_session')

    def test_full_pipeline(self):
        # 1. Get sample files listing
        response = self.app.get('/api/get_samples')
        self.assertEqual(response.status_code, 200)
        samples = response.json
        self.assertIn("jds", samples)
        self.assertIn("resumes", samples)
        self.assertTrue(len(samples["jds"]) > 0)
        self.assertTrue(len(samples["resumes"]) > 0)
        
        # Pick one sample JD and Resume
        sample_jd = "Google-Software_Engineer.txt"
        sample_resume = "Resume-Systems_Generalist.txt"
        
        # 2. Parse JD
        response = self.app.post('/api/parse_jd', json={"sample_name": sample_jd})
        self.assertEqual(response.status_code, 200)
        jd_data = response.json
        self.assertEqual(jd_data["source_type"], "jd")
        self.assertEqual(jd_data["company"], "Google")
        self.assertEqual(jd_data["role"], "Software Engineer")
        self.assertTrue(len(jd_data["skills"]) > 0)
        self.assertIn("skills", jd_data)
        
        # Assert that jd_output.json exists
        self.assertTrue(os.path.exists(os.path.join(DATA_FOLDER, 'jd_output.json')))

        # 3. Parse Resume (which also pre-fills and saves profile.json)
        response = self.app.post('/api/parse_resume', json={"sample_name": sample_resume})
        self.assertEqual(response.status_code, 200)
        resume_data = response.json
        self.assertEqual(resume_data["source_type"], "resume")
        self.assertEqual(resume_data["name"], "Alex Rivera")
        self.assertEqual(resume_data["email"], "alex.rivera@systemsgeek.com")
        self.assertTrue(len(resume_data["skills"]) > 0)
        
        # Assert files exist
        self.assertTrue(os.path.exists(os.path.join(DATA_FOLDER, 'resume_output.json')))
        self.assertTrue(os.path.exists(os.path.join(DATA_FOLDER, 'profile.json')))

        # 4. Get Profile and verify pre-filled data
        response = self.app.get('/api/get_profile')
        self.assertEqual(response.status_code, 200)
        profile = response.json
        self.assertEqual(profile["name"], "Alex Rivera")
        self.assertEqual(profile["email"], "alex.rivera@systemsgeek.com")
        self.assertTrue(len(profile["skills"]) > 0)
        
        # 5. Modify Profile and Save
        profile["name"] = "Alex Rivera (Updated)"
        profile["hackathons"] = ["Radix Hackathon 2026"]
        profile["internships"] = ["Systems Engineering Intern"]
        profile["certifications"] = ["AWS Certified Cloud Practitioner"]
        
        response = self.app.post('/api/save_profile', json=profile)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "saved")
        
        # 6. Run Talent Check
        response = self.app.get('/api/talent_check?company=Google&role=Software Engineer')
        self.assertEqual(response.status_code, 200)
        tc_data = response.json
        self.assertEqual(tc_data["company"], "Google")
        self.assertEqual(tc_data["role"], "Software Engineer")
        self.assertIn("readiness_score", tc_data)
        self.assertIn("skillset_gap", tc_data)
        self.assertTrue(0 <= tc_data["readiness_score"] <= 100)
        
        # Verify AWS certification boosted CLOUD levels
        cloud_gap = next((item for item in tc_data["skillset_gap"] if item["category_code"] == "CLOUD"), None)
        self.assertIsNotNone(cloud_gap)
        # AWS certification gives +2 boost to baseline. Default level without skill would be 1, now should be at least 3.
        self.assertTrue(cloud_gap["candidate_level"] >= 3)

        # 7. Run Skill Match
        response = self.app.get('/api/skill_match')
        self.assertEqual(response.status_code, 200)
        sm_data = response.json
        self.assertEqual(sm_data["jd_source_file"], "Google-Software_Engineer.txt")
        self.assertIn("match_score", sm_data)
        self.assertIn("matched_skills", sm_data)
        self.assertIn("missing_skills", sm_data)
        self.assertTrue(0 <= sm_data["match_score"] <= 100)

        # 8. Reset Session
        response = self.app.post('/api/reset_session')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(os.path.exists(os.path.join(DATA_FOLDER, 'profile.json')))
        self.assertFalse(os.path.exists(os.path.join(DATA_FOLDER, 'jd_output.json')))

if __name__ == '__main__':
    unittest.main()
